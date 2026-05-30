import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUploadLogDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	user_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsString()
	@ApiProperty({ example: 'SECCION', required: true })
	upload_type: string;

	@IsString()
	@ApiProperty({ example: 'IN_PROGRESS', required: true })
	status: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'secciones_202501.xlsx', required: false })
	source_file?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 120, required: false })
	total_rows?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 120, required: false })
	loaded_rows?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 0, required: false })
	error_rows?: number;
}

export class UpdateUploadLogDto {
	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'COMPLETED', required: false })
	status?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 120, required: false })
	total_rows?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 120, required: false })
	loaded_rows?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 0, required: false })
	error_rows?: number;
}
