import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateFindingActionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	finding_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	action_id: number;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	in_plan_required: boolean;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Evidencia en español', en: 'Evidence in English' }, required: false, nullable: true })
	evidences?: I18nText | null;
}

export class UpdateFindingActionDto extends BaseDto {
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
	finding_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	action_id?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	in_plan_required?: boolean;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Evidencia en español', en: 'Evidence in English' }, required: false, nullable: true })
	evidences?: I18nText | null;
}

export class FilterFindingActionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	finding_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	action_id?: number;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	in_plan_required?: boolean;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Evidencia en español', en: 'Evidence in English' }, required: false, nullable: true })
	evidences?: I18nText | null;
}
