import { IsBoolean, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateRoleDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'COORDINATOR', required: true })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'Coordinador', en: 'Coordinator' }, required: true })
	name: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'Acceso de coordinador', en: 'Coordinator access' },
		required: false,
	})
	description?: I18nText;
}

export class UpdateRoleDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'COORDINATOR', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Coordinador', en: 'Coordinator' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'Acceso de coordinador', en: 'Coordinator access' },
		required: false,
	})
	description?: I18nText;
}

export class FilterRoleDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 'COORDINATOR', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'Coordinador', en: 'Coordinator' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({
		example: { es: 'Acceso de coordinador', en: 'Coordinator access' },
		required: false,
	})
	description?: I18nText;
}
