// rubrics.dtos.ts
import { IsBoolean, IsNumber, IsOptional, IsArray, ValidateNested, Allow } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateRubricCriteriaDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	id?: number;

	@Allow()
	@ApiProperty({
		oneOf: [
			{ type: 'string', example: 'Criteria description' },
			{ type: 'object', example: { es: 'Descripción del criterio', en: 'Criteria description' } },
		],
		required: true,
	})
	criteria: I18nText | string;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	minValue: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	maxValue: number;
}

export class CreateRubricQuestionDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	outcomeId?: number;

	@Allow()
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
	@ApiProperty({ example: {}, type: [CreateRubricCriteriaDto], required: true })
	criterias: CreateRubricCriteriaDto[];
}

export class CreateRubricDto {
	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubricTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	gradeTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	competencyScopeTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	studyPlanCourseId: number;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateRubricQuestionDto)
	@ApiProperty({ example: {}, type: [CreateRubricQuestionDto], required: true })
	questions: CreateRubricQuestionDto[];

	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class UpdateRubricDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rubricTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	gradeTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	competencyScopeTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	studyPlanCourseId?: number;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateRubricQuestionDto) // reutilizamos porque ya tiene id opcional
	@ApiProperty({ example: {}, type: [CreateRubricQuestionDto], required: false })
	questions?: CreateRubricQuestionDto[];

	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class FilterRubricDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubricTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	gradeTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	competencyScopeTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	studyPlanCourseId?: number;
}
