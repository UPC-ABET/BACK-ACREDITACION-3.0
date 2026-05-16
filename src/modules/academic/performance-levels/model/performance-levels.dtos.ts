import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreatePerformanceLevelDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	instrument_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;

	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: true })
	name: I18nText;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	unique_value: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	min_score: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	max_score: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	max_value: number;
}

export class UpdatePerformanceLevelDto extends BaseDto {
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
	instrument_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	unique_value?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	min_score?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	max_score?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	max_value?: number;
}

export class FilterPerformanceLevelDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	instrument_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	unique_value?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	min_score?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	max_score?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	max_value?: number;
}
