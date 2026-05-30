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
		example: 3,
		description: 'ID del período académico para el que se generan configuraciones',
	})
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 5, description: 'ID del programa/carrera' })
	programId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 2,
		description: 'ID del campus (opcional, filtra por sede)',
		required: false,
	})
	campusId?: number;
}

export class FilterLcfcConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 3, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, required: false })
	programId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class LcfcConfigStatusItemDto {
	@IsNumber()
	@ApiProperty({
		example: 12,
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
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, description: 'Filtrar por programa (opcional)', required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 2, description: 'Filtrar por campus (opcional)', required: false })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 10,
		description: 'Enviar solo para esta sección de curso (opcional, 0=todas las activas)',
		required: false,
	})
	courseSectionId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: '2026-07-31T23:59:59Z',
		description: 'Fecha límite para responder la encuesta',
		required: false,
	})
	maxRegisterDate?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'http://localhost:3001',
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
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'Token único de la encuesta LCFC',
	})
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'es', description: 'Idioma de respuesta: es | en', required: false })
	language?: string;
}

export class LcfcScoreItemDto {
	@IsNumber()
	@ApiProperty({ example: 102, description: 'ID del outcome de accreditation.outcomes' })
	outcomeId: number;

	@IsNumber()
	@Min(1)
	@Max(10)
	@ApiProperty({ example: 8, description: 'Puntaje del outcome (1 - 10)' })
	score: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Excelente dominio del tema', required: false })
	commentaries?: string;
}

export class CompleteLcfcSurveyDto {
	@IsString()
	@ApiProperty({
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'Token único de la encuesta LCFC',
	})
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Buen curso, aprendí mucho.', required: false })
	commentaries?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => LcfcScoreItemDto)
	@ApiProperty({ type: [LcfcScoreItemDto], description: 'Puntajes por outcome del curso (1-10)' })
	scores: LcfcScoreItemDto[];
}

// ─────────────────────────────────────────────
// LCFC DASHBOARD DTO
// ─────────────────────────────────────────────

export class DashboardLcfcDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 3, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 2, required: false })
	campusId?: number;
}
