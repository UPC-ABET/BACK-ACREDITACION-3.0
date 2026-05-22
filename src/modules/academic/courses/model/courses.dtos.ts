import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateCourseDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: true })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: true })
	name: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: true })
	description: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'learning_outcome_es', en: 'learning_outcome_en' }, required: true })
	learning_outcome: I18nText;
}

export class UpdateCourseDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'learning_outcome_es', en: 'learning_outcome_en' }, required: false })
	learning_outcome?: I18nText;
}

export class FilterCourseDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 'code_example', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'learning_outcome_es', en: 'learning_outcome_en' }, required: false })
	learning_outcome?: I18nText;

	// Filters by related entities

    @IsOptional() @IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID del período académico' })
    academic_period_id?: number;

    @IsOptional() @IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID de la carrera' })
    program_id?: number;

    @IsOptional() @IsString()
	@ApiProperty({ example: 'EISC', required: false, description: 'Código de la escuela' })
    school_code?: string;
}
