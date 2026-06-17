import {
	IsArray,
	IsBoolean,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
	Min,
	Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import type { I18nText } from 'src/shared/types/i18n';

export class GenerateLcfcConfigDto {
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Modality type ID (must match the academic period and program modality)',
	})
	modalityTypeId: number;

	@IsNumber()
	@ApiProperty({
		example: 1,
		description:
			'Academic period ID for which configurations are generated. Must be the latest period for the given modality',
	})
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program ID' })
	programId: number;

	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	@ApiProperty({
		example: [55, 56, 57],
		description:
			'Specific course section IDs to generate configs for. If omitted, generates for all non-elective sections of the active study plan.',
		required: false,
		type: [Number],
	})
	courseSectionIds?: number[];
}

export class CloneLcfcConfigDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Source academic period ID (to copy status from)' })
	sourceAcademicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 2, description: 'Target academic period ID (generated and updated)' })
	targetAcademicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program ID' })
	programId: number;
}

export class UpdateLcfcConfigDto {
	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'nombreEs', en: 'nameEn' }, required: false })
	userOutcomeName?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'descripcionEs', en: 'descriptionEn' }, required: false })
	userOutcomeDescription?: I18nText;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
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
		description: 'LCFC configuration record ID (outcome_config.id)',
	})
	configId: number;

	@IsBoolean()
	@ApiProperty({ example: true, description: 'true = active for LCFC, false = inactive' })
	isActive: boolean;
}

export class UpdateLcfcConfigStatusDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => LcfcConfigStatusItemDto)
	@ApiProperty({
		example: [{ configId: 1, isActive: true }],
		type: [LcfcConfigStatusItemDto],
		description: 'List of configurations with their new status',
	})
	updates: LcfcConfigStatusItemDto[];
}

export class SendLcfcNotificationDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Academic period ID' })
	academicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Filter by program (optional)', required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Filter by campus (optional)', required: false })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Send only for this course section (optional, 0 = all active)',
		required: false,
	})
	courseSectionId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: '2025-12-31',
		description: 'Deadline for completing the survey',
		required: false,
	})
	maxRegisterDate?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'https://app.example.com',
		description: 'Frontend base URL used to build the survey link',
		required: false,
	})
	surveyBaseUrl?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'es',
		description: 'Email language: es | en (defaults to es)',
		required: false,
	})
	lang?: 'es' | 'en';
}

export class GetLcfcSurveyByTokenDto {
	@IsString()
	@ApiProperty({
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'Unique LCFC survey token',
	})
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'es',
		description: 'Response language: es | en',
		required: false,
	})
	language?: string;
}

export class LcfcScoreItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Outcome ID from accreditation.outcomes' })
	outcomeId: number;

	@IsNumber()
	@Min(1)
	@Max(10)
	@ApiProperty({ example: 7, description: 'Outcome score (1 – 10)' })
	score: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Student shows solid understanding of the topic.', required: false })
	commentaries?: string;
}

export class CompleteLcfcSurveyDto {
	@IsString()
	@ApiProperty({
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'Unique LCFC survey token',
	})
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Overall good performance.', required: false })
	commentaries?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => LcfcScoreItemDto)
	@ApiProperty({
		example: [{ outcomeId: 1, score: 7, commentaries: 'Meets expectations.' }],
		type: [LcfcScoreItemDto],
		description: 'Scores per course outcome (1–10)',
	})
	scores: LcfcScoreItemDto[];
}

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
