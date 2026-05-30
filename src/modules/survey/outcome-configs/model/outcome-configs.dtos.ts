import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateOutcomeConfigDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	outcomeId: number;

	@IsObject()
	@ApiProperty({
		example: { es: 'user_outcome_name_es', en: 'user_outcome_name_en' },
		required: true,
	})
	userOutcomeName: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'user_outcome_description_es', en: 'user_outcome_description_en' },
		required: false,
	})
	userOutcomeDescription?: I18nText;
}

export class UpdateOutcomeConfigDto {
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
	outcomeId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'user_outcome_name_es', en: 'user_outcome_name_en' },
		required: false,
	})
	userOutcomeName?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'user_outcome_description_es', en: 'user_outcome_description_en' },
		required: false,
	})
	userOutcomeDescription?: I18nText;
}

export class FilterOutcomeConfigDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	outcomeId?: number;

	@IsOptional()
	@ApiProperty({
		example: { es: 'user_outcome_name_es', en: 'user_outcome_name_en' },
		required: false,
	})
	userOutcomeName?: I18nText;

	@IsOptional()
	@ApiProperty({
		example: { es: 'user_outcome_description_es', en: 'user_outcome_description_en' },
		required: false,
	})
	userOutcomeDescription?: I18nText;
}
