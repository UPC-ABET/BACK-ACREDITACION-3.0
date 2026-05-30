import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateNotificationMessageDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	surveyTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	programId: number;

	@IsObject()
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: true })
	title: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'bodyEs', en: 'bodyEn' }, required: true })
	body: I18nText;

	@ApiProperty({ example: { key: 'ccReceiversValue' }, required: true })
	ccReceivers: any;
}

export class UpdateNotificationMessageDto {
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
	surveyTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: false })
	title?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'bodyEs', en: 'bodyEn' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'ccReceiversValue' }, required: false })
	ccReceivers?: any;
}

export class FilterNotificationMessageDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	surveyTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'titleEs', en: 'titleEn' }, required: false })
	title?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'bodyEs', en: 'bodyEn' }, required: false })
	body?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'ccReceiversValue' }, required: false })
	ccReceivers?: any;
}
