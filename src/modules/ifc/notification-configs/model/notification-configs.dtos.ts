import {
	IsArray,
	IsBoolean,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
	IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateNotificationConfigDto {
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
	trigger_type_id: number;

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

export class UpdateNotificationConfigDto {
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
	trigger_type_id?: number;

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

export class FilterNotificationConfigDto {
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
	trigger_type_id?: number;

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

// %% OTHER DTOS

export class UpsertNotificationConfigDto {
	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	academic_period_id: number;

	@ApiProperty({
		example: 1,
		required: true,
		description: 'core.types.id from TG1002 (MANUAL or AUTO_STATUS_CHANGE)',
	})
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	trigger_type_id: number;

	@ApiProperty({
		example: 2,
		required: true,
		description: 'core.types.id from TG701 (the IFC status this config applies to)',
	})
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	ifc_status_type_id: number;

	@ApiProperty({
		example: { es: 'IFC Enviado — {{course_name}}', en: 'IFC Submitted — {{course_name}}' },
		required: true,
	})
	@IsObject()
	title: I18nText;

	@ApiProperty({
		example: {
			es: '<p>Hola, {{submitter_name}} envió...</p>',
			en: '<p>Hi, {{submitter_name}} submitted...</p>',
		},
		required: true,
	})
	@IsObject()
	body: I18nText;

	@ApiProperty({
		example: [19],
		required: false,
		description: 'array of core.types.id from TG902 (chart level types)',
	})
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	to_chart_level_type_ids?: number[];

	@ApiProperty({ example: [18, 17], required: false })
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	cc_chart_level_type_ids?: number[];

	@ApiProperty({ example: true, required: false })
	@IsOptional()
	@IsBoolean()
	is_active?: boolean;
}

export class NotificationConfigsByPeriodQueryDto {
	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	period_id: number;
}

export class NotificationConfigViewDto {
	@ApiProperty() id: number;
	@ApiProperty() school_id: number;
	@ApiProperty() academic_period_id: number;
	@ApiProperty() trigger_type_id: number;
	@ApiProperty() trigger_code: string;
	@ApiProperty({ type: Object }) trigger_name: I18nText;
	@ApiProperty() ifc_status_type_id: number;
	@ApiProperty() status_code: string;
	@ApiProperty({ type: Object }) status_name: I18nText;
	@ApiProperty({ type: Object }) title: I18nText;
	@ApiProperty({ type: Object }) body: I18nText;
	@ApiProperty({ example: [19] }) to_chart_level_type_ids: number[];
	@ApiProperty({ example: [18] }) cc_chart_level_type_ids: number[];
	@ApiProperty() is_active: boolean;
}
