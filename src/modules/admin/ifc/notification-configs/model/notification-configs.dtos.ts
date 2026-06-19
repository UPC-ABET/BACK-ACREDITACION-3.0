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
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	triggerTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	ifcStatusTypeId: number;

	@IsNumber()
	@ApiProperty({
		example: 1,
		required: true,
		description: 'core.email_templates.id (IFC category)',
	})
	emailTemplateId: number;

	@ApiProperty({ example: { key: 'toChartEntityTypeIdsValue' }, required: true })
	toChartEntityTypeIds: any;

	@ApiProperty({ example: { key: 'ccChartEntityTypeIdsValue' }, required: true })
	ccChartEntityTypeIds: any;
}

export class UpdateNotificationConfigDto {
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
	triggerTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	ifcStatusTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	emailTemplateId?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'toChartEntityTypeIdsValue' }, required: false })
	toChartEntityTypeIds?: any;

	@IsOptional()
	@ApiProperty({ example: { key: 'ccChartEntityTypeIdsValue' }, required: false })
	ccChartEntityTypeIds?: any;
}

export class FilterNotificationConfigDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	triggerTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	ifcStatusTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	emailTemplateId?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'toChartEntityTypeIdsValue' }, required: false })
	toChartEntityTypeIds?: any;

	@IsOptional()
	@ApiProperty({ example: { key: 'ccChartEntityTypeIdsValue' }, required: false })
	ccChartEntityTypeIds?: any;
}

// %% OTHER DTOS

export class UpsertNotificationConfigDto {
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
		example: 1,
		required: true,
		description: 'core.types.id from TG701 (the IFC status this config applies to)',
	})
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	ifcStatusTypeId: number;

	@ApiProperty({ example: { es: 'Plantilla IFC', en: 'IFC template' }, required: true })
	@IsObject()
	name: I18nText;

	@ApiProperty({ example: { es: 'Asunto', en: 'Subject' }, required: true })
	@IsObject()
	subject: I18nText;

	@ApiProperty({
		example: { es: 'Hola {{course_name}}', en: 'Hi {{course_name}}' },
		required: true,
	})
	@IsObject()
	body: I18nText;

	@ApiProperty({
		example: [1, 2, 3],
		required: false,
		description: 'array of core.types.id from TG903 (chart entity types)',
	})
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	toChartEntityTypeIds?: number[];

	@ApiProperty({ example: [1, 2, 3], required: false })
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	ccChartEntityTypeIds?: number[];

	@ApiProperty({ example: true, required: false })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean;
}

export class NotificationConfigViewDto {
	@ApiProperty({ example: 1 }) id: number;
	@ApiProperty({ example: 1 }) triggerTypeId: number;
	@ApiProperty({ example: 'triggerCodeExample' }) triggerCode: string;
	@ApiProperty({ example: { es: 'triggerNameEs', en: 'triggerNameEn' }, type: Object })
	triggerName: I18nText;
	@ApiProperty({ example: 1 }) ifcStatusTypeId: number;
	@ApiProperty({ example: 'statusCodeExample' }) statusCode: string;
	@ApiProperty({ example: { es: 'statusNameEs', en: 'statusNameEn' }, type: Object })
	statusName: I18nText;
	@ApiProperty({ example: 1 }) emailTemplateId: number;
	@ApiProperty({ example: { es: 'Plantilla IFC', en: 'IFC template' }, type: Object })
	name: I18nText;
	@ApiProperty({ example: { es: 'Asunto', en: 'Subject' }, type: Object }) subject: I18nText;
	@ApiProperty({ example: { es: 'Cuerpo', en: 'Body' }, type: Object }) body: I18nText;
	@ApiProperty({ example: [1, 2, 3] }) toChartEntityTypeIds: number[];
	@ApiProperty({ example: [1, 2, 3] }) ccChartEntityTypeIds: number[];
	@ApiProperty({ example: true }) isActive: boolean;
}
