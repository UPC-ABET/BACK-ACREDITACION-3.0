import {
	ArrayNotEmpty,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsIn,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export class CreateChartNodeDto {
	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Parent chart node id' })
	rootChartId: number;

	@IsInt()
	@ApiProperty({ example: 1, required: true })
	staffId: number;

	@IsObject()
	@ApiProperty({ example: { es: 'Coordinador', en: 'Coordinator' }, required: true })
	title: I18nText;

	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Entity type id (TG903)' })
	entityTypeId: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Referenced entity id; omit for Area/Subarea',
	})
	entityCode?: number;
}

export class UpdateChartNodeDto {
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Coordinador', en: 'Coordinator' }, required: false })
	title?: I18nText;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, description: 'Entity type id (TG903)' })
	entityTypeId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Referenced entity id; omit for Area/Subarea',
	})
	entityCode?: number;
}

export class ResetMaintenancePasswordsDto {
	@IsArray()
	@ArrayNotEmpty()
	@ArrayUnique()
	@IsIn(Object.values(TYPE_CODES.ENTITY_TYPE), { each: true })
	@ApiProperty({
		type: [String],
		example: [TYPE_CODES.ENTITY_TYPE.SCHOOL, TYPE_CODES.ENTITY_TYPE.PROGRAM],
		required: true,
		description: 'Entity type codes (TG903) whose chart node users get their password reset',
	})
	entityTypeCodes: string[];
}

export class ResetMaintenancePasswordsResetUserDto {
	@ApiProperty({ example: 12, description: 'Reset user id' })
	userId: number;

	@ApiProperty({ example: 'Ada' })
	firstName: string;

	@ApiProperty({ example: 'Lovelace' })
	lastName: string;

	@ApiProperty({
		type: [Number],
		example: [45, 50],
		description: 'Chart node ids that resolved to this user',
	})
	chartIds: number[];
}

export class ResetMaintenancePasswordsSkippedNodeDto {
	@ApiProperty({ example: 30, description: 'Chart node id with no linked (active) login user' })
	chartId: number;

	@ApiProperty({ example: 40 })
	staffId: number;

	@ApiProperty({ example: TYPE_CODES.ENTITY_TYPE.COURSE })
	entityTypeCode: string;
}

export class ResetMaintenancePasswordsResponseDto {
	@ApiProperty({ type: [ResetMaintenancePasswordsResetUserDto] })
	reset: ResetMaintenancePasswordsResetUserDto[];

	@ApiProperty({ type: [ResetMaintenancePasswordsSkippedNodeDto] })
	skipped: ResetMaintenancePasswordsSkippedNodeDto[];
}

export class CreateChartDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	staffId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rootChartId?: number;

	@IsObject()
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: true })
	title: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entityTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entityCode?: number;
}

export class UpdateChartDto {
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
	staffId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rootChartId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: false })
	title?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entityTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	entityCode?: number;
}

export class FilterChartDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rootChartId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: false })
	title?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	entityTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	entityCode?: number;
}
