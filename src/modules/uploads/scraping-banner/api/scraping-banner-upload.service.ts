import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { ScrapingBannerUploadValidation, ScrapingBannerLookups, ResolvedScrapingBannerRow } from '../core/scraping-banner-upload.validation';
import type { ScrapingBannerUploadDto } from '../model/scraping-banner-upload.dtos';
import { ScrapingBannerRow, UploadResult } from '../model/scraping-banner-upload.types';
import { scrapingBannerUploadStrings } from '../config/strings/scraping-banner-upload.validation';

const UPLOAD_TYPE = 'SCRAPING_BANNER';
const MODALITY_TYPE_GROUP_CODE = 'MODALITY_TYPE';

@Injectable()
export class ScrapingBannerUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(fileBuffer: Buffer, fileName: string, dto: ScrapingBannerUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, rows);
			const resolved = ScrapingBannerUploadValidation.validateAll(rows, lookups, dto.academic_period_id);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: scrapingBannerUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: scrapingBannerUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertAll(queryRunner.manager, resolved, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: scrapingBannerUploadStrings.result.uploadSuccess,
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
			// users no lleva upload_log_id (canónico) → capturar user_id desde students antes de borrarlos.
			const studentUsers: Array<{ user_id: number }> = await queryRunner.manager.query(
				'SELECT user_id FROM academic.students WHERE upload_log_id = $1',
				[uploadLogId],
			);
			const userIds = studentUsers.map((s) => s.user_id).filter((id) => id != null);
			await queryRunner.manager.query('DELETE FROM academic.student_section_enrollments WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM academic.course_sections WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM academic.enrolled_students WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM academic.students WHERE upload_log_id = $1', [uploadLogId]);
			if (userIds.length) {
				await queryRunner.manager.query('DELETE FROM organization.users WHERE id = ANY($1)', [userIds]);
			}
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

	private parseWorkbook(workbook: ExcelJS.Workbook): ScrapingBannerRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: ScrapingBannerRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				studentCode: this.cell(row, 1),
				firstName: this.cell(row, 2),
				lastName: this.cell(row, 3),
				institutionalEmail: this.cell(row, 4),
				personalEmail: this.cell(row, 5),
				mobilePhone: this.cell(row, 6),
				programCode: this.cell(row, 7),
				graduationModalityCode: this.cell(row, 8),
				academicPeriodCode: this.cell(row, 9),
				campusCode: this.cell(row, 10),
				enrollmentModalityCode: this.cell(row, 11),
				sectionCode: this.cell(row, 12),
				courseCodeFull: this.cell(row, 13),
				professorCode: this.cell(row, 14),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, rows: ScrapingBannerRow[]): Promise<ScrapingBannerLookups> {
		const programCodes = [...new Set(rows.map((r) => r.programCode).filter(Boolean))];
		const periodCodes = [...new Set(rows.map((r) => r.academicPeriodCode).filter(Boolean))];
		const campusCodes = [...new Set(rows.map((r) => r.campusCode).filter(Boolean))];
		const courseCodes = [...new Set(rows.map((r) => r.courseCodeFull).filter(Boolean))];
		const profCodes = [...new Set(rows.map((r) => r.professorCode).filter(Boolean))];

		const programs: Array<{ id: number; code: string }> = programCodes.length
			? await manager.query('SELECT id, code FROM academic.programs WHERE code = ANY($1)', [programCodes])
			: [];
		const periods: Array<{ id: number; code: string }> = periodCodes.length
			? await manager.query('SELECT id, code FROM academic.academic_periods WHERE code = ANY($1)', [periodCodes])
			: [];
		const campuses: Array<{ id: number; code: string }> = campusCodes.length
			? await manager.query('SELECT id, code FROM organization.campuses WHERE code = ANY($1)', [campusCodes])
			: [];
		const courses: Array<{ id: number; code: string }> = courseCodes.length
			? await manager.query('SELECT id, code FROM academic.courses WHERE code = ANY($1)', [courseCodes])
			: [];
		const profs: Array<{ id: number; code: string }> = profCodes.length
			? await manager.query('SELECT id, code FROM academic.professors WHERE code = ANY($1)', [profCodes])
			: [];
		const modalities: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1`,
			[MODALITY_TYPE_GROUP_CODE],
		);

		return {
			programIdByCode: new Map(programs.map((p) => [p.code, p.id])),
			academicPeriodIdByCode: new Map(periods.map((p) => [p.code, p.id])),
			campusIdByCode: new Map(campuses.map((c) => [c.code, c.id])),
			courseIdByCode: new Map(courses.map((c) => [c.code, c.id])),
			professorIdByCode: new Map(profs.map((p) => [p.code, p.id])),
			modalityTypeIdByCode: new Map(modalities.map((m) => [m.code, m.id])),
		};
	}

	// 5 tablas en cadena. Caches en memoria para upsert por code dentro del lote.
	private async insertAll(manager: EntityManager, resolved: ResolvedScrapingBannerRow[], uploadLogId: number): Promise<void> {
		const userIdByCode = new Map<string, number>();
		const studentIdByCode = new Map<string, number>();
		const enrolledIdByKey = new Map<string, number>(); // `${studentCode}|${academicPeriodId}` → SSE-padre
		const courseSectionIdByKey = new Map<string, number>(); // `${courseId}|${sectionCode}|${academicPeriodId}` → cs.id

		// document_type_id NOT NULL (canónico) → DNI por defecto.
		const docType: Array<{ id: number }> = await manager.query(
			`SELECT t.id FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = 'DOC_TYPE' AND t.code = 'DNI' LIMIT 1`,
		);
		const docTypeIdDni = docType[0]?.id ?? null;

		for (const r of resolved) {
			// 1) user — sin code (el code del alumno vive en academic.students.code) y sin upload_log_id
			// (canónico); NOT NULL rellenados con neutrales.
			let userId = userIdByCode.get(r.studentCode!);
			if (userId === undefined) {
				const ins: Array<{ id: number }> = await manager.query(
					`INSERT INTO organization.users
					 (document_type_id, document_code, first_name, last_name, email, phone, password, extra, is_active, created_at, updated_at)
					 VALUES ($1, 0, $2, $3, $4, '-', 'ABET', '{}'::jsonb, true, NOW(), NOW())
					 RETURNING id`,
					[docTypeIdDni, r.firstName, r.lastName, r.email],
				);
				userId = ins[0].id;
				userIdByCode.set(r.studentCode!, userId);
			}

			// 2) student — upsert por students.code (clave natural del alumno)
			let studentId = studentIdByCode.get(r.studentCode!);
			if (studentId === undefined) {
				const ex: Array<{ id: number }> = await manager.query('SELECT id FROM academic.students WHERE code = $1', [r.studentCode]);
				studentId = ex[0]?.id;
				if (studentId === undefined) {
					const ins: Array<{ id: number }> = await manager.query(
						`INSERT INTO academic.students (code, user_id, program_id, graduation_modality_type_id, upload_log_id, extra, is_active, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, true, NOW(), NOW())
						 RETURNING id`,
						[r.studentCode, userId, r.programId, r.graduationModalityId, uploadLogId],
					);
					studentId = ins[0].id;
				}
				studentIdByCode.set(r.studentCode!, studentId);
			}

			// 3) enrolled_student (por estudiante × periodo)
			const enrolledKey = `${r.studentCode}|${r.academicPeriodId}`;
			let enrolledId = enrolledIdByKey.get(enrolledKey);
			if (enrolledId === undefined) {
				// study_plan_academic_period_id: por programa+período (igual que enrolled-students).
				const spap: Array<{ id: number }> = await manager.query(
					`SELECT spap.id FROM academic.study_plan_academic_periods spap
					 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
					 WHERE spap.academic_period_id = $1 AND sp.program_id = $2 LIMIT 1`,
					[r.academicPeriodId, r.programId],
				);
				const spapId = spap[0]?.id ?? null;
				const ins: Array<{ id: number }> = await manager.query(
					`INSERT INTO academic.enrolled_students
					 (student_id, study_plan_academic_period, campus_id, enrollement_modality_type_id, upload_log_id, extra, is_active, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, true, NOW(), NOW())
					 RETURNING id`,
					[studentId, spapId, r.campusId, r.enrollmentModalityId, uploadLogId],
				);
				enrolledId = ins[0].id;
				enrolledIdByKey.set(enrolledKey, enrolledId);
			}

			// 4) course_section (por curso × sectionCode × periodo)
			const csKey = `${r.courseId}|${r.sectionCode}|${r.academicPeriodId}`;
			let courseSectionId = courseSectionIdByKey.get(csKey);
			if (courseSectionId === undefined) {
				const spc: Array<{ id: number }> = await manager.query(
					`SELECT spc.id FROM academic.study_plan_courses spc
					 JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
					 WHERE spap.academic_period_id = $1 AND spc.course_id = $2 LIMIT 1`,
					[r.academicPeriodId, r.courseId],
				);
				const spcId = spc[0]?.id ?? null;
				const ex: Array<{ id: number }> = await manager.query(
					`SELECT cs.id FROM academic.course_sections cs
					 WHERE cs.study_plan_course_id = $1 AND cs.campus_id = $2 AND cs.section_code = $3`,
					[spcId, r.campusId, r.sectionCode],
				);
				courseSectionId = ex[0]?.id;
				if (courseSectionId === undefined) {
					const ins: Array<{ id: number }> = await manager.query(
						`INSERT INTO academic.course_sections
						 (study_plan_course_id, professor_id, campus_id, section_code, schedule, section_modality_type_id, upload_log_id, extra, is_active, created_at, updated_at)
						 VALUES ($1, $2, $3, $4, '{}'::jsonb, $5, $6, '{}'::jsonb, true, NOW(), NOW())
						 RETURNING id`,
						[spcId, r.professorId, r.campusId, r.sectionCode, r.enrollmentModalityId, uploadLogId],
					);
					courseSectionId = ins[0].id;
				}
				courseSectionIdByKey.set(csKey, courseSectionId);
			}

			// 5) student_section_enrollment
			await manager.query(
				`INSERT INTO academic.student_section_enrollments
				 (enrolled_student_id, course_section_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, '{}'::jsonb, true, NOW(), NOW())
				 ON CONFLICT DO NOTHING`,
				[enrolledId, courseSectionId, uploadLogId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedScrapingBannerRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 15;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
