import {
	IsArray,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	Length,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class ChartDeanDto {
	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'Perez', required: true })
	lastName: string;

	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'Juan', required: true })
	firstName: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 12,
		required: false,
		description: 'User to associate with the dean staff',
	})
	userId?: number;

	@IsObject()
	@ApiProperty({ example: { es: 'Decanato', en: "Dean's Office" }, required: true })
	title: I18nText;
}

export class ChartDirectorDto {
	@IsNumber()
	@ApiProperty({ example: 3, required: true, description: 'School id this director leads' })
	schoolId: number;

	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'Torres', required: true })
	lastName: string;

	@IsString()
	@Length(1, 255)
	@ApiProperty({ example: 'Sofia', required: true })
	firstName: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 45,
		required: false,
		description: 'User to associate with the director staff',
	})
	userId?: number;

	@IsObject()
	@ApiProperty({ example: { es: 'Direccion EISCB', en: 'EISCB Direction' }, required: true })
	title: I18nText;
}

export class ConfigureChartHeadsDto {
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: true,
		description: 'Academic period the chart heads belong to',
	})
	academicPeriodId: number;

	@ValidateNested()
	@Type(() => ChartDeanDto)
	@ApiProperty({ type: ChartDeanDto, required: true })
	dean: ChartDeanDto;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ChartDirectorDto)
	@ApiProperty({ type: [ChartDirectorDto], required: true })
	directors: ChartDirectorDto[];
}

export class ChartHeadDeanViewDto {
	@ApiProperty({ example: 1 })
	chartId: number;

	@ApiProperty({ example: 9 })
	staffId: number;

	@ApiProperty({ example: 'Perez' })
	lastName: string;

	@ApiProperty({ example: 'Juan' })
	firstName: string;

	@ApiProperty({ example: 12, nullable: true })
	userId: number | null;

	@ApiProperty({ example: { es: 'Decanato', en: "Dean's Office" } })
	title: I18nText;
}

export class ChartHeadDirectorViewDto extends ChartHeadDeanViewDto {
	@ApiProperty({ example: 3 })
	schoolId: number;

	@ApiProperty({ example: 'EISCB' })
	schoolCode: string;
}

export class ChartHeadsConfigurationDto {
	@ApiProperty({ type: ChartHeadDeanViewDto, nullable: true })
	dean: ChartHeadDeanViewDto | null;

	@ApiProperty({ type: [ChartHeadDirectorViewDto] })
	directors: ChartHeadDirectorViewDto[];
}
