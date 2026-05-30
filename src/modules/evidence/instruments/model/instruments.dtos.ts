import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateInstrumentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	constituentTypeId: number;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: true })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: true })
	name: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	isForAccreditation: boolean;
}

export class UpdateInstrumentDto {
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
	constituentTypeId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isForAccreditation?: boolean;
}

export class FilterInstrumentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	constituentTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isForAccreditation?: boolean;
}
