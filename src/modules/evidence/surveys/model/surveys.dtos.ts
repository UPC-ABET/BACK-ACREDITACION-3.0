import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateSurveyDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	survey_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	survey_status_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	student_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campus_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	program_id: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'information_es', en: 'information_en' }, required: false })
	information?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	survey_number?: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	course_section_id: number;
}

export class UpdateSurveyDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	survey_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	survey_status_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	student_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campus_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	program_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'information_es', en: 'information_en' }, required: false })
	information?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	survey_number?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	course_section_id?: number;
}

export class FilterSurveyDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	survey_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	survey_status_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	student_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campus_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	program_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'information_es', en: 'information_en' }, required: false })
	information?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	survey_number?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	course_section_id?: number;
}
