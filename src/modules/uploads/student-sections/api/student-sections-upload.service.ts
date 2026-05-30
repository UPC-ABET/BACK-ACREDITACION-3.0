import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { StudentSectionsUploadValidation, StudentSectionsLookups, ResolvedStudentSectionRow } from '../core/student-sections-upload.validation';
import type { StudentSectionsUploadDto } from '../model/student-sections-upload.dtos';
import { StudentSectionRow, UploadResult } from '../model/student-sections-upload.types';
import { studentSectionsUploadStrings } from '../config/strings/student-sections-upload.validation';

const UPLOAD_TYPE = 'ALUMNOS_POR_SECCION';

@Injectable()
export class StudentSectionsUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(fileBuffer: Buffer, fileName: string, dto: StudentSectionsUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = StudentSectionsUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: studentSectionsUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: studentSectionsUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertEnrollments(queryRunner.manager, resolved, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: studentSectionsUploadStrings.result.uploadSuccess,
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

	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await queryRunner.manager.query('DELETE FROM academic.student_section_enrollments WHERE upload_log_id = $1', [uploadLogId]);
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

	private parseWorkbook(workbook: ExcelJS.Workbook): StudentSectionRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: StudentSectionRow[] = [];
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

	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: StudentSectionRow[]): Promise<StudentSectionsLookups> {
		const courseCodes = [...new Set(rows.map((r) => r.courseCode).filter(Boolean))];
		const studentCodes = [...new Set(rows.map((r) => r.studentCode).filter(Boolean))];

		// course_sections del período, llaveadas por código de curso + código de sección.
		const sections: Array<{ id: number; course_code: string; section_code: string }> = courseCodes.length
			? await manager.query(
					`SELECT cs.id, c.code AS course_code, cs.section_code
					 FROM academic.course_sections cs
					 JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
					 JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
					 JOIN academic.courses c ON c.id = spc.course_id
					 WHERE spap.academic_period_id = $1 AND c.code = ANY($2)`,
					[academicPeriodId, courseCodes],
				)
			: [];

		// enrolled_students del período, llaveados por código de alumno.
		const enrolled: Array<{ id: number; code: string }> = studentCodes.length
			? await manager.query(
					`SELECT es.id, st.code
					 FROM academic.enrolled_students es
					 JOIN academic.students st ON st.id = es.student_id
					 JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period
					 WHERE spap.academic_period_id = $1 AND st.code = ANY($2)`,
					[academicPeriodId, studentCodes],
				)
			: [];

		const courseSectionIds = sections.map((s) => s.id);
		const existing: Array<{ enrolled_student_id: number; course_section_id: number }> = courseSectionIds.length
			? await manager.query(
					'SELECT enrolled_student_id, course_section_id FROM academic.student_section_enrollments WHERE course_section_id = ANY($1)',
					[courseSectionIds],
				)
			: [];

		return {
			courseSectionIdByKey: new Map(sections.map((s) => [`${s.course_code}|${s.section_code}`, s.id])),
			enrolledStudentIdByCode: new Map(enrolled.map((e) => [e.code, e.id])),
			existingEnrollmentKeys: new Set(existing.map((e) => `${e.enrolled_student_id}|${e.course_section_id}`)),
		};
	}

	private async insertEnrollments(manager: EntityManager, resolved: ResolvedStudentSectionRow[], uploadLogId: number): Promise<void> {
		for (const r of resolved) {
			await manager.query(
				`INSERT INTO academic.student_section_enrollments
				 (enrolled_student_id, course_section_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, '{}'::jsonb, true, NOW(), NOW())`,
				[r.enrolledStudentId, r.courseSectionId, uploadLogId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedStudentSectionRow[]): Promise<string> {
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
