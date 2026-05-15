import { IsBoolean, IsDate, IsNumber, IsObject, IsOptional, IsString, Length, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';
import { Type } from 'class-transformer';

export class ScoreDetailDto {
	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	rubric_question_criteria_id: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 85.5, required: true })
	score: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'Good performance', required: false })
	commentaries?: string;
}

export class SubmitEvaluationDto extends BaseDto {
	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	project_student_id: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	project_evaluator_id: number;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'Overall observation', required: false })
	observation?: string;

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
	is_active?: boolean;
}

export class CreateEvaluationDto extends BaseDto {
	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	project_student_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	project_evaluator_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	qualification_status_type_id: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'observation_es', en: 'observation_en' }, required: false })
	observation?: I18nText;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	register_at?: Date;

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
}

export class UpdateEvaluationDto extends BaseDto {
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
	project_student_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	project_evaluator_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	qualification_status_type_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'observation_es', en: 'observation_en' }, required: false })
	observation?: I18nText;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	register_at?: Date;
}

export class SaveObservationDto extends BaseDto {
	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	project_student_id: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	project_evaluator_id: number;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'Student observation', required: false })
	observation?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
}

export class FinalizeProjectDto extends BaseDto {
	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	project_id: number;

	@IsNumber()
	@IsNotEmpty()
	@ApiProperty({ example: 1, required: true })
	evaluator_id: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: false, required: false, description: 'Indica si es evaluación de Participación (PA). Si es true, no exige observación.' })
	is_pa?: boolean;

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
}

export class FilterEvaluationDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	project_student_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	project_evaluator_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	qualification_status_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'observation_es', en: 'observation_en' }, required: false })
	observation?: I18nText;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	register_at?: Date;
}
