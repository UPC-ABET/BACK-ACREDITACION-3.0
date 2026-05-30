import { IsBoolean, IsDate, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateStatusDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	ifcId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	statusTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	staffId: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'comment_es', en: 'comment_en' }, required: false })
	comment?: I18nText;

	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: true })
	registerAt: Date;
}

export class UpdateStatusDto {
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
	ifcId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	statusTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'comment_es', en: 'comment_en' }, required: false })
	comment?: I18nText;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	registerAt?: Date;
}

export class FilterStatusDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	ifcId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	statusTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'comment_es', en: 'comment_en' }, required: false })
	comment?: I18nText;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	registerAt?: Date;
}
