import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { OutcomesUploadValidation, OutcomesLookups, ResolvedOutcomeRow } from '../core/outcomes-upload.validation';
import type { OutcomesUploadDto } from '../model/outcomes-upload.dtos';
import { OutcomeRow, UploadResult } from '../model/outcomes-upload.types';
import { outcomesUploadStrings } from '../config/strings/outcomes-upload.validation';

const UPLOAD_TYPE = 'MALLA_COCOS';
const OUTCOME_COURSE_TYPE_GROUP_CODE = 'OUTCOME_COURSE_TYPE';

@Injectable()
export class OutcomesUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(fileBuffer: Buffer, fileName: string, dto: OutcomesUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = OutcomesUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: outcomesUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: outcomesUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertOutcomes(queryRunner.manager, resolved, rows, dto.academic_period_id, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: outcomesUploadStrings.result.uploadSuccess,
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

	// Rollback: solo borra outcomes + course_outcome_mappings (las 2 tablas con upload_log_id según §14.10).
	// accreditors/commissions/program_commissions son catálogo — quedan persistidos (no se rollbackean).
	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await queryRunner.manager.query('DELETE FROM academic.course_outcome_mappings WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM accreditation.outcomes WHERE upload_log_id = $1', [uploadLogId]);
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

	private parseWorkbook(workbook: ExcelJS.Workbook): OutcomeRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: OutcomeRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				accreditorCode: this.cell(row, 1),
				commissionCode: this.cell(row, 2),
				programCode: this.cell(row, 3),
				studyPlanCode: this.cell(row, 4),
				courseCode: this.cell(row, 5),
				outcomeCode: this.cell(row, 6),
				outcomeNameEn: this.cell(row, 7),
				outcomeDescription: this.cell(row, 8),
				outcomeTypeCode: this.cell(row, 9),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: OutcomeRow[]): Promise<OutcomesLookups> {
		const programCodes = [...new Set(rows.map((r) => (r.programCode ?? '').trim()).filter(Boolean))];
		const planCodes = [...new Set(rows.map((r) => (r.studyPlanCode ?? '').trim()).filter(Boolean))];

		const programs: Array<{ id: number; code: string }> = programCodes.length
			? await manager.query('SELECT id, code FROM academic.programs WHERE code = ANY($1)', [programCodes])
			: [];
		const spcs: Array<{ id: number; plan_code: string; course_code: string }> = planCodes.length
			? await manager.query(
					`SELECT spc.id, sp.code AS plan_code, c.code AS course_code
					 FROM academic.study_plan_courses spc
					 JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
					 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
					 JOIN academic.courses c ON c.id = spc.course_id
					 WHERE spap.academic_period_id = $1 AND sp.code = ANY($2)`,
					[academicPeriodId, planCodes],
				)
			: [];
		const types: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1`,
			[OUTCOME_COURSE_TYPE_GROUP_CODE],
		);
		const spcIds = spcs.map((s) => s.id);
		const existing: Array<{ outcome_code: string; study_plan_course_id: number }> = spcIds.length
			? await manager.query(
					`SELECT o.outcome_code, com.study_plan_course_id
					 FROM academic.course_outcome_mappings com
					 JOIN accreditation.outcomes o ON o.id = com.outcome_id
					 WHERE com.study_plan_course_id = ANY($1)`,
					[spcIds],
				)
			: [];

		return {
			programIdByCode: new Map(programs.map((p) => [p.code, p.id])),
			spcIdByPlanCourse: new Map(spcs.map((s) => [`${s.plan_code}|${s.course_code}`, s.id])),
			outcomeTypeIdByCode: new Map(types.map((t) => [t.code, t.id])),
			existingMappingKeys: new Set(existing.map((e) => `${e.outcome_code}|${e.study_plan_course_id}`)),
		};
	}

	// 4 fases:
	//   1) accreditors/commissions/program_commissions — upsert catálogo (sin upload_log_id).
	//   2) outcomes — INSERT con upload_log_id (uno por outcome_code × program_commission).
	//   3) course_outcome_mappings — INSERT con upload_log_id (uno por fila).
	private async insertOutcomes(
		manager: EntityManager,
		resolved: ResolvedOutcomeRow[],
		rows: OutcomeRow[],
		academicPeriodId: number,
		uploadLogId: number,
	): Promise<void> {
		const accreditorIdByCode = new Map<string, number>();
		const commissionIdByKey = new Map<string, number>(); // `${accreditorCode}|${commissionCode}` → id
		const programCommissionIdByKey = new Map<string, number>(); // `${commissionId}|${programId}|${period}` → id
		const outcomeIdByKey = new Map<string, number>(); // `${outcomeCode}|${programCommissionId}` → id

		for (let i = 0; i < resolved.length; i++) {
			const r = resolved[i];
			const raw = rows[i];

			// 1a) accreditor
			let accreditorId = accreditorIdByCode.get(r.accreditorCode!);
			if (accreditorId === undefined) {
				const ex: Array<{ id: number }> = await manager.query('SELECT id FROM accreditation.accreditors WHERE code = $1', [r.accreditorCode]);
				accreditorId = ex[0]?.id;
				if (accreditorId === undefined) {
					const ins: Array<{ id: number }> = await manager.query(
						`INSERT INTO accreditation.accreditors (code, name, extra, is_active, created_at, updated_at)
						 VALUES ($1, '{}'::jsonb, '{}'::jsonb, true, NOW(), NOW())
						 RETURNING id`,
						[r.accreditorCode],
					);
					accreditorId = ins[0].id;
				}
				accreditorIdByCode.set(r.accreditorCode!, accreditorId);
			}

			// 1b) commission
			const commKey = `${r.accreditorCode}|${r.commissionCode}`;
			let commissionId = commissionIdByKey.get(commKey);
			if (commissionId === undefined) {
				const ex: Array<{ id: number }> = await manager.query(
					'SELECT id FROM accreditation.commissions WHERE accreditor_id = $1 AND code = $2',
					[accreditorId, r.commissionCode],
				);
				commissionId = ex[0]?.id;
				if (commissionId === undefined) {
					const ins: Array<{ id: number }> = await manager.query(
						`INSERT INTO accreditation.commissions (accreditor_id, code, name, extra, is_active, created_at, updated_at)
						 VALUES ($1, $2, '{}'::jsonb, '{}'::jsonb, true, NOW(), NOW())
						 RETURNING id`,
						[accreditorId, r.commissionCode],
					);
					commissionId = ins[0].id;
				}
				commissionIdByKey.set(commKey, commissionId);
			}

			// 1c) program_commission
			const pcKey = `${commissionId}|${r.programId}|${academicPeriodId}`;
			let programCommissionId = programCommissionIdByKey.get(pcKey);
			if (programCommissionId === undefined) {
				const ex: Array<{ id: number }> = await manager.query(
					'SELECT id FROM accreditation.program_commissions WHERE commission_id = $1 AND program_id = $2 AND academic_period_id = $3',
					[commissionId, r.programId, academicPeriodId],
				);
				programCommissionId = ex[0]?.id;
				if (programCommissionId === undefined) {
					// commission_type_id es FK NOT NULL al catálogo COMMISSION_TYPE (resuelto inline).
					const ins: Array<{ id: number }> = await manager.query(
						`INSERT INTO accreditation.program_commissions
						 (commission_id, program_id, academic_period_id, commission_type_id, extra, is_active, created_at, updated_at)
						 VALUES ($1, $2, $3,
						   (SELECT t.id FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id WHERE g.code = 'COMMISSION_TYPE' LIMIT 1),
						   '{}'::jsonb, true, NOW(), NOW())
						 RETURNING id`,
						[commissionId, r.programId, academicPeriodId],
					);
					programCommissionId = ins[0].id;
				}
				programCommissionIdByKey.set(pcKey, programCommissionId);
			}

			// 2) outcome
			const outcomeKey = `${r.outcomeCode}|${programCommissionId}`;
			let outcomeId = outcomeIdByKey.get(outcomeKey);
			if (outcomeId === undefined) {
				const ex: Array<{ id: number }> = await manager.query(
					'SELECT id FROM accreditation.outcomes WHERE outcome_code = $1 AND program_commission_id = $2',
					[r.outcomeCode, programCommissionId],
				);
				outcomeId = ex[0]?.id;
				if (outcomeId === undefined) {
					const ins: Array<{ id: number }> = await manager.query(
						`INSERT INTO accreditation.outcomes
						 (outcome_code, outcome_name, outcome_description, program_commission_id, upload_log_id, extra, is_active, created_at, updated_at)
						 VALUES ($1,
						         jsonb_build_object('es', NULL, 'en', $2::text),
						         jsonb_build_object('es', $3::text, 'en', NULL),
						         $4, $5, '{}'::jsonb, true, NOW(), NOW())
						 RETURNING id`,
						[r.outcomeCode, raw.outcomeNameEn, raw.outcomeDescription, programCommissionId, uploadLogId],
					);
					outcomeId = ins[0].id;
				}
				outcomeIdByKey.set(outcomeKey, outcomeId);
			}

			// 3) course_outcome_mapping
			await manager.query(
				`INSERT INTO academic.course_outcome_mappings
				 (outcome_id, study_plan_course_id, outcome_type_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, '{}'::jsonb, true, NOW(), NOW())`,
				[outcomeId, r.spcId, r.outcomeTypeId, uploadLogId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedOutcomeRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 10;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
