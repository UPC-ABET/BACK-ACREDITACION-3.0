import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateEmailTemplateDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsInt()
	@ApiProperty({
		example: 1,
		required: true,
		description: 'core.types id of the category (TG1004)',
	})
	categoryTypeId: number;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'USER_WELCOME', required: true })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'Bienvenida', en: 'Welcome' }, required: true })
	name: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'Bienvenido a ABET', en: 'Welcome to ABET' }, required: true })
	subject: I18nText;

	@IsObject()
	@ApiProperty({
		example: { es: 'Hola {{first_name}}, ingresa en {{app_link}}', en: 'Hi {{first_name}}...' },
		required: true,
	})
	body: I18nText;
}

export class UpdateEmailTemplateDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	categoryTypeId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'USER_WELCOME', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Bienvenida', en: 'Welcome' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Bienvenido a ABET', en: 'Welcome to ABET' }, required: false })
	subject?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Hola {{first_name}}', en: 'Hi {{first_name}}' }, required: false })
	body?: I18nText;
}

export class FilterEmailTemplateDto {
	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, description: 'Filter by category (for UI tabs)' })
	categoryTypeId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'USER_WELCOME', required: false })
	code?: string;
}
