import {
	IsBoolean,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

export class CreateOutcomeDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
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
	@ApiProperty({ example: 'outcomeCodeExample', required: true })
	outcomeCode: string;

	@IsObject()
	@ApiProperty({ example: { es: 'outcomeNameEs', en: 'outcomeNameEn' }, required: true })
	outcomeName: I18nText;

	@IsObject()
	@ApiProperty({
		example: { es: 'outcomeDescriptionEs', en: 'outcomeDescriptionEn' },
		required: true,
	})
	outcomeDescription: I18nText;
}

export class UpdateOutcomeDto {
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
	programCommissionId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'outcomeCodeExample', required: false })
	outcomeCode?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'outcomeNameEs', en: 'outcomeNameEn' }, required: false })
	outcomeName?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'outcomeDescriptionEs', en: 'outcomeDescriptionEn' },
		required: false,
	})
	outcomeDescription?: I18nText;
}

export class OutcomeMaintenanceQueryDto extends PaginationQueryDto {
	@Type(() => Number)
	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Program (carrera) id, from header' })
	programId: number;

	@Type(() => Number)
	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Academic period id, from header' })
	academicPeriodId: number;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'searchExample',
		description: 'Search by outcome code or outcome name (es / en)',
	})
	search?: string;
}

export class UpdateOutcomeMaintenanceDto {
	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiPropertyOptional({ example: 'OUT-001' })
	outcomeCode?: string;

	@IsOptional()
	@IsObject()
	@ApiPropertyOptional({ example: { es: 'Nombre', en: 'Name' } })
	outcomeName?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiPropertyOptional({ example: { es: 'Descripción', en: 'Description' } })
	outcomeDescription?: I18nText;
}

export class CreateOutcomeMaintenanceDto {
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'OUT-001' })
	outcomeCode: string;

	@IsObject()
	@ApiProperty({ example: { es: 'Nombre', en: 'Name' } })
	outcomeName: I18nText;

	@IsOptional()
	@IsObject()
	@ApiPropertyOptional({ example: { es: 'Descripción', en: 'Description' } })
	outcomeDescription?: I18nText;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program (carrera) id' })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Commission id' })
	commissionId: number;
}

export interface OutcomeMaintenanceItem {
	id: number;
	commissionCode: string;
	outcomeCode: string;
	outcomeName: I18nText;
	outcomeDescription: I18nText;
}

export class FilterOutcomeDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	programCommissionId?: number;

	@IsOptional()
	@ApiProperty({ example: 'outcomeCodeExample', required: false })
	outcomeCode?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'outcomeNameEs', en: 'outcomeNameEn' }, required: false })
	outcomeName?: I18nText;

	@IsOptional()
	@ApiProperty({
		example: { es: 'outcomeDescriptionEs', en: 'outcomeDescriptionEn' },
		required: false,
	})
	outcomeDescription?: I18nText;
}
