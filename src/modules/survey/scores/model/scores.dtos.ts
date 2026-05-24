import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateScoreDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	survey_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	outcome_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	score: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'commentaries_es', en: 'commentaries_en' }, required: false })
	commentaries?: I18nText;
}

export class UpdateScoreDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	survey_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	outcome_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	score?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'commentaries_es', en: 'commentaries_en' }, required: false })
	commentaries?: I18nText;
}

export class FilterScoreDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	survey_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	outcome_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	score?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'commentaries_es', en: 'commentaries_en' }, required: false })
	commentaries?: I18nText;
}
