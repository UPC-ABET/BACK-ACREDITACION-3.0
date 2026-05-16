import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateOutcomeConfigDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	outcome_id: number;

	@IsObject()
	@ApiProperty({ example: { es: 'user_outcome_name_es', en: 'user_outcome_name_en' }, required: true })
	user_outcome_name: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'user_outcome_description_es', en: 'user_outcome_description_en' }, required: false })
	user_outcome_description?: I18nText;
}

export class UpdateOutcomeConfigDto extends BaseDto {
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
	outcome_id?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'user_outcome_name_es', en: 'user_outcome_name_en' }, required: false })
	user_outcome_name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'user_outcome_description_es', en: 'user_outcome_description_en' }, required: false })
	user_outcome_description?: I18nText;
}

export class FilterOutcomeConfigDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	outcome_id?: number;

	@IsOptional()
	@ApiProperty({ example: { es: 'user_outcome_name_es', en: 'user_outcome_name_en' }, required: false })
	user_outcome_name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'user_outcome_description_es', en: 'user_outcome_description_en' }, required: false })
	user_outcome_description?: I18nText;
}
