import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PARAMETER_CODES } from 'src/modules/core/parameters/constants/parameter-codes';

export interface UploadFnRow {
	row_number: number | null;
	error_code: string | null;
	upload_log_id: number | null;
}

@Injectable()
export class OutcomesUploadRepository {
	constructor(private readonly dataSource: DataSource) {}

	async callUploadFunction(
		rows: unknown[],
		academicPeriodId: number,
		userId: number,
		sourceFile: string,
	): Promise<UploadFnRow[]> {
		return await this.dataSource.query(
			'SELECT * FROM audit.fn_upload_outcomes($1::jsonb, $2, $3, $4)',
			[JSON.stringify(rows), academicPeriodId, userId, sourceFile],
		);
	}

	async callRollbackFunction(uploadLogId: number): Promise<void> {
		await this.dataSource.query('SELECT audit.fn_rollback_outcomes($1)', [uploadLogId]);
	}

	async getSupportedLanguages(): Promise<string[] | null> {
		const rows: Array<{ value: unknown }> = await this.dataSource.query(
			'SELECT value FROM core.parameters WHERE code = $1 LIMIT 1',
			[PARAMETER_CODES.LANGUAGES],
		);
		const value = rows[0]?.value;
		return Array.isArray(value) && value.length > 0 ? (value as string[]) : null;
	}
}
