import {
	IsArray,
	IsBoolean,
	IsInt,
	IsIn,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
	Min,
	Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { I18nText } from 'src/shared/types/i18n';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

const toOptionalPositiveInt = ({ value }: { value: unknown }): number | undefined =>
	Number(value) > 0 ? Number(value) : undefined;

export class LcfcProgramQueryDto {
	@IsOptional()
	@IsInt()
	@Transform(toOptionalPositiveInt)
	@ApiPropertyOptional({ example: 1, type: Number, description: 'Program/Carrera ID' })
	programId?: number;
}

export class LcfcSectionCommissionsQueryDto extends LcfcProgramQueryDto {
	@IsInt()
	@Type(() => Number)
	@ApiProperty({ example: 1, description: 'Course section ID' })
	courseSectionId: number;
}

export class LcfcReportQueryDto extends LcfcProgramQueryDto {
	@IsOptional()
	@IsIn(['es', 'en'])
	@Transform(({ value }) => (value === 'en' ? 'en' : 'es'))
	@ApiPropertyOptional({ example: 'es', enum: ['es', 'en'], description: 'Report language' })
	lang?: 'es' | 'en';

	@IsOptional()
	@IsIn(['course', 'section'])
	@ApiPropertyOptional({
		example: 'section',
		enum: ['course', 'section'],
		description:
			'Breakdown granularity for the by-course table: "course" aggregates every section ' +
			'together (no professor/section shown), "section" breaks down per NRC with its professor',
	})
	groupBy?: 'course' | 'section';

	@IsOptional()
	@IsInt()
	@Transform(toOptionalPositiveInt)
	@ApiPropertyOptional({ example: 1, type: Number, description: 'Filter by course (curso)' })
	courseId?: number;

	@IsOptional()
	@IsInt()
	@Transform(toOptionalPositiveInt)
	@ApiPropertyOptional({ example: 1, type: Number, description: 'Filter by course section (NRC)' })
	courseSectionId?: number;

	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => value === true || value === 'true')
	@ApiPropertyOptional({
		example: false,
		description:
			'When true, omits the "Encuestas por curso" breakdown table entirely (curso = "Agrupar")',
	})
	hideCourseBreakdown?: boolean;
}

export class GenerateLcfcConfigDto {
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Modality type ID (must match the academic period and program modality)',
	})
	modalityTypeId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Program ID (optional; omit to generate for all active sections)',
		required: false,
	})
	programId?: number;

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
	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 5,
		description:
			'Source academic period ID to copy status from. If omitted, the backend automatically uses the period immediately before targetAcademicPeriodId (same modality, ordered by start_date).',
		required: false,
	})
	sourceAcademicPeriodId?: number;

	@IsNumber()
	@ApiProperty({
		example: 7,
		description: 'Target academic period ID (configs will be generated here)',
	})
	targetAcademicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Program ID (optional; omit to clone for all programs)',
		required: false,
	})
	programId?: number;
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

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Outcome evaluated by this LCFC config (chosen in the edit modal).',
	})
	outcomeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description:
			'Commission selected for this LCFC config (survey shows outcomes of this commission filtered by student career).',
	})
	commissionId?: number;
}

export class FilterLcfcConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class ListLcfcSectionsDto extends PaginationQueryDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ example: 'Cálculo', description: 'Search by course name or section code' })
	search?: string;
}

export class SetLcfcDeadlineDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Program ID (optional; omit to set deadline for all configs in the period)',
		required: false,
	})
	programId?: number;

	@IsString()
	@ApiProperty({ example: '2026-06-30T23:59:59.000Z', description: 'Survey deadline (ISO date)' })
	maxRegisterDate: string;
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

	@IsOptional()
	@IsBoolean()
	@ApiProperty({
		example: false,
		description:
			'Resend the survey to students who already received it (reuses the existing token and refreshes the deadline). Defaults to false.',
		required: false,
	})
	resend?: boolean;
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
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Filter by course (curso)', required: false })
	courseId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Filter by course section (NRC)', required: false })
	courseSectionId?: number;
}

export class ListLcfcOutcomesDto {
	@IsInt()
	@Type(() => Number)
	@ApiProperty({ example: 1, description: 'Program/Carrera ID' })
	programId: number;

	@IsInt()
	@Type(() => Number)
	@ApiProperty({ example: 1, description: 'Commission ID' })
	commissionId: number;
}

export class LcfcOutcomeReportDto {
	@IsInt()
	@Type(() => Number)
	@ApiProperty({ example: 1, description: 'Program/Carrera ID' })
	programId: number;

	@IsInt()
	@Type(() => Number)
	@ApiProperty({ example: 1, description: 'Commission ID' })
	commissionId: number;

	@IsOptional()
	@IsInt()
	@Type(() => Number)
	@ApiProperty({
		example: 1,
		description: 'Outcome ID. Omit to generate one PDF per outcome configured for the commission.',
		required: false,
	})
	outcomeId?: number;

	@IsOptional()
	@IsIn(['es', 'en'])
	@ApiProperty({ example: 'es', description: 'Report language: es | en', required: false })
	lang?: 'es' | 'en';
}
