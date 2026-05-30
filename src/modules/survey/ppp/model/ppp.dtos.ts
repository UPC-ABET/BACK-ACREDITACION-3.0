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
// PPP CONFIG DTOs
// ─────────────────────────────────────────────

export class CreatePppConfigDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome académico vinculado' })
	outcomeId: number;

	@IsString()
	@ApiProperty({
		example: 'nameEsExample',
		description: 'Nombre de la competencia en español',
	})
	nameEs: string;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'nameEnExample',
		description: 'Nombre en inglés',
		required: false,
	})
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
	@IsBoolean()
	@ApiProperty({ example: true, description: 'Visible en la encuesta', required: false })
	isVisible?: boolean;
}

export class UpdatePppConfigDto {
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
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isVisible?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class FilterPppConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isVisible?: boolean;
}

export class ReplicatePppConfigDto {
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
// PPP SURVEY DTOs
// ─────────────────────────────────────────────

export class PppScoreItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome' })
	outcomeId: number;

	@IsNumber()
	@Min(1)
	@Max(5)
	@ApiProperty({ example: 1, description: 'Puntaje del outcome (1.0 - 5.0)' })
	score: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'commentariesExample', required: false })
	commentaries?: string;
}

export class CreatePppSurveyDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del estudiante' })
	studentId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del campus/sede' })
	campusId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del programa/carrera' })
	programId: number;

	@IsNumber()
	@Min(1)
	@Max(2)
	@ApiProperty({ example: 1, description: 'Número de práctica (1 o 2)' })
	practiceNumber: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'companyNameExample', required: false })
	companyName?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'bossNameExample', required: false })
	bossName?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'bossRoleExample', required: false })
	bossRole?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '+51 999 999 999', required: false })
	phone?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'user@example.com', required: false })
	email?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'rucExample', required: false })
	ruc?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Total de horas de práctica', required: false })
	totalHours?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'startDateExample', required: false })
	startDate?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'endDateExample', required: false })
	endDate?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PppScoreItemDto)
	@ApiProperty({ example: {}, type: [PppScoreItemDto], description: 'Puntajes por competencia' })
	scores: PppScoreItemDto[];
}

export class FilterPppSurveyDto {
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
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	studentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Número de práctica (1 o 2)', required: false })
	practiceNumber?: number;
}

export class UploadPppExcelDto {
	@IsString()
	@ApiProperty({ example: 'fileBase64Example', description: 'Archivo Excel codificado en base64' })
	fileBase64: string;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del programa/carrera' })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del campus/sede' })
	campusId: number;
}

export class DashboardPppDto {
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
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Número de práctica (1 o 2)', required: false })
	practiceNumber?: number;
}

export class GenerateFindingsPppDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del programa/carrera' })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Número de práctica (1 o 2)', required: false })
	practiceNumber?: number;
}
