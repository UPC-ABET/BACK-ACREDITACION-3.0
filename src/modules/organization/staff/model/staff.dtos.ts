import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateStaffDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	userId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	positionTypeId: number;

	@IsObject()
	@ApiProperty({ example: { es: 'jobTitleEs', en: 'jobTitleEn' }, required: true })
	jobTitle: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'jobDescriptionEs', en: 'jobDescriptionEn' }, required: true })
	jobDescription: I18nText;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staffEmailExample', required: true })
	staffEmail: string;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staffPhoneExample', required: true })
	staffPhone: string;
}

export class UpdateStaffDto {
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
	userId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	positionTypeId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'jobTitleEs', en: 'jobTitleEn' }, required: false })
	jobTitle?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'jobDescriptionEs', en: 'jobDescriptionEn' }, required: false })
	jobDescription?: I18nText;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staffEmailExample', required: false })
	staffEmail?: string;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'staffPhoneExample', required: false })
	staffPhone?: string;
}

export class FilterStaffDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	userId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	positionTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'jobTitleEs', en: 'jobTitleEn' }, required: false })
	jobTitle?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'jobDescriptionEs', en: 'jobDescriptionEn' }, required: false })
	jobDescription?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 'staffEmailExample', required: false })
	staffEmail?: string;

	@IsOptional()
	@ApiProperty({ example: 'staffPhoneExample', required: false })
	staffPhone?: string;
}
