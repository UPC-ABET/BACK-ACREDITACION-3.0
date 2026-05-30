import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { DelegatesUploadValidation, DelegatesLookups, ResolvedDelegateRow } from '../core/delegates-upload.validation';
import type { DelegatesUploadDto } from '../model/delegates-upload.dtos';
import { DelegateRow, UploadResult } from '../model/delegates-upload.types';
import { delegatesUploadStrings } from '../config/strings/delegates-upload.validation';

const UPLOAD_TYPE = 'DELEGADOS';

@Injectable()
export class DelegatesUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	// Flujo UPDATE (no INSERT): réplica de USP_DelegadosCargaMasiva.
	// Marca is_delegate=true sobre SSEs existentes y deja huella en extra.delegate_upload_log_id
	// para soportar rollback sin tabla histórica (manifiesto §14.8: pendiente CargaAlumnoSeccionHistorico).
	async processUpload(fileBuffer: Buffer, fileName: string, dto: DelegatesUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = DelegatesUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: delegatesUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: delegatesUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.markDelegates(queryRunner.manager, resolved, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: delegatesUploadStrings.result.uploadSuccess,
					uploadLogId: log.id,
					totalRows: rows.length,
					loadedRows: rows.length,
					errorRows: 0,
					excelWithErrors: null,
					fileName: null,
				};
			} catch (err) {
				await queryRunner.rollbackTransaction();
				throw err;
			}
		} finally {
			await queryRunner.release();
		}
	}

	// Rollback de flujo UPDATE — restaura is_delegate=false sobre las SSE que este log marcó.
	// Identifica las filas con extra.delegate_upload_log_id = X (no se toca upload_log_id canónico de la SSE).
	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await queryRunner.manager.query(
				`UPDATE academic.student_section_enrollments
				 SET extra = (extra - 'delegate_upload_log_id') - 'is_delegate'
				 WHERE (extra->>'delegate_upload_log_id')::bigint = $1`,
				[uploadLogId],
			);
			await this.uploadLogService.markRolledBack(uploadLogId, queryRunner.manager);
			await queryRunner.commitTransaction();
			return { success: true };
		} catch (err) {
			await queryRunner.rollbackTransaction();
			throw err;
		} finally {
			await queryRunner.release();
		}
	}

	// %% INTERNOS

	private parseWorkbook(workbook: ExcelJS.Workbook): DelegateRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: DelegateRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				courseCode: this.cell(row, 1),
				sectionCode: this.cell(row, 2),
				studentCode: this.cell(row, 3),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: DelegateRow[]): Promise<DelegatesLookups> {
		const courseCodes = [...new Set(rows.map((r) => (r.courseCode ?? '').trim()).filter(Boolean))];
		const studentCodes = [...new Set(rows.map((r) => (r.studentCode ?? '').trim()).filter(Boolean))];

		// SSEs candidatas: alumno × sección (curso+sección) en el período.
		const sses: Array<{ id: number; course_code: string; section_code: string; student_code: string; is_delegate: boolean }> = courseCodes.length && studentCodes.length
			? await manager.query(
					`SELECT sse.id,
					        c.code  AS course_code,
					        cs.section_code,
					        st.code AS student_code,
					        COALESCE((sse.extra->>'is_delegate')::boolean, false) AS is_delegate
					 FROM academic.student_section_enrollments sse
					 JOIN academic.course_sections cs ON cs.id = sse.course_section_id
					 JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
					 JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
					 JOIN academic.courses c ON c.id = spc.course_id
					 JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
					 JOIN academic.students st ON st.id = es.student_id
					 WHERE spap.academic_period_id = $1
					   AND c.code = ANY($2)
					   AND st.code = ANY($3)`,
					[academicPeriodId, courseCodes, studentCodes],
				)
			: [];

		return {
			sseIdByKey: new Map(sses.map((s) => [`${s.course_code}|${s.section_code}|${s.student_code}`, s.id])),
			alreadyDelegateSseIds: new Set(sses.filter((s) => s.is_delegate).map((s) => s.id)),
		};
	}

	// UPDATE atómico: is_delegate=true + extra.delegate_upload_log_id=$logId.
	// No tocamos upload_log_id de la SSE (eso lo dejó el flujo Alumno×Sección original).
	private async markDelegates(manager: EntityManager, resolved: ResolvedDelegateRow[], uploadLogId: number): Promise<void> {
		for (const r of resolved) {
			await manager.query(
				// Canónico: SSE no tiene columna is_delegate → el flag se estampa en extra (junto al log id).
				`UPDATE academic.student_section_enrollments
				 SET extra = jsonb_set(
				         jsonb_set(COALESCE(extra, '{}'::jsonb), '{delegate_upload_log_id}', to_jsonb($1::bigint), true),
				         '{is_delegate}', 'true'::jsonb, true),
				     updated_at = NOW()
				 WHERE id = $2`,
				[uploadLogId, r.sseId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedDelegateRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 4;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
