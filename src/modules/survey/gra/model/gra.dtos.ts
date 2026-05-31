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
// GRA CONFIG DTOs
// ─────────────────────────────────────────────

export class CreateGraConfigDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome académico vinculado' })
	outcomeId: number;

	@IsString()
	@ApiProperty({ example: 'nameEsExample', description: 'Nombre de la competencia en español' })
	nameEs: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'nameEnExample', required: false })
	nameEn?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'descriptionEsExample', required: false })
	descriptionEs?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'descriptionEnExample', required: false })
	descriptionEn?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Orden de visualización', required: false })
	order?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del programa/carrera', required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico', required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'ID de la comisión (WASC, no-WASC, etc.)',
		required: false,
	})
	commissionId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, description: 'Visible en la encuesta', required: false })
	isVisible?: boolean;
}

export class UpdateGraConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	outcomeId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'nameEsExample', required: false })
	nameEs?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'nameEnExample', required: false })
	nameEn?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'descriptionEsExample', required: false })
	descriptionEs?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'descriptionEnExample', required: false })
	descriptionEn?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	order?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID de la comisión', required: false })
	commissionId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isVisible?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class FilterGraConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Filtrar por comisión', required: false })
	commissionId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isVisible?: boolean;
}

// ─────────────────────────────────────────────
// GRA REPLICATE DTO
// ─────────────────────────────────────────────

export class ReplicateGraConfigDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico origen (a copiar)' })
	sourceAcademicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico destino (nuevo período)' })
	targetAcademicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Filtrar por programa/carrera (opcional)',
		required: false,
	})
	programId?: number;
}

// ─────────────────────────────────────────────
// GRA OUTCOMES LISTING DTO
// ─────────────────────────────────────────────

export class ListGraSurveyOutcomesDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del programa/carrera' })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico' })
	academicPeriodId: number;
}

// ─────────────────────────────────────────────
// GRA NOTIFICATION DTOs (gestión de estudiantes)
// ─────────────────────────────────────────────

export class SaveGraNotificationDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del estudiante a agregar' })
	studentId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del programa/carrera' })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del campus/sede' })
	campusId: number;

	@IsString()
	@ApiProperty({
		example: 'maxRegisterDateExample',
		description: 'Fecha límite para responder la encuesta',
	})
	maxRegisterDate: string;
}

export class ListStudentsGraDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'studentCodeExample',
		description: 'Búsqueda por código de alumno',
		required: false,
	})
	studentCode?: string;
}

// ─────────────────────────────────────────────
// GRA EMAIL DTOs
// ─────────────────────────────────────────────

export class SendGraEmailDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Filtrar por programa (opcional, 0=todos)',
		required: false,
	})
	programId?: number;

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
// GRA TOKEN / SURVEY DTOs
// ─────────────────────────────────────────────

export class GetSurveyByTokenDto {
	@IsString()
	@ApiProperty({
		example: 'tokenExample',
		description: 'Token único de la encuesta',
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

export class GraScoreItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome de la config GRA' })
	outcomeConfigId: number;

	@IsNumber()
	@Min(1)
	@Max(5)
	@ApiProperty({ example: 1, description: 'Puntaje del outcome (1 - 5)' })
	score: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'commentariesExample', required: false })
	commentaries?: string;
}

export class CompleteGraSurveyDto {
	@IsString()
	@ApiProperty({
		example: 'tokenExample',
		description: 'Token único de la encuesta',
	})
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'commentariesExample', required: false })
	commentaries?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => GraScoreItemDto)
	@ApiProperty({
		example: {},
		type: [GraScoreItemDto],
		description: 'Puntajes por competencia GRA',
	})
	scores: GraScoreItemDto[];
}

// ─────────────────────────────────────────────
// GRA DASHBOARD DTO
// ─────────────────────────────────────────────

export class DashboardGraDto {
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
