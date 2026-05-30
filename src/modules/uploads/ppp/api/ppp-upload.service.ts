import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { PppUploadValidation, PppLookups, ResolvedPppRow } from '../core/ppp-upload.validation';
import type { PppUploadDto } from '../model/ppp-upload.dtos';
import { PppRow, UploadResult, buildSurveyInformation } from '../model/ppp-upload.types';
import { pppUploadStrings } from '../config/strings/ppp-upload.validation';

const UPLOAD_TYPE = 'PPP';
const SURVEY_TYPE_GROUP_CODE = 'SURVEY_TYPE';
const SURVEY_STATUS_GROUP_CODE = 'SURVEY_STATUS';

@Injectable()
export class PppUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(fileBuffer: Buffer, fileName: string, dto: PppUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, rows);
			const resolved = PppUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: pppUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: pppUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertSurveys(queryRunner.manager, resolved, rows, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: pppUploadStrings.result.uploadSuccess,
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

	// evidence.surveys / survey.scores no tienen upload_log_id (no en §14.10). Stamp en extra.
	// TODO: implementar regla 23% (manifiesto §14.7) — generación automática de improvement.findings.
	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await queryRunner.manager.query(
				`DELETE FROM survey.scores WHERE (extra->>'survey_upload_log_id')::bigint = $1`,
				[uploadLogId],
			);
			await queryRunner.manager.query(
				`DELETE FROM evidence.surveys WHERE (extra->>'survey_upload_log_id')::bigint = $1`,
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

	private parseWorkbook(workbook: ExcelJS.Workbook): PppRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: PppRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				surveyTypeCode: this.cell(row, 1),
				surveyStatusCode: this.cell(row, 2),
				studentCode: this.cell(row, 3),
				academicPeriodCode: this.cell(row, 4),
				campusCode: this.cell(row, 5),
				programCode: this.cell(row, 6),
				surveyNumber: this.cell(row, 7),
				razonSocial: this.cell(row, 8),
				nombreJefe: this.cell(row, 9),
				cargoJefe: this.cell(row, 10),
				telefonoJefe: this.cell(row, 11),
				correoJefe: this.cell(row, 12),
				ruc: this.cell(row, 13),
				totalHoras: this.cell(row, 14),
				numeroInforme: this.cell(row, 15),
				fechaInicio: this.cell(row, 16),
				fechaFin: this.cell(row, 17),
				comentario: this.cell(row, 18),
				outcomeCode: this.cell(row, 19),
				score: this.cell(row, 20),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, rows: PppRow[]): Promise<PppLookups> {
		const studentCodes = [...new Set(rows.map((r) => r.studentCode).filter(Boolean))];
		const periodCodes = [...new Set(rows.map((r) => r.academicPeriodCode).filter(Boolean))];
		const campusCodes = [...new Set(rows.map((r) => r.campusCode).filter(Boolean))];
		const programCodes = [...new Set(rows.map((r) => r.programCode).filter(Boolean))];

		const surveyTypes: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id WHERE g.code = $1`,
			[SURVEY_TYPE_GROUP_CODE],
		);
		const surveyStatuses: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id WHERE g.code = $1`,
			[SURVEY_STATUS_GROUP_CODE],
		);
		const students: Array<{ id: number; code: string }> = studentCodes.length
			? await manager.query(
					`SELECT st.id, st.code FROM academic.students st WHERE st.code = ANY($1)`,
					[studentCodes],
				)
			: [];
		const periods: Array<{ id: number; code: string }> = periodCodes.length
			? await manager.query('SELECT id, code FROM academic.academic_periods WHERE code = ANY($1)', [periodCodes])
			: [];
		const campuses: Array<{ id: number; code: string }> = campusCodes.length
			? await manager.query('SELECT id, code FROM organization.campuses WHERE code = ANY($1)', [campusCodes])
			: [];
		const programs: Array<{ id: number; code: string }> = programCodes.length
			? await manager.query('SELECT id, code FROM academic.programs WHERE code = ANY($1)', [programCodes])
			: [];
		// outcomes matched by (outcome_code + program_code) via program_commissions chain — frágil (MAPEO Bug #15).
		const outcomes: Array<{ id: number; outcome_code: string; program_code: string }> = programCodes.length
			? await manager.query(
					`SELECT o.id, o.outcome_code, p.code AS program_code
					 FROM accreditation.outcomes o
					 JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
					 JOIN academic.programs p ON p.id = pc.program_id
					 WHERE p.code = ANY($1)`,
					[programCodes],
				)
			: [];

		return {
			surveyTypeIdByCode: new Map(surveyTypes.map((t) => [t.code, t.id])),
			surveyStatusTypeIdByCode: new Map(surveyStatuses.map((t) => [t.code, t.id])),
			studentIdByCode: new Map(students.map((s) => [s.code, s.id])),
			academicPeriodIdByCode: new Map(periods.map((p) => [p.code, p.id])),
			campusIdByCode: new Map(campuses.map((c) => [c.code, c.id])),
			programIdByCode: new Map(programs.map((p) => [p.code, p.id])),
			outcomeIdByKey: new Map(outcomes.map((o) => [`${o.outcome_code}|${o.program_code}`, o.id])),
		};
	}

	// Group rows by (surveyNumber|studentId|academicPeriodId|programId): 1 survey + N scores.
	private async insertSurveys(manager: EntityManager, resolved: ResolvedPppRow[], rows: PppRow[], uploadLogId: number): Promise<void> {
		const surveyIdByKey = new Map<string, number>();

		for (let i = 0; i < resolved.length; i++) {
			const r = resolved[i];
			const raw = rows[i];
			const key = `${r.surveyNumber}|${r.studentId}|${r.academicPeriodId}|${r.programId}`;

			let surveyId = surveyIdByKey.get(key);
			if (surveyId === undefined) {
				const info = buildSurveyInformation(raw);
				const ins: Array<{ id: number }> = await manager.query(
					`INSERT INTO evidence.surveys
					 (survey_type_id, survey_status_type_id, student_id, academic_period_id, campus_id, program_id, survey_number, information, course_section_id, extra, is_active, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb,
					         -- course_section_id es NOT NULL (canónico); se resuelve una sección del alumno (fallback: del período).
					         COALESCE(
					           (SELECT sse.course_section_id FROM academic.student_section_enrollments sse
					            JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
					            WHERE es.student_id = $3 LIMIT 1),
					           (SELECT cs.id FROM academic.course_sections cs
					            JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
					            JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
					            WHERE spap.academic_period_id = $4 LIMIT 1)
					         ),
					         jsonb_build_object('survey_upload_log_id', $9::bigint),
					         true, NOW(), NOW())
					 RETURNING id`,
					[
						r.surveyTypeId,
						r.surveyStatusTypeId,
						r.studentId,
						r.academicPeriodId,
						r.campusId,
						r.programId,
						Number(r.surveyNumber) || 0,
						JSON.stringify(info),
						uploadLogId,
					],
				);
				surveyId = ins[0].id;
				surveyIdByKey.set(key, surveyId);
			}

			await manager.query(
				`INSERT INTO survey.scores
				 (survey_id, outcome_id, score, commentaries, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, '{}'::jsonb,
				         jsonb_build_object('survey_upload_log_id', $4::bigint),
				         true, NOW(), NOW())`,
				[surveyId, r.outcomeId, r.score, uploadLogId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedPppRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 21;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
