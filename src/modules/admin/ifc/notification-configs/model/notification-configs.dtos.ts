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
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: true })
	title: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'bodyEs', en: 'bodyEn' }, required: true })
	body: I18nText;

	@ApiProperty({ example: { key: 'toChartLevelTypeIdsValue' }, required: true })
	toChartLevelTypeIds: any;

	@ApiProperty({ example: { key: 'ccChartLevelTypeIdsValue' }, required: true })
	ccChartLevelTypeIds: any;
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
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: false })
	title?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'bodyEs', en: 'bodyEn' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'toChartLevelTypeIdsValue' }, required: false })
	toChartLevelTypeIds?: any;

	@IsOptional()
	@ApiProperty({ example: { key: 'ccChartLevelTypeIdsValue' }, required: false })
	ccChartLevelTypeIds?: any;
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
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: false })
	title?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'bodyEs', en: 'bodyEn' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'toChartLevelTypeIdsValue' }, required: false })
	toChartLevelTypeIds?: any;

	@IsOptional()
	@ApiProperty({ example: { key: 'ccChartLevelTypeIdsValue' }, required: false })
	ccChartLevelTypeIds?: any;
}

// %% OTHER DTOS

export class UpsertNotificationConfigDto {
	@ApiProperty({ example: 1, required: true })
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
		example: 1,
		required: true,
		description: 'core.types.id from TG701 (the IFC status this config applies to)',
	})
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	ifcStatusTypeId: number;

	@ApiProperty({
		example: { es: 'titleEs', en: 'titleEn' },
		required: true,
	})
	@IsObject()
	title: I18nText;

	@ApiProperty({
		example: { es: 'bodyEs', en: 'bodyEn' },
		required: true,
	})
	@IsObject()
	body: I18nText;

	@ApiProperty({
		example: [1, 2, 3],
		required: false,
		description: 'array of core.types.id from TG902 (chart level types)',
	})
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	toChartLevelTypeIds?: number[];

	@ApiProperty({ example: [1, 2, 3], required: false })
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
	@ApiProperty({ example: 1, required: true })
	@IsInt()
	@IsPositive()
	@Type(() => Number)
	periodId: number;
}

export class NotificationConfigViewDto {
	@ApiProperty({ example: 1 }) id: number;
	@ApiProperty({ example: 1 }) schoolId: number;
	@ApiProperty({ example: 1 }) academicPeriodId: number;
	@ApiProperty({ example: 1 }) triggerTypeId: number;
	@ApiProperty({ example: 'triggerCodeExample' }) triggerCode: string;
	@ApiProperty({ example: { es: 'triggerNameEs', en: 'triggerNameEn' }, type: Object })
	triggerName: I18nText;
	@ApiProperty({ example: 1 }) ifcStatusTypeId: number;
	@ApiProperty({ example: 'statusCodeExample' }) statusCode: string;
	@ApiProperty({ example: { es: 'statusNameEs', en: 'statusNameEn' }, type: Object })
	statusName: I18nText;
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, type: Object }) title: I18nText;
	@ApiProperty({ example: { es: 'bodyEs', en: 'bodyEn' }, type: Object }) body: I18nText;
	@ApiProperty({ example: [1, 2, 3] }) toChartLevelTypeIds: number[];
	@ApiProperty({ example: [1, 2, 3] }) ccChartLevelTypeIds: number[];
	@ApiProperty({ example: true }) isActive: boolean;
}
