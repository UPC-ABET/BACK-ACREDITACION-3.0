import { IsArray, IsNumber, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class ChartDeanDto {
	@IsNumber()
	@ApiProperty({
		example: 9,
		required: true,
		description: 'Linked teacher staff id leading this node',
	})
	staffId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 12,
		required: false,
		nullable: true,
		description:
			'User to link to this staff (1:1). Only applied when the staff is unlinked and the user is free; an existing link on either side wins and this is ignored.',
	})
	userId?: number | null;

	@IsObject()
	@ApiProperty({ example: { es: 'Decanato', en: "Dean's Office" }, required: true })
	title: I18nText;
}

export class ChartDirectorDto {
	@IsNumber()
	@ApiProperty({ example: 3, required: true, description: 'School id this director leads' })
	schoolId: number;

	@IsNumber()
	@ApiProperty({
		example: 9,
		required: true,
		description: 'Linked teacher staff id leading this school',
	})
	staffId: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 45,
		required: false,
		nullable: true,
		description:
			'User to link to this staff (1:1). Only applied when the staff is unlinked and the user is free; an existing link on either side wins and this is ignored.',
	})
	userId?: number | null;

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

export class ChartHeadUserViewDto {
	@ApiProperty({ example: 88 })
	id: number;

	@ApiProperty({ example: 'Juan' })
	firstName: string;

	@ApiProperty({ example: 'Perez' })
	lastName: string;

	@ApiProperty({ example: 'juan.perez@example.com' })
	email: string;
}

export class ChartHeadDeanViewDto {
	@ApiProperty({ example: 1 })
	chartId: number;

	@ApiProperty({ example: 9 })
	staffId: number;

	@ApiProperty({ example: 'PROF-1001', nullable: true })
	code: string | null;

	@ApiProperty({ example: 'Perez' })
	lastName: string;

	@ApiProperty({ example: 'Juan' })
	firstName: string;

	@ApiProperty({ example: 12, nullable: true })
	userId: number | null;

	@ApiProperty({ type: ChartHeadUserViewDto, nullable: true })
	user: ChartHeadUserViewDto | null;

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
