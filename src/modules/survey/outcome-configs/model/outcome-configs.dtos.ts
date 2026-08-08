import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateOutcomeConfigDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
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
		example: { es: 'userOutcomeNameEs', en: 'userOutcomeNameEn' },
		required: true,
	})
	userOutcomeName: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'userOutcomeDescriptionEs', en: 'userOutcomeDescriptionEn' },
		required: false,
	})
	userOutcomeDescription?: I18nText;
}

export class UpdateOutcomeConfigDto {
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
	outcomeId?: number;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'userOutcomeNameEs', en: 'userOutcomeNameEn' },
		required: false,
	})
	userOutcomeName?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'userOutcomeDescriptionEs', en: 'userOutcomeDescriptionEn' },
		required: false,
	})
	userOutcomeDescription?: I18nText;
}

// --- Response: GET (list/by id) ---------------------------------------------
// Mirrors OutcomeConfigEntity as actually serialized by GraConfigRepository/
// PppConfigRepository (raw entity, no mapper) — see outcome-configs.entity.ts.

export class OutcomeConfigCommissionTypeDto {
	@ApiProperty({
		example: 'TG301-T002',
		description: 'General (TG301-T001) or Specific (TG301-T002)',
	})
	code: string;
}

export class OutcomeConfigProgramCommissionDto {
	@ApiProperty({ type: OutcomeConfigCommissionTypeDto })
	commissionType: OutcomeConfigCommissionTypeDto;
}

export class OutcomeConfigOutcomeDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 'CAC-CC-1' })
	outcomeCode: string;

	@ApiProperty({ example: { es: 'outcomeNameEs', en: 'outcomeNameEn' }, type: Object })
	outcomeName: I18nText;

	@ApiProperty({
		example: { es: 'outcomeDescriptionEs', en: 'outcomeDescriptionEn' },
		type: Object,
	})
	outcomeDescription: I18nText;

	@ApiProperty({ type: OutcomeConfigProgramCommissionDto })
	programCommission: OutcomeConfigProgramCommissionDto;
}

export class OutcomeConfigResponseDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 1 })
	outcomeId: number;

	@ApiProperty({ example: true })
	isActive: boolean;

	@ApiProperty({
		example: { es: 'userOutcomeNameEs', en: 'userOutcomeNameEn' },
		type: Object,
	})
	userOutcomeName: I18nText;

	@ApiProperty({
		example: { es: 'userOutcomeDescriptionEs', en: 'userOutcomeDescriptionEn' },
		type: Object,
		required: false,
	})
	userOutcomeDescription?: I18nText;

	@ApiProperty({
		example: { surveyType: 'GRA', nameEn: 'nameEnExample', order: 1, programId: 1 },
		type: Object,
		description: 'Free-form jsonb bag (survey-specific fields: nameEn, order, programId, etc.)',
	})
	extra: Record<string, unknown>;

	@ApiProperty({ type: OutcomeConfigOutcomeDto })
	outcome: OutcomeConfigOutcomeDto;
}

export class FilterOutcomeConfigDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	outcomeId?: number;

	@IsOptional()
	@ApiProperty({
		example: { es: 'userOutcomeNameEs', en: 'userOutcomeNameEn' },
		required: false,
	})
	userOutcomeName?: I18nText;

	@IsOptional()
	@ApiProperty({
		example: { es: 'userOutcomeDescriptionEs', en: 'userOutcomeDescriptionEn' },
		required: false,
	})
	userOutcomeDescription?: I18nText;
}
