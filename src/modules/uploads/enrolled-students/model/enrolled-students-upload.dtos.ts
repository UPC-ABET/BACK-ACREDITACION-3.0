import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export type { UploadResult } from './enrolled-students-upload.types';

export class EnrolledStudentsUploadDto {
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 1, required: true, description: 'Academic period the enrollment is registered under' })
	academicPeriodId: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'es', required: false, description: 'Language for the error report (es | en)' })
	lang?: string;
}

export class RollbackUploadDto {
	@Transform(({ value }) => (value === undefined || value === null || value === '' ? undefined : Number(value)))
	@IsNumber()
	@ApiProperty({ example: 42, required: true, description: 'audit.upload_logs id to roll back' })
	uploadLogId: number;
}
