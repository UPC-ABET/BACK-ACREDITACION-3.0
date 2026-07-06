import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateProjectGroupDto {
	@IsString()
	@IsNotEmpty()
	@ApiProperty({
		example: 'GRP-ISW-01',
		required: true,
		description: 'Project group code',
	})
	code: string;

	@IsObject()
	@IsNotEmpty()
	@ApiProperty({ example: { es: 'Grupo 01', en: 'Group 01' }, required: true })
	name: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Descripción', en: 'Description' }, required: false })
	description?: I18nText;

	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Academic period ID' })
	academicPeriodId: number;

	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Program ID' })
	programId: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class UpdateProjectGroupDto {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@ApiProperty({ example: 'GRP-ISW-01', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Grupo 01', en: 'Group 01' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'Descripción', en: 'Description' }, required: false })
	description?: I18nText;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, description: 'Academic period ID' })
	academicPeriodId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, description: 'Program ID' })
	programId?: number;

	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class FilterProjectGroupDto {
	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'GRP-ISW-01', required: false })
	code?: string;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, description: 'Academic period ID' })
	academicPeriodId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false, description: 'Program ID' })
	programId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}
