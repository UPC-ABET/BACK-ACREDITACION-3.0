import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PARAMETER_CODES } from 'src/modules/core/parameters/constants/parameter-codes';
import { TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

export interface UploadFnRow {
	row_number: number | null;
	error_code: string | null;
	upload_log_id: number | null;
}

@Injectable()
export class StudyPlansUploadRepository {
	constructor(private readonly dataSource: DataSource) {}

	async callUploadFunction(
		rows: unknown[],
		academicPeriodId: number,
		userId: number,
		sourceFile: string,
	): Promise<UploadFnRow[]> {
		return await this.dataSource.query(
			'SELECT * FROM audit.fn_upload_study_plans($1::jsonb, $2, $3, $4)',
			[JSON.stringify(rows), academicPeriodId, userId, sourceFile],
		);
	}

	async callRollbackFunction(uploadLogId: number): Promise<void> {
		await this.dataSource.query('SELECT audit.fn_rollback_study_plans($1)', [uploadLogId]);
	}

	async getSupportedLanguages(): Promise<string[] | null> {
		const rows: Array<{ value: unknown }> = await this.dataSource.query(
			'SELECT value FROM core.parameters WHERE code = $1 LIMIT 1',
			[PARAMETER_CODES.LANGUAGES],
		);
		const value = rows[0]?.value;
		return Array.isArray(value) && value.length > 0 ? (value as string[]) : null;
	}

	async getLevelTypes(language: string): Promise<Array<{ code: string; name: string }>> {
		return await this.dataSource.query(
			`SELECT t.code, COALESCE(t.name->>$2, t.name->>'es', t.code) AS name
			 FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.is_active = true
			 ORDER BY t.code`,
			[TYPE_GROUP_CODES.ACADEMIC_LEVEL, language],
		);
	}
}
