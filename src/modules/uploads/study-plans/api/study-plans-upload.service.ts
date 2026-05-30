import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { StudyPlansUploadValidation, StudyPlansLookups, ResolvedStudyPlanRow } from '../core/study-plans-upload.validation';
import type { StudyPlansUploadDto } from '../model/study-plans-upload.dtos';
import { StudyPlanRow, UploadResult, parseBooleanLike } from '../model/study-plans-upload.types';
import { studyPlansUploadStrings } from '../config/strings/study-plans-upload.validation';

const UPLOAD_TYPE = 'MALLA_CURRICULAR';
const LEVEL_TYPE_GROUP_CODE = 'LEVEL_TYPE';

@Injectable()
export class StudyPlansUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(fileBuffer: Buffer, fileName: string, dto: StudyPlansUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = StudyPlansUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: studyPlansUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: studyPlansUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertStudyPlan(queryRunner.manager, resolved, rows, dto.academic_period_id, lookups, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: studyPlansUploadStrings.result.uploadSuccess,
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

	// Réplica de USP_Rollback_MallaCurricular: borra hijos→padres por upload_log_id.
	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await queryRunner.manager.query('DELETE FROM academic.course_prerequisites WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM academic.study_plan_courses WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM academic.courses WHERE upload_log_id = $1', [uploadLogId]);
			// SPAP no lleva upload_log_id: borrar solo los que quedaron huérfanos (sin SPCs) y que
			// pertenecen a study_plans de esta carga, para poder eliminar esos study_plans.
			await queryRunner.manager.query(
				`DELETE FROM academic.study_plan_academic_periods spap
				 WHERE spap.study_plan_id IN (SELECT id FROM academic.study_plans WHERE upload_log_id = $1)
				   AND NOT EXISTS (SELECT 1 FROM academic.study_plan_courses spc WHERE spc.study_plan_academic_period_id = spap.id)`,
				[uploadLogId],
			);
			await queryRunner.manager.query('DELETE FROM academic.study_plans WHERE upload_log_id = $1', [uploadLogId]);
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

	private parseWorkbook(workbook: ExcelJS.Workbook): StudyPlanRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: StudyPlanRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				studyPlanCode: this.cell(row, 1),
				studyPlanName: this.cell(row, 2),
				programCode: this.cell(row, 3),
				courseCode: this.cell(row, 4),
				courseName: this.cell(row, 5),
				isElective: this.cell(row, 6),
				levelTypeCode: this.cell(row, 7),
				prerequisites: this.cell(row, 8),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: StudyPlanRow[]): Promise<StudyPlansLookups> {
		const programCodes = [...new Set(rows.map((r) => (r.programCode ?? '').trim()).filter(Boolean))];
		const studyPlanCodes = [...new Set(rows.map((r) => (r.studyPlanCode ?? '').trim()).filter(Boolean))];
		const rowCourseCodes = new Set(rows.map((r) => (r.courseCode ?? '').trim()).filter(Boolean));

		const programs: Array<{ id: number; code: string }> = programCodes.length
			? await manager.query('SELECT id, code FROM academic.programs WHERE code = ANY($1)', [programCodes])
			: [];
		const levels: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1`,
			[LEVEL_TYPE_GROUP_CODE],
		);
		const courses: Array<{ id: number; code: string }> = await manager.query('SELECT id, code FROM academic.courses');
		const plans: Array<{ id: number; code: string }> = studyPlanCodes.length
			? await manager.query('SELECT id, code FROM academic.study_plans WHERE code = ANY($1)', [studyPlanCodes])
			: [];
		const existingSpc: Array<{ plan_code: string; course_code: string }> = studyPlanCodes.length
			? await manager.query(
					`SELECT sp.code AS plan_code, c.code AS course_code
					 FROM academic.study_plan_courses spc
					 JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
					 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
					 JOIN academic.courses c ON c.id = spc.course_id
					 WHERE spap.academic_period_id = $1 AND sp.code = ANY($2)`,
					[academicPeriodId, studyPlanCodes],
				)
			: [];

		return {
			programIdByCode: new Map(programs.map((p) => [p.code, p.id])),
			levelTypeIdByCode: new Map(levels.map((l) => [l.code, l.id])),
			existingCourseIdByCode: new Map(courses.map((c) => [c.code.toLowerCase(), c.id])),
			existingStudyPlanIdByCode: new Map(plans.map((p) => [p.code, p.id])),
			existingSpcCodes: new Set(existingSpc.map((s) => `${s.plan_code}|${s.course_code}`)),
			rowCourseCodes,
		};
	}

	// INSERT en 4 fases (upserts por code para no duplicar plans/courses entre filas):
	//   1) study_plans (upsert por code)
	//   2) study_plan_academic_periods (upsert por (plan, periodo))
	//   3) courses (upsert por LOWER(code)) + study_plan_courses (insert por fila)
	//   4) course_prerequisites (insert por requisito)
	// TODO(parity): study_plans.name/description quedan VACÍO (Bug #3 del MAPEO); ya se reciben en Excel.
	private async insertStudyPlan(
		manager: EntityManager,
		resolved: ResolvedStudyPlanRow[],
		rows: StudyPlanRow[],
		academicPeriodId: number,
		lookups: StudyPlansLookups,
		uploadLogId: number,
	): Promise<void> {
		const planIdByCode = new Map(lookups.existingStudyPlanIdByCode);
		const courseIdByCode = new Map(lookups.existingCourseIdByCode);
		const spapIdByPlanId = new Map<number, number>();

		// Fase 1+2: planes y SPAPs por código (deduplicado entre filas del lote).
		const uniquePlans = new Map<string, { name: string; programId: number | undefined }>();
		for (const r of resolved) uniquePlans.set(r.studyPlanCode!, { name: r.studyPlanName!, programId: r.programId });

		for (const [code, info] of uniquePlans) {
			let planId = planIdByCode.get(code);
			if (planId === undefined) {
				const inserted: Array<{ id: number }> = await manager.query(
					`INSERT INTO academic.study_plans
					 (code, name, description, program_id, upload_log_id, extra, is_active, created_at, updated_at)
					 VALUES ($1, jsonb_build_object('es', $2::text, 'en', NULL), '{}'::jsonb, $3, $4, '{}'::jsonb, true, NOW(), NOW())
					 RETURNING id`,
					[code, info.name, info.programId, uploadLogId],
				);
				planId = inserted[0].id;
				planIdByCode.set(code, planId);
			}

			const spapExisting: Array<{ id: number }> = await manager.query(
				'SELECT id FROM academic.study_plan_academic_periods WHERE study_plan_id = $1 AND academic_period_id = $2 LIMIT 1',
				[planId, academicPeriodId],
			);
			let spapId = spapExisting[0]?.id;
			if (spapId === undefined) {
				// study_plan_academic_periods no lleva upload_log_id en el canónico (asociación upsert
				// compartida); no se estampa ni se borra en rollback (los SPC hijos sí por su log).
				const inserted: Array<{ id: number }> = await manager.query(
					`INSERT INTO academic.study_plan_academic_periods
					 (study_plan_id, academic_period_id, extra, is_active, created_at, updated_at)
					 VALUES ($1, $2, '{}'::jsonb, true, NOW(), NOW())
					 RETURNING id`,
					[planId, academicPeriodId],
				);
				spapId = inserted[0].id;
			}
			spapIdByPlanId.set(planId, spapId);
		}

		// Fase 3: cursos + study_plan_courses por fila.
		const spcIdByPlanCourse = new Map<string, number>();
		for (let i = 0; i < resolved.length; i++) {
			const r = resolved[i];
			const planId = planIdByCode.get(r.studyPlanCode!)!;
			const spapId = spapIdByPlanId.get(planId)!;
			const isElective = parseBooleanLike(rows[i].isElective);

			let courseId = courseIdByCode.get(r.courseCode!.toLowerCase());
			if (courseId === undefined) {
				const inserted: Array<{ id: number }> = await manager.query(
					`INSERT INTO academic.courses
					 (code, name, description, learning_outcome, upload_log_id, extra, is_active, created_at, updated_at)
					 VALUES ($1, jsonb_build_object('es', $2::text, 'en', NULL), '{}'::jsonb, '{}'::jsonb, $3, '{}'::jsonb, true, NOW(), NOW())
					 RETURNING id`,
					[r.courseCode, r.courseName, uploadLogId],
				);
				courseId = inserted[0].id;
				courseIdByCode.set(r.courseCode!.toLowerCase(), courseId);
			}

			// level_type_id es NOT NULL (canónico); si la fila no trae NivelCurso, default LEVEL_TYPE/GENERAL.
			const spc: Array<{ id: number }> = await manager.query(
				`INSERT INTO academic.study_plan_courses
				 (study_plan_academic_period_id, course_id, is_elective, level_type_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3,
				   COALESCE($4, (SELECT t.id FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id WHERE g.code = 'LEVEL_TYPE' AND t.code = 'GENERAL' LIMIT 1)),
				   $5, '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id`,
				[spapId, courseId, isElective, r.levelTypeId, uploadLogId],
			);
			spcIdByPlanCourse.set(`${r.studyPlanCode}|${r.courseCode}`, spc[0].id);
		}

		// Fase 4: prerrequisitos.
		for (const r of resolved) {
			if (!r.prerequisites || r.prerequisites.length === 0) continue;
			const planId = planIdByCode.get(r.studyPlanCode!)!;
			const courseId = courseIdByCode.get(r.courseCode!.toLowerCase())!;
			for (const prereqCode of r.prerequisites) {
				const prereqId = courseIdByCode.get(prereqCode.toLowerCase());
				if (prereqId === undefined) continue;
				await manager.query(
					`INSERT INTO academic.course_prerequisites
					 (course_id, prerequisite_course_id, is_mandatory, study_plan_id, upload_log_id, extra, is_active, created_at, updated_at)
					 VALUES ($1, $2, true, $3, $4, '{}'::jsonb, true, NOW(), NOW())`,
					[courseId, prereqId, planId, uploadLogId],
				);
			}
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedStudyPlanRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 9;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
