import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateFindingDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	criticalityTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	instrumentId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	correlative: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	courseId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campusId: number;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	isAutomatic: boolean;
}

export class UpdateFindingDto {
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
	criticalityTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	instrumentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	correlative?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	courseId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isAutomatic?: boolean;
}

export class FilterFindingDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	criticalityTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	instrumentId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	staffId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	correlative?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	courseId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isAutomatic?: boolean;
}
