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
	@ApiProperty({ example: { es: 'Plantilla encuesta', en: 'Survey template' }, required: true })
	name: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'Asunto', en: 'Subject' }, required: true })
	subject: I18nText;

	@IsObject()
	@ApiProperty({
		example: { es: 'Hola {{student_name}}', en: 'Hi {{student_name}}' },
		required: true,
	})
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
	@ApiProperty({ example: { es: 'Plantilla encuesta', en: 'Survey template' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Asunto', en: 'Subject' }, required: false })
	subject?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'Hola {{student_name}}', en: 'Hi {{student_name}}' },
		required: false,
	})
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
	@ApiProperty({ example: 1, required: false })
	emailTemplateId?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'ccReceiversValue' }, required: false })
	ccReceivers?: any;
}
