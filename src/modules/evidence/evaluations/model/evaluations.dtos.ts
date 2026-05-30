import {
	IsBoolean,
	IsDate,
	IsNumber,
	IsObject,
	IsOptional,
	IsArray,
	ValidateNested,
	IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';
import { Type } from 'class-transformer';

export class ScoreDetailDto {
	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	rubricQuestionCriteriaId: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 85.5, required: true })
	score: number;

	@IsOptional()
	@ApiProperty({
		oneOf: [
			{ type: 'string', example: 'Good performance' },
			{ type: 'object', example: { es: 'Buen desempeño', en: 'Good performance' } },
		],
		required: false,
	})
	commentaries?: I18nText | string;
}

export class SubmitEvaluationDto {
	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	projectStudentId: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	projectEvaluatorId: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({
		example: 1,
		required: true,
		description:
			'ID de la rúbrica que se está evaluando (EA o EB). Se obtiene del GET /projects/project/:id.',
	})
	rubricId: number;

	@IsOptional()
	@ApiProperty({
		oneOf: [
			{ type: 'string', example: 'Overall observation' },
			{ type: 'object', example: { es: 'Observación general', en: 'Overall observation' } },
		],
		required: false,
	})
	observation?: I18nText | string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ScoreDetailDto)
	@ApiProperty({ type: [ScoreDetailDto], required: true })
	scores: ScoreDetailDto[];

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({
		example: 1,
		required: true,
		description:
			'Estado de calificación desde core.types (TG404). Ej: ASISTIO (TG404-T001), NR (TG404-T002), NA (TG404-T003).',
	})
	qualificationStatusTypeId: number;
}

export class CreateEvaluationDto {
	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	projectStudentId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	projectEvaluatorId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	qualificationStatusTypeId: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'observation_es', en: 'observation_en' }, required: false })
	observation?: I18nText;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	registerAt?: Date;

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class UpdateEvaluationDto {
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
	projectStudentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	projectEvaluatorId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	qualificationStatusTypeId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'observation_es', en: 'observation_en' }, required: false })
	observation?: I18nText;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	registerAt?: Date;
}

export class SaveObservationDto {
	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	projectStudentId: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	projectEvaluatorId: number;

	@IsOptional()
	@ApiProperty({
		oneOf: [
			{ type: 'string', example: 'Student observation' },
			{ type: 'object', example: { es: 'Observación del alumno', en: 'Student observation' } },
		],
		required: false,
	})
	observation?: I18nText | string;

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class FinalizeProjectDto {
	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	projectId: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	evaluatorId: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({
		example: false,
		required: false,
		description: 'Indica si es evaluación de Participación (PA). Si es true, no exige observación.',
	})
	isPa?: boolean;

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class FilterEvaluationDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	projectStudentId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	projectEvaluatorId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	qualificationStatusTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'observation_es', en: 'observation_en' }, required: false })
	observation?: I18nText;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	registerAt?: Date;
}
