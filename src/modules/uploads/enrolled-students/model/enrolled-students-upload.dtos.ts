import { IsNumber, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export type { EnrolledStudentRow, RowValidationResult, UploadResult } from './enrolled-students-upload.types';
export { splitFullName } from './enrolled-students-upload.types';

export class EnrolledStudentsUploadDto {
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 1, required: true, description: 'Periodo académico destino de la carga' })
	academic_period_id: number;

	@IsOptional()
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'Usuario que ejecuta la carga' })
	user_id?: number;
}

export class RollbackUploadDto {
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 42, required: true, description: 'id de audit.upload_logs a revertir' })
	upload_log_id: number;
}
