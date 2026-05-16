// no-override
import { IsArray, IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
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
	@ApiProperty({ example: { en: 'IFC update', es: 'Actualizacion IFC' }, required: true })
	title: I18nText;

	@IsObject()
	@ApiProperty({ example: { en: 'Body text', es: 'Texto del cuerpo' }, required: true })
	body: I18nText;

	@IsArray()
	@ApiProperty({ example: ['TG902-T003'], required: true })
	to_chart_level_type_ids: string[];

	@IsArray()
	@ApiProperty({ example: ['TG902-T002'], required: true })
	cc_chart_level_type_ids: string[];
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
	@ApiProperty({ example: { en: 'IFC update', es: 'Actualizacion IFC' }, required: false })
	title?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { en: 'Body text', es: 'Texto del cuerpo' }, required: false })
	body?: I18nText;

	@IsOptional()
	@IsArray()
	@ApiProperty({ example: ['TG902-T003'], required: false })
	to_chart_level_type_ids?: string[];

	@IsOptional()
	@IsArray()
	@ApiProperty({ example: ['TG902-T002'], required: false })
	cc_chart_level_type_ids?: string[];
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
}
