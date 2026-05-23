import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────
// GRA CONFIG DTOs
// ─────────────────────────────────────────────

export class CreateGraConfigDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome académico vinculado' })
	outcome_id: number;

	@IsString()
	@ApiProperty({ example: 'Liderazgo', description: 'Nombre de la competencia en español' })
	name_es: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Leadership', required: false })
	name_en?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Capacidad para dirigir y motivar equipos', required: false })
	description_es?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Ability to lead and motivate teams', required: false })
	description_en?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Orden de visualización', required: false })
	order?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, description: 'ID del programa/carrera', required: false })
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico', required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 7, description: 'ID de la comisión (WASC, no-WASC, etc.)', required: false })
	commission_id?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, description: 'Visible en la encuesta', required: false })
	is_visible?: boolean;
}

export class UpdateGraConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	outcome_id?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Liderazgo', required: false })
	name_es?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Leadership', required: false })
	name_en?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	description_es?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ required: false })
	description_en?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	order?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, required: false })
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 3, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 7, description: 'ID de la comisión', required: false })
	commission_id?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_visible?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
}

export class FilterGraConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, required: false })
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 3, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 7, description: 'Filtrar por comisión', required: false })
	commission_id?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_visible?: boolean;
}

// ─────────────────────────────────────────────
// GRA REPLICATE DTO
// ─────────────────────────────────────────────

export class ReplicateGraConfigDto {
	@IsNumber()
	@ApiProperty({ example: 2, description: 'ID del período académico origen (a copiar)' })
	source_academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico destino (nuevo período)' })
	target_academic_period_id: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, description: 'Filtrar por programa/carrera (opcional)', required: false })
	program_id?: number;
}

// ─────────────────────────────────────────────
// GRA OUTCOMES LISTING DTO
// ─────────────────────────────────────────────

export class ListGraSurveyOutcomesDto {
	@IsNumber()
	@ApiProperty({ example: 5, description: 'ID del programa/carrera' })
	program_id: number;

	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academic_period_id: number;
}

// ─────────────────────────────────────────────
// GRA NOTIFICATION DTOs (gestión de estudiantes)
// ─────────────────────────────────────────────

export class SaveGraNotificationDto {
	@IsNumber()
	@ApiProperty({ example: 42, description: 'ID del estudiante a agregar' })
	student_id: number;

	@IsNumber()
	@ApiProperty({ example: 5, description: 'ID del programa/carrera' })
	program_id: number;

	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 2, description: 'ID del campus/sede' })
	campus_id: number;

	@IsString()
	@ApiProperty({ example: '2026-07-31T23:59:59Z', description: 'Fecha límite para responder la encuesta' })
	max_register_date: string;
}

export class ListStudentsGraDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, required: false })
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 3, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 2, required: false })
	campus_id?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '20210001', description: 'Búsqueda por código de alumno', required: false })
	student_code?: string;
}

// ─────────────────────────────────────────────
// GRA EMAIL DTOs
// ─────────────────────────────────────────────

export class SendGraEmailDto {
	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academic_period_id: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, description: 'Filtrar por programa (opcional, 0=todos)', required: false })
	program_id?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'http://localhost:3001', description: 'URL base del frontend para el link de encuesta', required: false })
	survey_base_url?: string;
}

// ─────────────────────────────────────────────
// GRA TOKEN / SURVEY DTOs
// ─────────────────────────────────────────────

export class GetSurveyByTokenDto {
	@IsString()
	@ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Token único de la encuesta' })
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'es', description: 'Idioma de respuesta: es | en', required: false })
	language?: string;
}

export class GraScoreItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome de la config GRA' })
	outcome_config_id: number;

	@IsNumber()
	@Min(1)
	@Max(5)
	@ApiProperty({ example: 4, description: 'Puntaje del outcome (1 - 5)' })
	score: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Muy buen dominio del tema', required: false })
	commentaries?: string;
}

export class CompleteGraSurveyDto {
	@IsString()
	@ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Token único de la encuesta' })
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Excelente formación recibida', required: false })
	commentaries?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => GraScoreItemDto)
	@ApiProperty({ type: [GraScoreItemDto], description: 'Puntajes por competencia GRA' })
	scores: GraScoreItemDto[];
}

// ─────────────────────────────────────────────
// GRA DASHBOARD DTO
// ─────────────────────────────────────────────

export class DashboardGraDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 3, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, required: false })
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 2, required: false })
	campus_id?: number;
}
