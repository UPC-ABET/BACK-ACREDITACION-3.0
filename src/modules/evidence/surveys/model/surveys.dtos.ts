import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateSurveyDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	surveyTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	surveyStatusTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	studentId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campusId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	programId: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'informationEs', en: 'informationEn' }, required: false })
	information?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	surveyNumber?: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	courseSectionId: number;
}

export class UpdateSurveyDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	surveyTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	surveyStatusTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	studentId?: number;

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
	programId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'informationEs', en: 'informationEn' }, required: false })
	information?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	surveyNumber?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	courseSectionId?: number;
}

export class FilterSurveyDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	surveyTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	surveyStatusTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	studentId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'informationEs', en: 'informationEn' }, required: false })
	information?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	surveyNumber?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	courseSectionId?: number;
}
