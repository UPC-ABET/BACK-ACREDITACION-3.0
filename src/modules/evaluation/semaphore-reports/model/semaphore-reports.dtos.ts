import { IsOptional, IsNumber, IsString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SemaphoreFilterDto {
	@Transform(({ value }) =>
		value === undefined || value === null || value === '' ? undefined : Number(value),
	)
	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Academic period ID (defaults to X-Academic-Period-Id header)',
	})
	academicPeriodId?: number;

	@Transform(({ value }) =>
		value === undefined || value === null || value === '' ? undefined : Number(value),
	)
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'Program commission ID to filter by' })
	programCommissionId?: number;

	@Transform(({ value }) =>
		value === undefined || value === null || value === '' ? undefined : Number(value),
	)
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'Outcome ID to filter by' })
	outcomeId?: number;

	@Transform(({ value }) =>
		value === undefined || value === null || value === '' ? undefined : Number(value),
	)
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'Campus ID to filter by' })
	campusId?: number;

	@Transform(({ value }) =>
		value === undefined || value === null || value === '' ? undefined : Number(value),
	)
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'Modality type ID to filter by' })
	modalityTypeId?: number;

	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'es', required: false, description: 'Language (es | en)' })
	lang?: string;

	@Transform(({ value }) => {
		if (value === undefined || value === null || value === '') return undefined;
		const list = Array.isArray(value) ? value : [value];
		const parsed = list.map((v) => Number(v)).filter((v) => Number.isFinite(v));
		return parsed.length > 0 ? parsed : undefined;
	})
	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2],
		required: false,
		description: 'RV only: rubric IDs to include. Omit for all rubrics.',
	})
	rubricIds?: number[];
}

export class SemaphoreLevelLegendDto {
	name: string;
	minScore: number;
	maxScore: number;
	color: string;
}

export class SemaphoreCourseOutcomeSummaryDto {
	sede: string;
	cicloAcademico: string;
	courseCode: string;
	courseName: string;
	outcomeCode: string;
	outcomeName: string;
	totalStudents: number;
	studentsRed: number;
	studentsYellow: number;
	studentsGreen: number;
	percentageRed: number;
	percentageYellow: number;
	percentageGreen: number;
	isCritical: boolean;
	color: string;
}

export class SemaphoreReportDto {
	legend: SemaphoreLevelLegendDto[];
	summary: SemaphoreCourseOutcomeSummaryDto[];
	metadata: SemaphoreMetadataDto;
}

export class SemaphoreOutcomeSummaryRowDto {
	sede: string;
	outcomeCode: string;
	outcomeName: string;
	totalStudents: number;
	levelName: string;
	count: number;
	percentage: number;
	color: string;
}

export class SemaphoreCourseDetailRowDto {
	sede: string;
	outcomeCode: string;
	outcomeName: string;
	courseCode: string;
	courseName: string;
	count: number;
	totalStudents: number;
}

export class SemaphoreMetadataDto {
	programName: string;
	commissionName: string;
	academicPeriodCode: string;
	accreditorCode: string;
}
