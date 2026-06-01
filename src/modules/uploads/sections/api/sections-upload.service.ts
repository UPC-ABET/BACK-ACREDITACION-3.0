import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { SectionsUploadValidation, SectionsLookups, ResolvedSectionRow } from '../core/sections-upload.validation';
import type { SectionsUploadDto } from '../model/sections-upload.dtos';
import { SectionRow, UploadResult, STUDY_TYPE_TO_MODALITY_CODE } from '../model/sections-upload.types';
import { sectionsUploadStrings } from '../config/strings/sections-upload.validation';

const UPLOAD_TYPE_SECCION = 'SECCION';
const MODALITY_GROUP_CODE = 'MODALITY_TYPE';

@Injectable()
export class SectionsUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	// Punto de entrada: réplica de SectionsDataProcessor + USP_SeccionCargaMasiva (ABET 2.0).
	async processUpload(fileBuffer: Buffer, fileName: string, dto: SectionsUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = SectionsUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			// ALL-OR-NOTHING: si CUALQUIER fila falla, no se inserta nada (igual que el SP).
			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: sectionsUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: sectionsUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE_SECCION, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id as number, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertSections(queryRunner.manager, resolved, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: sectionsUploadStrings.result.uploadSuccess,
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

	// Réplica de USP_Rollback_Seccion: borra hijos→padres por upload_log_id, en transacción.
	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await queryRunner.manager.query('DELETE FROM academic.section_professors WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM academic.course_sections WHERE upload_log_id = $1', [uploadLogId]);
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

	private parseWorkbook(workbook: ExcelJS.Workbook): SectionRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: SectionRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return; // encabezado
			rows.push({
				rowNumber,
				courseCode: this.cell(row, 1),
				sectionCode: this.cell(row, 2),
				professorCode: this.cell(row, 3),
				campusCode: this.cell(row, 4),
				studyType: this.cell(row, 5),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	// Carga set-based de todos los lookups (1 query por dimensión, sin N+1).
	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: SectionRow[]): Promise<SectionsLookups> {
		const courseCodes = [...new Set(rows.map((r) => r.courseCode).filter(Boolean))];
		const professorCodes = [...new Set(rows.map((r) => r.professorCode).filter(Boolean))];
		const campusCodes = [...new Set(rows.map((r) => r.campusCode).filter(Boolean))];
		const modalityCodes = Object.values(STUDY_TYPE_TO_MODALITY_CODE);

		const courses: Array<{ id: number; code: string }> = await manager.query('SELECT id, code FROM academic.courses WHERE code = ANY($1)', [courseCodes]);
		const campuses: Array<{ id: number; code: string }> = await manager.query('SELECT id, code FROM organization.campuses WHERE code = ANY($1)', [campusCodes]);
		// Canonical schema: el código del docente vive en academic.professors.code (no en staff).
		const professors: Array<{ id: number; code: string }> = await manager.query(
			'SELECT id, code FROM academic.professors WHERE code = ANY($1)',
			[professorCodes],
		);
		// Curso en la malla del período (regla 2 + FK para el insert).
		// TODO(parity): confirmar el mapeo periodo→study_plan_academic_period si una carrera tiene varias mallas activas.
		const courseIds = courses.map((c) => c.id);
		const studyPlanCourses: Array<{ id: number; course_id: number }> = courseIds.length
			? await manager.query(
					`SELECT spc.id, spc.course_id
					 FROM academic.study_plan_courses spc
					 JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
					 WHERE spap.academic_period_id = $1 AND spc.course_id = ANY($2)`,
					[academicPeriodId, courseIds],
				)
			: [];
		const modalities: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.code = ANY($2)`,
			[MODALITY_GROUP_CODE, modalityCodes],
		);

		const courseIdByCode = new Map(courses.map((c) => [c.code, c.id]));
		const campusIdByCode = new Map(campuses.map((c) => [c.code, c.id]));
		const professorIdByCode = new Map(professors.map((p) => [p.code, p.id]));
		const studyPlanCourseIdByCourseId = new Map(studyPlanCourses.map((s) => [s.course_id, s.id]));
		const modalityIdByCode = new Map(modalities.map((m) => [m.code, m.id]));
		const modalityTypeIdByStudyType = new Map<string, number>();
		for (const [studyType, modalityCode] of Object.entries(STUDY_TYPE_TO_MODALITY_CODE)) {
			const id = modalityIdByCode.get(modalityCode);
			if (id !== undefined) modalityTypeIdByStudyType.set(studyType, id);
		}

		// Secciones ya existentes para dedup (regla 6).
		const spcIds = studyPlanCourses.map((s) => s.id);
		const existing: Array<{ study_plan_course_id: number; campus_id: number; section_code: string }> = spcIds.length
			? await manager.query('SELECT study_plan_course_id, campus_id, section_code FROM academic.course_sections WHERE study_plan_course_id = ANY($1)', [spcIds])
			: [];
		const existingSectionKeys = new Set(existing.map((e) => `${e.study_plan_course_id}|${e.campus_id}|${e.section_code}`));

		return { courseIdByCode, studyPlanCourseIdByCourseId, professorIdByCode, campusIdByCode, modalityTypeIdByStudyType, existingSectionKeys };
	}

	// INSERT masivo: course_sections + section_professors (is_principal=true), ambos con upload_log_id.
	private async insertSections(manager: EntityManager, resolved: ResolvedSectionRow[], uploadLogId: number): Promise<void> {
		for (const r of resolved) {
			const inserted: Array<{ id: number }> = await manager.query(
				`INSERT INTO academic.course_sections
				 (study_plan_course_id, professor_id, campus_id, section_code, schedule, section_modality_type_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, '{}'::jsonb, $5, $6, '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id`,
				[r.studyPlanCourseId, r.professorId, r.campusId, r.sectionCode, r.sectionModalityTypeId, uploadLogId],
			);
			const courseSectionId = inserted[0].id;
			await manager.query(
				`INSERT INTO academic.section_professors
				 (course_section_id, professor_id, is_principal, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, true, $3, '{}'::jsonb, true, NOW(), NOW())`,
				[courseSectionId, r.professorId, uploadLogId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedSectionRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 6;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
