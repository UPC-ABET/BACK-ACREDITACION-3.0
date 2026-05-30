import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateStaffDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	userId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	positionTypeId: number;

	@IsObject()
	@ApiProperty({ example: { es: 'job_title_es', en: 'job_title_en' }, required: true })
	jobTitle: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'job_description_es', en: 'job_description_en' }, required: true })
	jobDescription: I18nText;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_email_example', required: true })
	staffEmail: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_phone_example', required: true })
	staffPhone: string;
}

export class UpdateStaffDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	userId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	positionTypeId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'job_title_es', en: 'job_title_en' }, required: false })
	jobTitle?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'job_description_es', en: 'job_description_en' }, required: false })
	jobDescription?: I18nText;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_email_example', required: false })
	staffEmail?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_phone_example', required: false })
	staffPhone?: string;
}

export class FilterStaffDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	userId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	positionTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'job_title_es', en: 'job_title_en' }, required: false })
	jobTitle?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'job_description_es', en: 'job_description_en' }, required: false })
	jobDescription?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 'staff_email_example', required: false })
	staffEmail?: string;

	@IsOptional()
	@ApiProperty({ example: 'staff_phone_example', required: false })
	staffPhone?: string;
}
