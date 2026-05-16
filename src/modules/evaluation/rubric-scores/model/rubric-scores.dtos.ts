import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateRubricScoreDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	evaluation_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubric_outcome_criteria_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubric_question_criteria_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	score: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'commentaries_es', en: 'commentaries_en' }, required: false })
	commentaries?: I18nText;
}

export class UpdateRubricScoreDto extends BaseDto {
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
	evaluation_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rubric_outcome_criteria_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rubric_question_criteria_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	score?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'commentaries_es', en: 'commentaries_en' }, required: false })
	commentaries?: I18nText;
}

export class FilterRubricScoreDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	evaluation_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubric_outcome_criteria_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubric_question_criteria_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	score?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'commentaries_es', en: 'commentaries_en' }, required: false })
	commentaries?: I18nText;
}
