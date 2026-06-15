import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PARAMETER_CODES } from 'src/modules/core/parameters/constants/parameter-codes';
import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

export interface UploadFnRow {
	row_number: number | null;
	error_code: string | null;
	upload_log_id: number | null;
}

@Injectable()
export class ChartsUploadRepository {
	constructor(private readonly dataSource: DataSource) {}

	async callUploadFunction(
		rows: unknown[],
		academicPeriodId: number,
		schoolId: number,
		userId: number,
		sourceFile: string,
	): Promise<UploadFnRow[]> {
		return await this.dataSource.query(
			'SELECT * FROM audit.fn_upload_charts($1::jsonb, $2, $3, $4, $5)',
			[JSON.stringify(rows), academicPeriodId, schoolId, userId, sourceFile],
		);
	}

	async callRollbackFunction(uploadLogId: number): Promise<void> {
		await this.dataSource.query('SELECT audit.fn_rollback_charts($1)', [uploadLogId]);
	}

	async getActiveRoleIdByCode(code: string): Promise<number | null> {
		const rows: Array<{ id: number }> = await this.dataSource.query(
			`SELECT id::int AS id FROM core.roles WHERE code = $1 AND is_active = true LIMIT 1`,
			[code],
		);
		return rows[0]?.id ?? null;
	}

	async getStaffForProvisioning(professorCodes: string[]): Promise<
		Array<{
			staffId: number;
			firstName: string;
			lastName: string;
			email: string | null;
			userId: number | null;
		}>
	> {
		return await this.dataSource.query(
			`SELECT DISTINCT ON (pr.staff_id)
				pr.staff_id::int   AS "staffId",
				s.first_name       AS "firstName",
				s.last_name        AS "lastName",
				s.staff_email      AS "email",
				s.user_id::int     AS "userId"
			 FROM academic.professors pr
			 JOIN organization.staff s ON s.id = pr.staff_id
			 WHERE pr.code = ANY($1::varchar[])
			 ORDER BY pr.staff_id, pr.id`,
			[professorCodes],
		);
	}

	async findActiveUserIdByEmail(email: string): Promise<number | null> {
		const rows: Array<{ id: number }> = await this.dataSource.query(
			`SELECT id::int AS id FROM organization.users WHERE lower(email) = lower($1) AND is_active = true LIMIT 1`,
			[email],
		);
		return rows[0]?.id ?? null;
	}

	async linkStaffToUser(staffId: number, userId: number): Promise<void> {
		await this.dataSource.query(
			`UPDATE organization.staff SET user_id = $1, updated_at = NOW() WHERE id = $2`,
			[userId, staffId],
		);
	}

	async assignUserRole(userId: number, roleId: number): Promise<void> {
		await this.dataSource.query(
			`INSERT INTO core.user_roles (user_id, role_id, is_active)
			 VALUES ($1, $2, true)
			 ON CONFLICT (user_id, role_id) DO UPDATE SET is_active = true, updated_at = NOW()`,
			[userId, roleId],
		);
	}

	// The school's chart node (Dean -> School Director prior configuration) must exist; the upload
	// hangs the Program Coordinator subtree under it.
	async schoolChartExists(schoolId: number, academicPeriodId: number): Promise<boolean> {
		const rows: Array<{ one: number }> = await this.dataSource.query(
			`SELECT 1 AS one FROM organization.charts c
			 JOIN core.types et ON et.id = c.entity_type_id
			 WHERE et.code = $3 AND c.entity_code = $1 AND c.academic_period_id = $2 AND c.is_active = true
			 LIMIT 1`,
			[schoolId, academicPeriodId, TYPE_CODES.ENTITY_TYPE.SCHOOL],
		);
		return rows.length > 0;
	}

	async chartsLoadedForSchoolPeriod(schoolId: number, academicPeriodId: number): Promise<boolean> {
		const rows: Array<{ one: number }> = await this.dataSource.query(
			`SELECT 1 AS one
			 FROM organization.charts child
			 JOIN organization.charts school ON school.id = child.root_chart_id
			 JOIN core.types et ON et.id = school.entity_type_id
			 WHERE child.upload_log_id IS NOT NULL
			   AND child.academic_period_id = $2
			   AND et.code = $3
			   AND school.entity_code = $1
			 LIMIT 1`,
			[schoolId, academicPeriodId, TYPE_CODES.ENTITY_TYPE.SCHOOL],
		);
		return rows.length > 0;
	}

	async getSupportedLanguages(): Promise<string[] | null> {
		const rows: Array<{ value: unknown }> = await this.dataSource.query(
			'SELECT value FROM core.parameters WHERE code = $1 LIMIT 1',
			[PARAMETER_CODES.LANGUAGES],
		);
		const value = rows[0]?.value;
		return Array.isArray(value) && value.length > 0 ? (value as string[]) : null;
	}

	async getEntityTypes(language: string): Promise<Array<{ code: string; name: string }>> {
		return await this.typesByGroup(TYPE_GROUP_CODES.ENTITY_TYPE, language);
	}

	private async typesByGroup(
		groupCode: string,
		language: string,
	): Promise<Array<{ code: string; name: string }>> {
		return await this.dataSource.query(
			`SELECT t.code, COALESCE(t.name->>$2, t.name->>'es', t.code) AS name
			 FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.is_active = true
			 ORDER BY t.code`,
			[groupCode, language],
		);
	}
}
