import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateOutcomeDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	programCommissionId: number;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'outcome_code_example', required: true })
	outcomeCode: string;

	@IsObject()
	@ApiProperty({ example: { es: 'outcome_name_es', en: 'outcome_name_en' }, required: true })
	outcomeName: I18nText;

	@IsObject()
	@ApiProperty({
		example: { es: 'outcome_description_es', en: 'outcome_description_en' },
		required: true,
	})
	outcomeDescription: I18nText;
}

export class UpdateOutcomeDto {
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
	programCommissionId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'outcome_code_example', required: false })
	outcomeCode?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'outcome_name_es', en: 'outcome_name_en' }, required: false })
	outcomeName?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'outcome_description_es', en: 'outcome_description_en' },
		required: false,
	})
	outcomeDescription?: I18nText;
}

export class FilterOutcomeDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	programCommissionId?: number;

	@IsOptional()
	@ApiProperty({ example: 'outcome_code_example', required: false })
	outcomeCode?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'outcome_name_es', en: 'outcome_name_en' }, required: false })
	outcomeName?: I18nText;

	@IsOptional()
	@ApiProperty({
		example: { es: 'outcome_description_es', en: 'outcome_description_en' },
		required: false,
	})
	outcomeDescription?: I18nText;
}
