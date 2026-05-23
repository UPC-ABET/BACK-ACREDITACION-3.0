import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateRubricQuestionCriteriaDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubric_question_id: number;

	@IsObject()
	@ApiProperty({ example: { es: 'criteria_es', en: 'criteria_en' }, required: true })
	criteria: I18nText;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	min_value: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	max_value: number;
}

export class UpdateRubricQuestionCriteriaDto extends BaseDto {
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
	rubric_question_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'criteria_es', en: 'criteria_en' }, required: false })
	criteria?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	min_value?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	max_value?: number;
}

export class FilterRubricQuestionCriteriaDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubric_question_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'criteria_es', en: 'criteria_en' }, required: false })
	criteria?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	min_value?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	max_value?: number;
}
