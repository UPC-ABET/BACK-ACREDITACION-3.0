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

export class CreateGraConfigDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID of the linked academic outcome' })
	outcomeId: number;

	@IsString()
	@ApiProperty({ example: 'Communication', description: 'Outcome name in Spanish' })
	nameEs: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Communication', required: false })
	nameEn?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Effective oral and written communication', required: false })
	descriptionEs?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Effective oral and written communication', required: false })
	descriptionEn?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Display order', required: false })
	order?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program ID', required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Commission ID (WASC, non-WASC, etc.)',
		required: false,
	})
	commissionId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, description: 'Visible in the survey', required: false })
	isVisible?: boolean;
}

export class UpdateGraConfigDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	outcomeId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Communication', required: false })
	nameEs?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Communication', required: false })
	nameEn?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Effective oral and written communication', required: false })
	descriptionEs?: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Effective oral and written communication', required: false })
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
	@ApiProperty({ example: 1, description: 'Commission ID', required: false })
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
	@ApiProperty({ example: 1, description: 'Filter by commission', required: false })
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

export class ReplicateGraConfigDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Source academic period ID (to copy from)' })
	sourceAcademicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 2, description: 'Target academic period ID (new period)' })
	targetAcademicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Filter by program (optional)',
		required: false,
	})
	programId?: number;
}

export class ListGraSurveyOutcomesDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program ID' })
	programId: number;
}

export class SaveGraNotificationDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'ID of the student to add' })
	studentId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program ID' })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Campus ID' })
	campusId: number;

	@IsString()
	@ApiProperty({
		example: '2025-12-31',
		description: 'Deadline for completing the survey',
	})
	maxRegisterDate: string;
}

export class BulkUploadGraNotificationDto {
	@IsString()
	@ApiProperty({ example: 'fileBase64Example', description: 'Base64-encoded Excel file' })
	fileBase64: string;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program ID' })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Campus ID' })
	campusId: number;

	@IsString()
	@ApiProperty({ example: '2025-12-31', description: 'Deadline for completing the survey' })
	maxRegisterDate: string;
}

export class UpdateGraEmailTemplateDto {
	@IsString()
	@ApiProperty({ example: 'Encuesta de Graduandos', description: 'Subject (Spanish)' })
	subjectEs: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Graduate Survey', description: 'Subject (English)', required: false })
	subjectEn?: string;

	@IsString()
	@ApiProperty({
		example: '<p>Hola {{student_name}}, completa la encuesta: {{survey_link}}</p>',
		description:
			'HTML body (Spanish). Placeholders: {{student_name}}, {{program_name}}, {{survey_link}}, {{token}}',
	})
	bodyEs: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: '<p>Hi {{student_name}}...</p>', required: false })
	bodyEn?: string;
}

export class ListStudentsGraDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'U20231001',
		description: 'Filter by student code',
		required: false,
	})
	studentCode?: string;
}

export class SendGraEmailDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Filter by program (optional, 0 = all)',
		required: false,
	})
	programId?: number;

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

export class GetSurveyByTokenDto {
	@IsString()
	@ApiProperty({
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'Unique survey token',
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

export class GraScoreItemDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'GRA config outcome ID' })
	outcomeConfigId: number;

	@IsNumber()
	@Min(1)
	@Max(5)
	@ApiProperty({ example: 4, description: 'Outcome score (1 – 5)' })
	score: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Student demonstrates strong written communication.', required: false })
	commentaries?: string;
}

export class CompleteGraSurveyDto {
	@IsString()
	@ApiProperty({
		example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: 'Unique survey token',
	})
	token: string;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'Overall strong performance.', required: false })
	commentaries?: string;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => GraScoreItemDto)
	@ApiProperty({
		example: [{ outcomeConfigId: 1, score: 4, commentaries: 'Good communication skills.' }],
		type: [GraScoreItemDto],
		description: 'Scores per GRA outcome',
	})
	scores: GraScoreItemDto[];
}

export class DashboardGraDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;
}
