import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateNotificationConfigDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	school_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	trigger_event_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	ifc_status_type_id: number;

	@IsObject()
	@ApiProperty({ example: { es: 'title_es', en: 'title_en' }, required: true })
	title: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'body_es', en: 'body_en' }, required: true })
	body: I18nText;

	@ApiProperty({ example: { key: 'to_chart_level_type_ids_value' }, required: true })
	to_chart_level_type_ids: any;

	@ApiProperty({ example: { key: 'cc_chart_level_type_ids_value' }, required: true })
	cc_chart_level_type_ids: any;
}

export class UpdateNotificationConfigDto extends BaseDto {
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
	school_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	trigger_event_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	ifc_status_type_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'title_es', en: 'title_en' }, required: false })
	title?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'body_es', en: 'body_en' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'to_chart_level_type_ids_value' }, required: false })
	to_chart_level_type_ids?: any;

	@IsOptional()
	@ApiProperty({ example: { key: 'cc_chart_level_type_ids_value' }, required: false })
	cc_chart_level_type_ids?: any;
}

export class FilterNotificationConfigDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	school_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	trigger_event_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	ifc_status_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'title_es', en: 'title_en' }, required: false })
	title?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'body_es', en: 'body_en' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'to_chart_level_type_ids_value' }, required: false })
	to_chart_level_type_ids?: any;

	@IsOptional()
	@ApiProperty({ example: { key: 'cc_chart_level_type_ids_value' }, required: false })
	cc_chart_level_type_ids?: any;
}
