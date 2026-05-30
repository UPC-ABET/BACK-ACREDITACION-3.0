import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { GradesBannerUploadValidation, GradesBannerLookups, ResolvedGradesBannerRow } from '../core/grades-banner-upload.validation';
import type { GradesBannerUploadDto } from '../model/grades-banner-upload.dtos';
import { GradesBannerRow, UploadResult } from '../model/grades-banner-upload.types';
import { gradesBannerUploadStrings } from '../config/strings/grades-banner-upload.validation';

const UPLOAD_TYPE = 'SCRAPING_BANNER_NOTAS';
const GRADE_TYPE_GROUP_CODE = 'GRADE_TYPE';

@Injectable()
export class GradesBannerUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(fileBuffer: Buffer, fileName: string, dto: GradesBannerUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = GradesBannerUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: gradesBannerUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: gradesBannerUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertGrades(queryRunner.manager, resolved, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: gradesBannerUploadStrings.result.uploadSuccess,
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

	// Mismo patrón que A4 — stamp en extra.grade_upload_log_id (student_course_grades sin upload_log_id en §14.10).
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

	private parseWorkbook(workbook: ExcelJS.Workbook): GradesBannerRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: GradesBannerRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				studentCode: this.cell(row, 1),
				courseCode: this.cell(row, 2),
				sectionCode: this.cell(row, 3),
				gradeTypeCode: this.cell(row, 4),
				grade: this.cell(row, 5),
				weight: this.cell(row, 6),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: GradesBannerRow[]): Promise<GradesBannerLookups> {
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
			 WHERE g.code = $1`,
			[GRADE_TYPE_GROUP_CODE],
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

	// 1 fila → 1 INSERT (Peso explícito, a diferencia de A4).
	private async insertGrades(manager: EntityManager, resolved: ResolvedGradesBannerRow[], uploadLogId: number): Promise<void> {
		for (const r of resolved) {
			await manager.query(
				`INSERT INTO academic.student_course_grades
				 (student_section_enrollment_id, grade_type_id, grade, grade_type_percentage, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, $4,
				         jsonb_build_object('grade_upload_log_id', $5::bigint),
				         true, NOW(), NOW())`,
				[r.sseId, r.gradeTypeId, r.grade, r.weight ?? null, uploadLogId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedGradesBannerRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 7;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
