import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateTypeDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	type_group_id: number;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: true })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: true })
	name: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;
}

export class UpdateTypeDto extends BaseDto {
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
	type_group_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;
}

export class FilterTypeDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	type_group_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'code_example', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;
}
