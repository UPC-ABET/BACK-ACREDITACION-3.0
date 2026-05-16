import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────
// PPP CONFIG DTOs
// ─────────────────────────────────────────────

export class CreatePppConfigDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome académico vinculado' })
	outcome_id: number;

	@IsString()
	@ApiProperty({ example: 'Comunicación efectiva', description: 'Nombre de la competencia en español' })
	name_es: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Effective communication', description: 'Nombre en inglés', required: false })
	name_en?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Capacidad para expresar ideas con claridad', required: false })
	description_es?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Ability to express ideas clearly', required: false })
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
	@IsBoolean()
	@ApiProperty({ example: true, description: 'Visible en la encuesta', required: false })
	is_visible?: boolean;
}

export class UpdatePppConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	outcome_id?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Comunicación efectiva', required: false })
	name_es?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Effective communication', required: false })
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
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_visible?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
}

export class FilterPppConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, required: false })
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 3, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_visible?: boolean;
}

export class ReplicatePppConfigDto {
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
// PPP SURVEY DTOs
// ─────────────────────────────────────────────

export class PppScoreItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del outcome' })
	outcome_id: number;

	@IsNumber()
	@Min(1)
	@Max(5)
	@ApiProperty({ example: 4.5, description: 'Puntaje del outcome (1.0 - 5.0)' })
	score: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Demostró excelente manejo del tema', required: false })
	commentaries?: string;
}

export class CreatePppSurveyDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del estudiante' })
	student_id: number;

	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 2, description: 'ID del campus/sede' })
	campus_id: number;

	@IsNumber()
	@ApiProperty({ example: 5, description: 'ID del programa/carrera' })
	program_id: number;

	@IsNumber()
	@Min(1)
	@Max(2)
	@ApiProperty({ example: 1, description: 'Número de práctica (1 o 2)' })
	practice_number: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Tech Corp S.A.C.', required: false })
	company_name?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Juan Pérez', required: false })
	boss_name?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Jefe de Proyectos', required: false })
	boss_role?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '+51987654321', required: false })
	phone?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'jefe@techcorp.com', required: false })
	email?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '20123456789', required: false })
	ruc?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 160, description: 'Total de horas de práctica', required: false })
	total_hours?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '2024-03-01', required: false })
	start_date?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '2024-07-31', required: false })
	end_date?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => PppScoreItemDto)
	@ApiProperty({ type: [PppScoreItemDto], description: 'Puntajes por competencia' })
	scores: PppScoreItemDto[];
}

export class FilterPppSurveyDto {
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
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	student_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Número de práctica (1 o 2)', required: false })
	practice_number?: number;
}

export class UploadPppExcelDto {
	@IsString()
	@ApiProperty({ description: 'Archivo Excel codificado en base64' })
	file_base64: string;

	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 5, description: 'ID del programa/carrera' })
	program_id: number;

	@IsNumber()
	@ApiProperty({ example: 2, description: 'ID del campus/sede' })
	campus_id: number;
}

export class DashboardPppDto {
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
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Número de práctica (1 o 2)', required: false })
	practice_number?: number;
}

export class GenerateFindingsPppDto {
	@IsNumber()
	@ApiProperty({ example: 5, description: 'ID del programa/carrera' })
	program_id: number;

	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academic_period_id: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 2, required: false })
	campus_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Número de práctica (1 o 2)', required: false })
	practice_number?: number;
}
