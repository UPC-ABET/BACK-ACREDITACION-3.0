import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

export class CreateUploadLogDto {
	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	user_id: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsString()
	@ApiProperty({ example: 'MALLA_CURRICULAR', required: true })
	upload_type: string;

	@IsString()
	@ApiProperty({ example: 'COMPLETED', required: true })
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

export class ListUploadLogsQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ example: 'MALLA_CURRICULAR' })
	uploadTypeCode?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ example: 'COMPLETED' })
	statusCode?: string;

	@Type(() => Number)
	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Academic period id (from header)' })
	academicPeriodId: number;
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
