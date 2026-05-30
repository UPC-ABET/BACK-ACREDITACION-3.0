import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateRubricQuestionCriteriaDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubricQuestionId: number;

	@IsObject()
	@ApiProperty({ example: { es: 'criteria_es', en: 'criteria_en' }, required: true })
	criteria: I18nText;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	minValue: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	maxValue: number;
}

export class UpdateRubricQuestionCriteriaDto {
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
	rubricQuestionId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'criteria_es', en: 'criteria_en' }, required: false })
	criteria?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	minValue?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	maxValue?: number;
}

export class FilterRubricQuestionCriteriaDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubricQuestionId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'criteria_es', en: 'criteria_en' }, required: false })
	criteria?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	minValue?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	maxValue?: number;
}
