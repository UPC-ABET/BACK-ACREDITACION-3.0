import {
	IsArray,
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	ValidateNested,
	Min,
	Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────
// LCFC CONFIG DTOs
// ─────────────────────────────────────────────

export class GenerateLcfcConfigDto {
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'ID del período académico para el que se generan configuraciones',
	})
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del programa/carrera' })
	programId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'ID del campus (opcional, filtra por sede)',
		required: false,
	})
	campusId?: number;
}

export class FilterLcfcConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class LcfcConfigStatusItemDto {
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'ID del registro de configuración LCFC (outcome_config.id)',
	})
	configId: number;

	@IsBoolean()
	@ApiProperty({ example: true, description: 'true = activo para LCFC, false = inactivo' })
	isActive: boolean;
}

export class UpdateLcfcConfigStatusDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => LcfcConfigStatusItemDto)
	@ApiProperty({
		example: {},
		type: [LcfcConfigStatusItemDto],
		description: 'Lista de configuraciones con su nuevo estado',
	})
	updates: LcfcConfigStatusItemDto[];
}

// ─────────────────────────────────────────────
// LCFC NOTIFICATION DTOs
// ─────────────────────────────────────────────

export class SendLcfcNotificationDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Filtrar por programa (opcional)', required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Filtrar por campus (opcional)', required: false })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Enviar solo para esta sección de curso (opcional, 0=todas las activas)',
		required: false,
	})
	courseSectionId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'maxRegisterDateExample',
		description: 'Fecha límite para responder la encuesta',
		required: false,
	})
	maxRegisterDate?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'surveyBaseUrlExample',
		description: 'URL base del frontend para el link de encuesta',
		required: false,
	})
	surveyBaseUrl?: string;
}

// ─────────────────────────────────────────────
// LCFC TOKEN / SURVEY DTOs
// ─────────────────────────────────────────────

export class GetLcfcSurveyByTokenDto {
	@IsString()
	@ApiProperty({
		example: 'tokenExample',
		description: 'Token único de la encuesta LCFC',
	})
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'languageExample',
		description: 'Idioma de respuesta: es | en',
		required: false,
	})
	language?: string;
}

export class LcfcScoreItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome de accreditation.outcomes' })
	outcomeId: number;

	@IsNumber()
	@Min(1)
	@Max(10)
	@ApiProperty({ example: 1, description: 'Puntaje del outcome (1 - 10)' })
	score: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'commentariesExample', required: false })
	commentaries?: string;
}

export class CompleteLcfcSurveyDto {
	@IsString()
	@ApiProperty({
		example: 'tokenExample',
		description: 'Token único de la encuesta LCFC',
	})
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'commentariesExample', required: false })
	commentaries?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => LcfcScoreItemDto)
	@ApiProperty({
		example: {},
		type: [LcfcScoreItemDto],
		description: 'Puntajes por outcome del curso (1-10)',
	})
	scores: LcfcScoreItemDto[];
}

// ─────────────────────────────────────────────
// LCFC DASHBOARD DTO
// ─────────────────────────────────────────────

export class DashboardLcfcDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;
}
