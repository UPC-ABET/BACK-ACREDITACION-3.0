import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';

export interface UploadFnRow {
	row_number: number | null;
	error_code: string | null;
	upload_log_id: number | null;
}

@Injectable()
export class GradesRcUploadRepository {
	constructor(private readonly dataSource: DataSource) {}

	async callUploadFunction(
		rows: unknown[],
		academicPeriodId: number,
		userId: number,
		sourceFile: string,
	): Promise<UploadFnRow[]> {
		return await this.dataSource.query(
			'SELECT * FROM audit.fn_upload_grades_rc($1::jsonb, $2, $3, $4)',
			[JSON.stringify(rows), academicPeriodId, userId, sourceFile],
		);
	}

	async callRollbackFunction(uploadLogId: number): Promise<void> {
		await this.dataSource.query('SELECT audit.fn_rollback_grades_rc($1)', [uploadLogId]);
	}

	async getGradeTypes(language: string): Promise<Array<{ code: string; name: string }>> {
		return await this.getTypesByGroup(TYPE_GROUP_CODES.GRADE_TYPE, language);
	}

	async getQualificationStatusTypes(
		language: string,
	): Promise<Array<{ code: string; name: string }>> {
		return await this.getTypesByGroup(TYPE_GROUP_CODES.QUALIFICATION_STATUS, language);
	}

	private async getTypesByGroup(
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
