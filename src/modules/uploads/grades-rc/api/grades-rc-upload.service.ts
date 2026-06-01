import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { GradesRcUploadValidation, GradesRcLookups, ResolvedGradesRcRow } from '../core/grades-rc-upload.validation';
import type { GradesRcUploadDto } from '../model/grades-rc-upload.dtos';
import { GradesRcRow, UploadResult, parseGrade, GRADE_TYPE_CODES } from '../model/grades-rc-upload.types';
import { gradesRcUploadStrings } from '../config/strings/grades-rc-upload.validation';

const UPLOAD_TYPE = 'NOTASRC';
const GRADE_TYPE_GROUP_CODE = 'GRADE_TYPE';

@Injectable()
export class GradesRcUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(fileBuffer: Buffer, fileName: string, dto: GradesRcUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = GradesRcUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: gradesRcUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: gradesRcUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id as number, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertGrades(queryRunner.manager, resolved, rows, lookups, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: gradesRcUploadStrings.result.uploadSuccess,
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

	// student_course_grades no tiene upload_log_id en el DDL TO-BE (§14.10 lo dejó fuera de alcance).
	// Marcamos extra.grade_upload_log_id y rollback elimina por ese stamp.
	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await queryRunner.manager.query(
				`DELETE FROM academic.student_course_grades
				 WHERE (extra->>'grade_upload_log_id')::bigint = $1`,
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

	private parseWorkbook(workbook: ExcelJS.Workbook): GradesRcRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: GradesRcRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				courseCode: this.cell(row, 1),
				sectionCode: this.cell(row, 2),
				studentCode: this.cell(row, 3),
				partialGrade: this.cell(row, 4),
				finalGrade: this.cell(row, 5),
				fdmGrade: this.cell(row, 6),
				realGrade: this.cell(row, 7),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: GradesRcRow[]): Promise<GradesRcLookups> {
		const courseCodes = [...new Set(rows.map((r) => (r.courseCode ?? '').trim()).filter(Boolean))];
		const studentCodes = [...new Set(rows.map((r) => (r.studentCode ?? '').trim()).filter(Boolean))];

		const sses: Array<{ id: number; course_code: string; section_code: string; student_code: string }> = courseCodes.length && studentCodes.length
			? await manager.query(
					`SELECT sse.id,
					        c.code  AS course_code,
					        cs.section_code,
					        st.code AS student_code
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
		const types: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.code = ANY($2)`,
			[GRADE_TYPE_GROUP_CODE, Object.values(GRADE_TYPE_CODES)],
		);
		const sseIds = sses.map((s) => s.id);
		const existing: Array<{ student_section_enrollment_id: number; grade_type_id: number }> = sseIds.length
			? await manager.query(
					'SELECT student_section_enrollment_id, grade_type_id FROM academic.student_course_grades WHERE student_section_enrollment_id = ANY($1)',
					[sseIds],
				)
			: [];

		return {
			sseIdByKey: new Map(sses.map((s) => [`${s.course_code}|${s.section_code}|${s.student_code}`, s.id])),
			gradeTypeIdByCode: new Map(types.map((t) => [t.code, t.id])),
			existingGradeKeys: new Set(existing.map((e) => `${e.student_section_enrollment_id}|${e.grade_type_id}`)),
		};
	}

	// Unpivot: 1 fila Excel → 4 INSERTs (1 por GRADE_TYPE) con extra.grade_upload_log_id.
	private async insertGrades(
		manager: EntityManager,
		resolved: ResolvedGradesRcRow[],
		rows: GradesRcRow[],
		lookups: GradesRcLookups,
		uploadLogId: number,
	): Promise<void> {
		const idPartial = lookups.gradeTypeIdByCode.get(GRADE_TYPE_CODES.partial)!;
		const idFinal = lookups.gradeTypeIdByCode.get(GRADE_TYPE_CODES.final)!;
		const idFdm = lookups.gradeTypeIdByCode.get(GRADE_TYPE_CODES.fdm)!;
		const idReal = lookups.gradeTypeIdByCode.get(GRADE_TYPE_CODES.real)!;

		for (let i = 0; i < resolved.length; i++) {
			const r = resolved[i];
			const raw = rows[i];
			const cells = [
				{ gtId: idPartial, value: parseGrade(raw.partialGrade) },
				{ gtId: idFinal, value: parseGrade(raw.finalGrade) },
				{ gtId: idFdm, value: parseGrade(raw.fdmGrade) },
				{ gtId: idReal, value: parseGrade(raw.realGrade) },
			];
			for (const c of cells) {
				if (c.value === null) continue; // omitir notas vacías/no parseables (matches comportamiento legacy)
				await manager.query(
					`INSERT INTO academic.student_course_grades
					 (student_section_enrollment_id, grade_type_id, grade, grade_type_percentage, extra, is_active, created_at, updated_at)
					 VALUES ($1, $2, $3, 0,
					         jsonb_build_object('grade_upload_log_id', $4::bigint),
					         true, NOW(), NOW())`,
					[r.sseId, c.gtId, c.value, uploadLogId],
				);
			}
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedGradesRcRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 8;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
