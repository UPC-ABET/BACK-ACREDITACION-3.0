import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateFindingActionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	findingId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	actionId: number;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	inPlanRequired: boolean;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'Evidencia en español', en: 'Evidence in English' },
		required: false,
		nullable: true,
	})
	evidences?: I18nText | null;
}

export class UpdateFindingActionDto {
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
	findingId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	actionId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	inPlanRequired?: boolean;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'Evidencia en español', en: 'Evidence in English' },
		required: false,
		nullable: true,
	})
	evidences?: I18nText | null;
}

export class FilterFindingActionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	findingId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	actionId?: number;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	inPlanRequired?: boolean;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'Evidencia en español', en: 'Evidence in English' },
		required: false,
		nullable: true,
	})
	evidences?: I18nText | null;
}
