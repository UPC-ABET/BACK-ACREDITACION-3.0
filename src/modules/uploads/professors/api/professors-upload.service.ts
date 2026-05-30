import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { ProfessorsUploadValidation, ProfessorsLookups, ResolvedProfessorRow } from '../core/professors-upload.validation';
import type { ProfessorsUploadDto } from '../model/professors-upload.dtos';
import { ProfessorRow, UploadResult, splitProfessorName, DOCENTE_POSITION_CODE } from '../model/professors-upload.types';
import { professorsUploadStrings } from '../config/strings/professors-upload.validation';

const UPLOAD_TYPE = 'DOCENTE';
const POSITION_TYPE_GROUP_CODE = 'POSITION_TYPE';

@Injectable()
export class ProfessorsUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	// Punto de entrada: réplica de USP_DocenteCargaMasiva (transacción atómica, ALL-OR-NOTHING).
	async processUpload(fileBuffer: Buffer, fileName: string, dto: ProfessorsUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, rows);
			const resolved = ProfessorsUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: professorsUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: professorsUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertProfessors(queryRunner.manager, resolved, rows, lookups.positionTypeIdDocente!, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: professorsUploadStrings.result.uploadSuccess,
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

	// Réplica de USP_Rollback_Docente: borra hijos→padres por upload_log_id.
	async rollback(uploadLogId: number): Promise<{ success: boolean }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			// organization.users no lleva upload_log_id (canónico) → capturar los user_id del staff
			// de esta carga antes de borrar staff, para poder limpiar los users creados.
			const staffUsers: Array<{ user_id: number }> = await queryRunner.manager.query(
				'SELECT user_id FROM organization.staff WHERE upload_log_id = $1',
				[uploadLogId],
			);
			const userIds = staffUsers.map((s) => s.user_id).filter((id) => id != null);
			await queryRunner.manager.query('DELETE FROM academic.professors WHERE upload_log_id = $1', [uploadLogId]);
			await queryRunner.manager.query('DELETE FROM organization.staff WHERE upload_log_id = $1', [uploadLogId]);
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

	private parseWorkbook(workbook: ExcelJS.Workbook): ProfessorRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: ProfessorRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return; // encabezado
			rows.push({
				rowNumber,
				userName: this.cell(row, 1),
				name: this.cell(row, 2),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, rows: ProfessorRow[]): Promise<ProfessorsLookups> {
		const userNames = [...new Set(rows.map((r) => (r.userName ?? '').trim()).filter(Boolean))];

		// Catálogo DOCENTE en core.types (position_type_id requerido para staff).
		const positions: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.code = $2`,
			[POSITION_TYPE_GROUP_CODE, DOCENTE_POSITION_CODE],
		);
		const positionTypeIdDocente = positions[0]?.id;

		// Dedup contra el schema canónico: el código del docente vive en academic.professors.code
		// (organization.staff no tiene code); el email de contacto vive en organization.staff.staff_email.
		const existingCodes: Array<{ code: string }> = userNames.length
			? await manager.query('SELECT code FROM academic.professors WHERE code = ANY($1)', [userNames])
			: [];
		const existingEmails: Array<{ staff_email: string }> = userNames.length
			? await manager.query(
					'SELECT staff_email FROM organization.staff WHERE staff_email = ANY($1)',
					[userNames],
				)
			: [];

		return {
			positionTypeIdDocente,
			existingStaffCodes: new Set(existingCodes.map((e) => e.code).filter(Boolean)),
			existingStaffEmails: new Set(existingEmails.map((e) => e.staff_email).filter(Boolean)),
		};
	}

	// INSERT atómico: organization.users → organization.staff → academic.professors.
	// El schema canónico exige varias columnas NOT NULL sin fuente en el AS-IS
	// (document_type_id, document_code, phone, password, job_title, job_description, staff_phone)
	// → se rellenan con neutrales (DNI / 0 / '-' / 'ABET' / {}). Ajustar cuando haya fuente real.
	private async insertProfessors(
		manager: EntityManager,
		resolved: ResolvedProfessorRow[],
		rows: ProfessorRow[],
		positionTypeIdDocente: number,
		uploadLogId: number,
	): Promise<void> {
		// document_type_id NOT NULL (canónico) → resolver el tipo DNI una vez.
		const docType: Array<{ id: number }> = await manager.query(
			`SELECT t.id FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = 'DOC_TYPE' AND t.code = 'DNI' LIMIT 1`,
		);
		const docTypeIdDni = docType[0]?.id ?? null;

		for (let i = 0; i < resolved.length; i++) {
			const r = resolved[i];
			const { firstName, lastName } = splitProfessorName(rows[i].name);

			// Canonical schema: organization.users / organization.staff no llevan `code`;
			// el código del docente se persiste en academic.professors.code.
			// organization.users no tiene upload_log_id en el canónico → no se estampa;
			// el rollback borra el user vía staff.user_id (staff sí lleva upload_log_id).
			const user: Array<{ id: number }> = await manager.query(
				`INSERT INTO organization.users
				 (document_type_id, document_code, first_name, last_name, email, phone, password, extra, is_active, created_at, updated_at)
				 VALUES ($1, 0, $2, $3, $4, '-', 'ABET', '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id`,
				[docTypeIdDni, firstName, lastName, r.userName],
			);
			const userId = user[0].id;

			const staff: Array<{ id: number }> = await manager.query(
				`INSERT INTO organization.staff
				 (user_id, position_type_id, job_title, job_description, staff_email, staff_phone, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, '{}'::jsonb, '{}'::jsonb, $3, '-', $4, '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id`,
				[userId, positionTypeIdDocente, r.userName, uploadLogId],
			);
			const staffId = staff[0].id;

			await manager.query(
				`INSERT INTO academic.professors (staff_id, code, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, '{}'::jsonb, true, NOW(), NOW())`,
				[staffId, r.userName, uploadLogId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedProfessorRow[]): Promise<string> {
		const worksheet = workbook.worksheets[0];
		const errorColumn = 3;
		worksheet.getRow(1).getCell(errorColumn).value = 'MensajeError';
		for (const r of withErrors) {
			worksheet.getRow(r.rowNumber).getCell(errorColumn).value = r.errors.join(' | ');
		}
		const buffer = await workbook.xlsx.writeBuffer();
		return Buffer.from(buffer).toString('base64');
	}
}
