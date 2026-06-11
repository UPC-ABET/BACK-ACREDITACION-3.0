import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreatePerformanceLevelDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	instrumentTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsObject()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: true })
	name: I18nText;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: true })
	code: string;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	uniqueValue: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	minScore: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	maxScore: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	maxValue: number;
}

export class UpdatePerformanceLevelDto {
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
	instrumentTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	uniqueValue?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	minScore?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	maxScore?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	maxValue?: number;
}

export class FilterPerformanceLevelDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	instrumentTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	uniqueValue?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	minScore?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	maxScore?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	maxValue?: number;
}
