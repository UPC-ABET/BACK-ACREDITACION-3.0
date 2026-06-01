import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { UploadLogService } from '../../upload-logs/api/upload-logs.service';
import { EnrolledStudentsUploadValidation, EnrolledStudentsLookups, ResolvedEnrolledStudentRow } from '../core/enrolled-students-upload.validation';
import type { EnrolledStudentsUploadDto } from '../model/enrolled-students-upload.dtos';
import { EnrolledStudentRow, UploadResult, splitFullName } from '../model/enrolled-students-upload.types';
import { enrolledStudentsUploadStrings } from '../config/strings/enrolled-students-upload.validation';

const UPLOAD_TYPE = 'ALUMNOS_MATRICULADOS';
const ENROLLMENT_STATUS_GROUP_CODE = 'ENROLLMENT_STATUS';

@Injectable()
export class EnrolledStudentsUploadService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly uploadLogService: UploadLogService,
	) {}

	// Punto de entrada: réplica de USP_AlumnoMatriculadoCargaMasiva (transacción atómica, ALL-OR-NOTHING).
	async processUpload(fileBuffer: Buffer, fileName: string, dto: EnrolledStudentsUploadDto): Promise<UploadResult> {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
		const rows = this.parseWorkbook(workbook);

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();

		try {
			const lookups = await this.buildLookups(queryRunner.manager, dto.academic_period_id, rows);
			const resolved = EnrolledStudentsUploadValidation.validateAll(rows, lookups);
			const withErrors = resolved.filter((r) => r.errors.length > 0);

			if (withErrors.length > 0) {
				const excel = await this.annotateErrors(workbook, withErrors);
				return {
					success: false,
					message: enrolledStudentsUploadStrings.result.uploadFailed,
					uploadLogId: null,
					totalRows: rows.length,
					loadedRows: 0,
					errorRows: withErrors.length,
					excelWithErrors: excel,
					fileName: enrolledStudentsUploadStrings.file.errorsFileName,
				};
			}

			await queryRunner.startTransaction();
			try {
				const log = await this.uploadLogService.start(
					{ upload_type: UPLOAD_TYPE, status: 'IN_PROGRESS', academic_period_id: dto.academic_period_id, user_id: dto.user_id as number, source_file: fileName, total_rows: rows.length },
					queryRunner.manager,
				);

				await this.insertEnrolledStudents(queryRunner.manager, resolved, rows, dto.academic_period_id, log.id);

				await this.uploadLogService.complete(log.id, { total_rows: rows.length, loaded_rows: rows.length, error_rows: 0 }, queryRunner.manager);
				await queryRunner.commitTransaction();

				return {
					success: true,
					message: enrolledStudentsUploadStrings.result.uploadSuccess,
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

	// Réplica de USP_Rollback_AlumnoMatriculado: borra hijos→padres por upload_log_id.
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

	private parseWorkbook(workbook: ExcelJS.Workbook): EnrolledStudentRow[] {
		const worksheet = workbook.worksheets[0];
		const rows: EnrolledStudentRow[] = [];
		worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return; // encabezado
			rows.push({
				rowNumber,
				studentCode: this.cell(row, 1),
				fullName: this.cell(row, 2),
				programCode: this.cell(row, 3),
				enrollmentStatus: this.cell(row, 4),
				campusCode: this.cell(row, 5),
			});
		});
		return rows;
	}

	private cell(row: ExcelJS.Row, col: number): string {
		const value = row.getCell(col).value;
		return value === null || value === undefined ? '' : String(value).trim();
	}

	private async buildLookups(manager: EntityManager, academicPeriodId: number, rows: EnrolledStudentRow[]): Promise<EnrolledStudentsLookups> {
		const programCodes = [...new Set(rows.map((r) => r.programCode).filter(Boolean))];
		const campusCodes = [...new Set(rows.map((r) => r.campusCode).filter(Boolean))];
		const studentCodes = [...new Set(rows.map((r) => r.studentCode).filter(Boolean))];

		const programs: Array<{ id: number; code: string }> = await manager.query('SELECT id, code FROM academic.programs WHERE code = ANY($1)', [programCodes]);
		const campuses: Array<{ id: number; code: string }> = await manager.query('SELECT id, code FROM organization.campuses WHERE code = ANY($1)', [campusCodes]);
		const statuses: Array<{ id: number; code: string }> = await manager.query(
			`SELECT t.id, t.code FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1`,
			[ENROLLMENT_STATUS_GROUP_CODE],
		);
		// Dedup: alumnos ya matriculados en el período (réplica del NOT EXISTS del SP).
		const existing: Array<{ code: string }> = studentCodes.length
			? await manager.query(
					`SELECT st.code
					 FROM academic.students st
					 JOIN academic.enrolled_students es ON es.student_id = st.id
					 JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period
					 WHERE spap.academic_period_id = $1 AND st.code = ANY($2)`,
					[academicPeriodId, studentCodes],
				)
			: [];

		return {
			programIdByCode: new Map(programs.map((p) => [p.code, p.id])),
			campusIdByCode: new Map(campuses.map((c) => [c.code, c.id])),
			enrollmentStatusTypeIdByCode: new Map(statuses.map((s) => [s.code, s.id])),
			existingStudentCodes: new Set(existing.map((e) => e.code)),
		};
	}

	// INSERT atómico: organization.users (persona) → academic.students → academic.enrolled_students.
	// TODO(parity): provisión de usuario (email/credenciales) y graduation_modality_type_id no vienen en el Excel;
	//   el legacy insertaba MAESTRO.Alumno directo. Resolver el mapeo study_plan_academic_period por período/programa.
	private async insertEnrolledStudents(
		manager: EntityManager,
		resolved: ResolvedEnrolledStudentRow[],
		rows: EnrolledStudentRow[],
		academicPeriodId: number,
		uploadLogId: number,
	): Promise<void> {
		// Neutrales para columnas NOT NULL del canónico sin fuente en el Excel (DNI / modalidad por defecto).
		const docType: Array<{ id: number }> = await manager.query(
			`SELECT t.id FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = 'DOC_TYPE' AND t.code = 'DNI' LIMIT 1`,
		);
		const docTypeIdDni = docType[0]?.id ?? null;
		const gradMod: Array<{ id: number }> = await manager.query(
			`SELECT t.id FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = 'MODALITY_TYPE' AND t.code = 'IN_PERSON' LIMIT 1`,
		);
		const gradModalityId = gradMod[0]?.id ?? null;

		for (let i = 0; i < resolved.length; i++) {
			const r = resolved[i];
			const { lastName, firstName } = splitFullName(rows[i].fullName);

			// study_plan_academic_period del programa en el período (FK de enrolled_students).
			const spap: Array<{ id: number }> = await manager.query(
				`SELECT spap.id
				 FROM academic.study_plan_academic_periods spap
				 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
				 WHERE spap.academic_period_id = $1 AND sp.program_id = $2
				 LIMIT 1`,
				[academicPeriodId, r.programId],
			);
			const studyPlanAcademicPeriodId = spap[0]?.id ?? null;

			// users: canónico sin upload_log_id; NOT NULL rellenados con neutrales.
			// El rollback borra el user vía students.user_id (students sí lleva upload_log_id).
			const user: Array<{ id: number }> = await manager.query(
				`INSERT INTO organization.users
				 (document_type_id, document_code, first_name, last_name, email, phone, password, extra, is_active, created_at, updated_at)
				 VALUES ($1, 0, $2, $3, $4, '-', 'ABET', '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id`,
				[docTypeIdDni, firstName, lastName, r.studentCode],
			);
			const userId = user[0].id;

			const student: Array<{ id: number }> = await manager.query(
				`INSERT INTO academic.students (code, user_id, program_id, graduation_modality_type_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id`,
				[r.studentCode, userId, r.programId, gradModalityId, uploadLogId],
			);
			const studentId = student[0].id;

			await manager.query(
				`INSERT INTO academic.enrolled_students
				 (student_id, study_plan_academic_period, campus_id, enrollement_modality_type_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, true, NOW(), NOW())`,
				[studentId, studyPlanAcademicPeriodId, r.campusId, r.enrollmentStatusTypeId, uploadLogId],
			);
		}
	}

	private async annotateErrors(workbook: ExcelJS.Workbook, withErrors: ResolvedEnrolledStudentRow[]): Promise<string> {
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
