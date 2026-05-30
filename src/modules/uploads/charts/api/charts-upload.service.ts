import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { ChartsUploadValidation, ChartsLookups, ResolvedChartRow } from '../core/charts-upload.validation';
import type { ChartsUploadDto } from '../model/charts-upload.dtos';
import { ChartRow, UploadResult } from '../model/charts-upload.types';
import { chartsUploadStrings } from '../config/strings/charts-upload.validation';

const UPLOAD_TYPE = 'ORGANIGRAMA';
const ENTITY_TYPE_GROUP_CODE = 'ENTITY_TYPE';

@Injectable()
export class ChartsUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	async processUpload(fileBuffer: Buffer, fileName: string, dto: ChartsUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = ChartsUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: chartsUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: chartsUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertCharts(queryRunner.manager, resolved, dto.academic_period_id, lookups, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: chartsUploadStrings.result.uploadSuccess,
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
			// Limpia primero root_chart_detail_id de hijos cargados por este log,
			// luego borra los nodos (evita FK auto-referencial sin orden).
			await queryRunner.manager.query('UPDATE organization.charts SET root_chart_detail_id = NULL WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM organization.charts WHERE upload_log_id = $1', [uploadLogId]);
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

	private parseWorkbook(workbook: ExcelJS.Workbook): ChartRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: ChartRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			rows.push({
				rowNumber,
				entityCode: this.cell(row, 1),
				name: this.cell(row, 2),
				level: this.cell(row, 3),
				entityTypeCode: this.cell(row, 4),
				responsibleUserName: this.cell(row, 5),
				campusCode: this.cell(row, 6),
				parentEntityCode: this.cell(row, 7),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: ChartRow[]): Promise<ChartsLookups> {
		const responsibleCodes = [...new Set(rows.map((r) => (r.responsibleUserName ?? '').trim()).filter(Boolean))];
		const campusCodes = [...new Set(rows.map((r) => (r.campusCode ?? '').trim()).filter(Boolean))];
		const rowEntityCodes = new Set(rows.map((r) => (r.entityCode ?? '').trim()).filter(Boolean));

		const chartLevels: Array<{ id: number; level: number }> = await manager.query('SELECT id, level FROM organization.chart_levels');
		const entityTypes: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1`,
			[ENTITY_TYPE_GROUP_CODE],
		);
		// Canonical schema: el código vive en academic.professors.code; resolvemos el staff_id del
		// responsable a través del docente (los responsables de organigrama son docentes/coordinadores).
		const staff: Array<{ id: number; code: string }> = responsibleCodes.length
			? await manager.query(
					'SELECT p.staff_id AS id, p.code FROM academic.professors p WHERE p.code = ANY($1)',
					[responsibleCodes],
				)
			: [];
		const campuses: Array<{ id: number; code: string }> = campusCodes.length
			? await manager.query('SELECT id, code FROM organization.campuses WHERE code = ANY($1)', [campusCodes])
			: [];
		const existing: Array<{ id: number; entity_code: string }> = await manager.query(
			'SELECT id, entity_code::varchar AS entity_code FROM organization.charts WHERE academic_period_id = $1',
			[academicPeriodId],
		);

		return {
			chartLevelIdByLevel: new Map(chartLevels.map((c) => [c.level, c.id])),
			entityTypeIdByCode: new Map(entityTypes.map((t) => [t.code, t.id])),
			staffIdByCode: new Map(staff.map((s) => [s.code, s.id])),
			campusIdByCode: new Map(campuses.map((c) => [c.code, c.id])),
			existingChartIdByEntityCode: new Map(existing.map((e) => [e.entity_code, e.id])),
			rowEntityCodes,
		};
	}

	// INSERT en 2 pases (réplica de AddRange+UpdateRange del legacy):
	//   pase 1: INSERT con root_chart_detail_id=NULL, captura id por entity_code.
	//   pase 2: UPDATE root_chart_detail_id resolviendo padre desde el lote o desde BD pre-existente.
	private async insertCharts(
		manager: EntityManager,
		resolved: ResolvedChartRow[],
		academicPeriodId: number,
		lookups: ChartsLookups,
		uploadLogId: number,
	): Promise<void> {
		const insertedIdByEntityCode = new Map<string, number>();

		for (const r of resolved) {
			const inserted: Array<{ id: number }> = await manager.query(
				`INSERT INTO organization.charts
				 (entity_code, level_title, chart_level_id, entity_type_id, staff_id, academic_period_id, root_chart_detail_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, jsonb_build_object('es', $2::text, 'en', NULL), $3, $4, $5, $6, NULL, $7, '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id`,
				[r.entityCode, r.name, r.chartLevelId, r.entityTypeId, r.staffId, academicPeriodId, uploadLogId],
			);
			insertedIdByEntityCode.set(r.entityCode!, inserted[0].id);
		}

		// Pase 2: resolver padre por entity_code (primero del lote, luego de BD pre-existente).
		for (const r of resolved) {
			if (!r.parentEntityCode) continue;
			const parentId = insertedIdByEntityCode.get(r.parentEntityCode) ?? lookups.existingChartIdByEntityCode.get(r.parentEntityCode);
			if (parentId === undefined) continue;
			const myId = insertedIdByEntityCode.get(r.entityCode!);
			await manager.query('UPDATE organization.charts SET root_chart_detail_id = $1 WHERE id = $2', [parentId, myId]);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedChartRow[]): Promise<string> {
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
