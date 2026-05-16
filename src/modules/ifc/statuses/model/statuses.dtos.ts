import { IsBoolean, IsDate, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateStatusDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	ifc_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	status_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	staff_id: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'comment_es', en: 'comment_en' }, required: false })
	comment?: I18nText;

	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: true })
	register_at: Date;
}

export class UpdateStatusDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	ifc_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	status_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	staff_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'comment_es', en: 'comment_en' }, required: false })
	comment?: I18nText;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	register_at?: Date;
}

export class FilterStatusDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	ifc_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	status_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	staff_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'comment_es', en: 'comment_en' }, required: false })
	comment?: I18nText;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	register_at?: Date;
}
