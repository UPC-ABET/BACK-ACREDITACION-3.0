import { IsBoolean, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import { Type } from 'class-transformer';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateRubricCriteriaDto {
	@ApiProperty({
		oneOf: [
			{ type: 'string', example: 'Criteria description' },
			{ type: 'object', example: { es: 'Descripción del criterio', en: 'Criteria description' } },
		],
		required: true,
	})
	criteria: I18nText | string;

	@IsNumber()
	@ApiProperty({ example: 0, required: true })
	min_value: number;

	@IsNumber()
	@ApiProperty({ example: 100, required: true })
	max_value: number;
}

export class CreateRubricQuestionDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	outcome_id?: number;

	@ApiProperty({
		oneOf: [
			{ type: 'string', example: 'Question text' },
			{ type: 'object', example: { es: 'Texto de la pregunta', en: 'Question text' } },
		],
		required: true,
	})
	question: I18nText | string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateRubricCriteriaDto)
	@ApiProperty({ type: [CreateRubricCriteriaDto], required: true })
	criterias: CreateRubricCriteriaDto[];
}

export class CreateRubricDto extends BaseDto {
	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubric_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	grade_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	study_plan_course_id: number;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateRubricQuestionDto)
	@ApiProperty({ type: [CreateRubricQuestionDto], required: true })
	questions: CreateRubricQuestionDto[];

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
}

export class UpdateRubricDto extends BaseDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rubric_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	grade_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	study_plan_course_id?: number;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateRubricQuestionDto)
	@ApiProperty({ type: [CreateRubricQuestionDto], required: false })
	questions?: CreateRubricQuestionDto[];

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
}

export class FilterRubricDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubric_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	grade_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	study_plan_course_id?: number;
}
