import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateFindingDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	criticality_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	instrument_id: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	staff_id?: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	correlative: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	course_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campus_id: number;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	is_automatic: boolean;
}

export class UpdateFindingDto extends BaseDto {
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
	criticality_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	instrument_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	staff_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	correlative?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	course_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campus_id?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_automatic?: boolean;
}

export class FilterFindingDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	criticality_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	instrument_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	staff_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	correlative?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	course_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campus_id?: number;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_automatic?: boolean;
}
