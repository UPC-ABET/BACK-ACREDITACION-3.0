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
// CREATE
// ─────────────────────────────────────────────

export class CreatePerformanceLevelDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Academic period ID' })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Survey type ID (PPP, GRA, LCFC)' })
	surveyTypeId: number;

	@IsObject()
	@ApiProperty({ example: { es: 'Satisfactory', en: 'Satisfactory' } })
	name: Record<string, string>;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Display order' })
	order: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Minimum score (inclusive)' })
	minScore: number;

	@IsNumber()
	@ApiProperty({ example: 2, description: 'Maximum score (exclusive, except for the final level)' })
	maxScore: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '#68D391', description: 'Hex color for UI display', required: false })
	color?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({
		example: false,
		description: 'True if this is the highest/final level',
		required: false,
	})
	isFinal?: boolean;
}

// ─────────────────────────────────────────────
// FILTER
// ─────────────────────────────────────────────

export class FilterPerformanceLevelDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Academic period ID' })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Survey type ID (PPP, GRA, LCFC)' })
	surveyTypeId: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'TG601-T002',
		description: 'Survey type code (alternative to surveyTypeId)',
		required: false,
	})
	surveyTypeCode?: string;
}

// ─────────────────────────────────────────────
// UPDATE (individual)
// ─────────────────────────────────────────────

export class UpdatePerformanceLevelDto {
	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Satisfactory', en: 'Satisfactory' }, required: false })
	name?: Record<string, string>;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	minScore?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 2, required: false })
	maxScore?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '#68D391', required: false })
	color?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	order?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: false, required: false })
	isFinal?: boolean;
}

// ─────────────────────────────────────────────
// UPDATE (bulk)
// ─────────────────────────────────────────────

export class UpdatePerformanceLevelItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Performance level ID' })
	id: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Satisfactory', en: 'Satisfactory' }, required: false })
	name?: Record<string, string>;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	minScore?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 2, required: false })
	maxScore?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '#68D391', required: false })
	color?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	order?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: false, required: false })
	isFinal?: boolean;
}

export class BulkUpdatePerformanceLevelsDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UpdatePerformanceLevelItemDto)
	@ApiProperty({
		example: [{ id: 1, minScore: 1, maxScore: 2 }],
		type: [UpdatePerformanceLevelItemDto],
	})
	items: UpdatePerformanceLevelItemDto[];
}

// ─────────────────────────────────────────────
// GENERATE DEFAULTS
// ─────────────────────────────────────────────

export class GenerateDefaultPerformanceLevelsDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Academic period ID' })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Survey type ID' })
	surveyTypeId: number;
}

// ─────────────────────────────────────────────
// COPY (used internally by replicate)
// ─────────────────────────────────────────────

export class CopyPerformanceLevelsDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Survey type ID' })
	surveyTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Source academic period ID' })
	sourceAcademicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 2, description: 'Target academic period ID' })
	targetAcademicPeriodId: number;
}
