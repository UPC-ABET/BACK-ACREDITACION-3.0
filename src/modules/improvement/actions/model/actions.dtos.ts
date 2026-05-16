import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateActionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: true })
	description: I18nText;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	correlative: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	action_status_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	program_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;
}

export class UpdateActionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	correlative?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	action_status_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;
}

export class FilterActionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	correlative?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	action_status_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	program_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;
}
