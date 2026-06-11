import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface UploadFnRow {
	row_number: number | null;
	error_code: string | null;
	upload_log_id: number | null;
}

@Injectable()
export class StaffUploadRepository {
	constructor(private readonly dataSource: DataSource) {}

	async callUploadFunction(
		rows: unknown[],
		academicPeriodId: number,
		userId: number,
		sourceFile: string,
	): Promise<UploadFnRow[]> {
		return await this.dataSource.query(
			'SELECT * FROM audit.fn_upload_staff($1::jsonb, $2, $3, $4)',
			[JSON.stringify(rows), academicPeriodId, userId, sourceFile],
		);
	}

	async callRollbackFunction(uploadLogId: number): Promise<void> {
		await this.dataSource.query('SELECT audit.fn_rollback_staff($1)', [uploadLogId]);
	}
}
