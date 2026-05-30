import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateChartDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	staffId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	chartLevelId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rootChartDetailId?: number;

	@IsObject()
	@ApiProperty({ example: { es: 'level_title_es', en: 'level_title_en' }, required: true })
	levelTitle: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entityTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entityCode?: number;
}

export class UpdateChartDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	chartLevelId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rootChartDetailId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'level_title_es', en: 'level_title_en' }, required: false })
	levelTitle?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entityTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entityCode?: number;
}

export class FilterChartDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	chartLevelId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rootChartDetailId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'level_title_es', en: 'level_title_en' }, required: false })
	levelTitle?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	entityTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	entityCode?: number;
}
