import { IsBoolean, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateFacultyDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: true })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: true })
	name: I18nText;
}

export class UpdateFacultyDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;
}

export class FilterFacultyDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 'code_example', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;
}
