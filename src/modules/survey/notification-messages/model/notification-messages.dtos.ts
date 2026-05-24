import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateNotificationMessageDto {
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
	program_id: number;

	@IsObject()
	@ApiProperty({ example: { es: 'title_es', en: 'title_en' }, required: true })
	title: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'body_es', en: 'body_en' }, required: true })
	body: I18nText;

	@ApiProperty({ example: { key: 'cc_receivers_value' }, required: true })
	cc_receivers: any;
}

export class UpdateNotificationMessageDto {
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
	program_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'title_es', en: 'title_en' }, required: false })
	title?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'body_es', en: 'body_en' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'cc_receivers_value' }, required: false })
	cc_receivers?: any;
}

export class FilterNotificationMessageDto {
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
	program_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'title_es', en: 'title_en' }, required: false })
	title?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'body_es', en: 'body_en' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'cc_receivers_value' }, required: false })
	cc_receivers?: any;
}
