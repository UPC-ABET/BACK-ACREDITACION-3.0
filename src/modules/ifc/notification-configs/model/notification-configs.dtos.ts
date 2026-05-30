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
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	schoolId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	triggerTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	ifcStatusTypeId: number;

	@IsObject()
	@ApiProperty({ example: { es: 'title_es', en: 'title_en' }, required: true })
	title: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'body_es', en: 'body_en' }, required: true })
	body: I18nText;

	@ApiProperty({ example: { key: 'to_chart_level_type_ids_value' }, required: true })
	toChartLevelTypeIds: any;

	@ApiProperty({ example: { key: 'cc_chart_level_type_ids_value' }, required: true })
	ccChartLevelTypeIds: any;
}

export class UpdateNotificationConfigDto {
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
	schoolId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	triggerTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	ifcStatusTypeId?: number;

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
	toChartLevelTypeIds?: any;

	@IsOptional()
	@ApiProperty({ example: { key: 'cc_chart_level_type_ids_value' }, required: false })
	ccChartLevelTypeIds?: any;
}

export class FilterNotificationConfigDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	schoolId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	triggerTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	ifcStatusTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'title_es', en: 'title_en' }, required: false })
	title?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'body_es', en: 'body_en' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'to_chart_level_type_ids_value' }, required: false })
	toChartLevelTypeIds?: any;

	@IsOptional()
	@ApiProperty({ example: { key: 'cc_chart_level_type_ids_value' }, required: false })
	ccChartLevelTypeIds?: any;
}

// %% OTHER DTOS

export class UpsertNotificationConfigDto {
	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	academicPeriodId: number;

	@ApiProperty({
		example: 1,
		required: true,
		description: 'core.types.id from TG1002 (MANUAL or AUTO_STATUS_CHANGE)',
	})
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	triggerTypeId: number;

	@ApiProperty({
		example: 2,
		required: true,
		description: 'core.types.id from TG701 (the IFC status this config applies to)',
	})
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	ifcStatusTypeId: number;

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
	toChartLevelTypeIds?: number[];

	@ApiProperty({ example: [18, 17], required: false })
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	ccChartLevelTypeIds?: number[];

	@ApiProperty({ example: true, required: false })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}

export class NotificationConfigsByPeriodQueryDto {
	@ApiProperty({ example: 5, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	periodId: number;
}

export class NotificationConfigViewDto {
	@ApiProperty() id: number;
	@ApiProperty() schoolId: number;
	@ApiProperty() academicPeriodId: number;
	@ApiProperty() triggerTypeId: number;
	@ApiProperty() triggerCode: string;
	@ApiProperty({ type: Object }) triggerName: I18nText;
	@ApiProperty() ifcStatusTypeId: number;
	@ApiProperty() statusCode: string;
	@ApiProperty({ type: Object }) statusName: I18nText;
	@ApiProperty({ type: Object }) title: I18nText;
	@ApiProperty({ type: Object }) body: I18nText;
	@ApiProperty({ example: [19] }) toChartLevelTypeIds: number[];
	@ApiProperty({ example: [18] }) ccChartLevelTypeIds: number[];
	@ApiProperty() isActive: boolean;
}
