import {
	IsArray,
	IsBoolean,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─────────────────────────────────────────────
// FILTER
// ─────────────────────────────────────────────

export class FilterAcceptanceLevelDto {
	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del tipo de encuesta (PPP, GRA, LCFC)' })
	surveyTypeId: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'PPP',
		description: 'Código del tipo de encuesta (alternativa a survey_type_id)',
		required: false,
	})
	surveyTypeCode?: string;
}

// ─────────────────────────────────────────────
// UPDATE (bulk)
// ─────────────────────────────────────────────

export class UpdateAcceptanceLevelItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del nivel de aceptación' })
	id: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Excelente', en: 'Excellent' }, required: false })
	name?: Record<string, string>;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 4.2, required: false })
	minScore?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5.0, required: false })
	maxScore?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '#276749', required: false })
	color?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 5, required: false })
	order?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: false, required: false })
	isFinal?: boolean;
}

export class BulkUpdateAcceptanceLevelsDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdateAcceptanceLevelItemDto)
	@ApiProperty({ type: [UpdateAcceptanceLevelItemDto] })
	items: UpdateAcceptanceLevelItemDto[];
}

// ─────────────────────────────────────────────
// GENERATE DEFAULTS
// ─────────────────────────────────────────────

export class GenerateDefaultAcceptanceLevelsDto {
	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico' })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del tipo de encuesta' })
	surveyTypeId: number;
}

// ─────────────────────────────────────────────
// COPY (used internally by replicate)
// ─────────────────────────────────────────────

export class CopyAcceptanceLevelsDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID del tipo de encuesta' })
	surveyTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 2, description: 'ID del período académico origen' })
	sourceAcademicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 3, description: 'ID del período académico destino' })
	targetAcademicPeriodId: number;
}
