import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface UploadFnRow {
	row_number: number | null;
	error_code: string | null;
	upload_log_id: number | null;
}

@Injectable()
export class EnrolledStudentsUploadRepository {
	constructor(private readonly dataSource: DataSource) {}

	async callUploadFunction(
		rows: unknown[],
		academicPeriodId: number,
		userId: number,
		sourceFile: string,
		modalityTypeId: number,
	): Promise<UploadFnRow[]> {
		const modalityErrors = await this.findProgramModalityMismatches(rows, modalityTypeId);
		if (modalityErrors.length > 0) return modalityErrors;

		return await this.dataSource.query(
			'SELECT * FROM audit.fn_upload_enrolled_students($1::jsonb, $2, $3, $4)',
			[JSON.stringify(rows), academicPeriodId, userId, sourceFile],
		);
	}

	private async findProgramModalityMismatches(
		rows: unknown[],
		modalityTypeId: number,
	): Promise<UploadFnRow[]> {
		const mismatches: Array<{ row_number: number; error_code: string }> =
			await this.dataSource.query(
				'SELECT * FROM audit.fn_validate_program_modality($1::jsonb, $2)',
				[JSON.stringify(rows), modalityTypeId],
			);
		return mismatches.map((r) => ({ ...r, upload_log_id: null }));
	}

	async callRollbackFunction(uploadLogId: number): Promise<void> {
		await this.dataSource.query('SELECT audit.fn_rollback_enrolled_students($1)', [uploadLogId]);
	}
}
