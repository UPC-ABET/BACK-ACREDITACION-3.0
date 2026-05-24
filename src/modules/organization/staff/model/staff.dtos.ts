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
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	user_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	position_type_id: number;

	@IsObject()
	@ApiProperty({ example: { es: 'job_title_es', en: 'job_title_en' }, required: true })
	job_title: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'job_description_es', en: 'job_description_en' }, required: true })
	job_description: I18nText;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_email_example', required: true })
	staff_email: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_phone_example', required: true })
	staff_phone: string;
}

export class UpdateStaffDto {
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
	user_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	position_type_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'job_title_es', en: 'job_title_en' }, required: false })
	job_title?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'job_description_es', en: 'job_description_en' }, required: false })
	job_description?: I18nText;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_email_example', required: false })
	staff_email?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staff_phone_example', required: false })
	staff_phone?: string;
}

export class FilterStaffDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	user_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	position_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'job_title_es', en: 'job_title_en' }, required: false })
	job_title?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'job_description_es', en: 'job_description_en' }, required: false })
	job_description?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 'staff_email_example', required: false })
	staff_email?: string;

	@IsOptional()
	@ApiProperty({ example: 'staff_phone_example', required: false })
	staff_phone?: string;
}
