import { IsOptional, IsNumber, IsString } from 'class-validator';
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
}

export class SemaphoreReportSummaryDto {
	courseCode: string;
	courseName: string;
	outcomeCode: string;
	outcomeName: string;
	totalStudents: number;
	studentsAchieved: number;
	percentageAchieved: number;
	color: string;
	sede: string;
	cicloAcademico: string;
}

export class SemaphoreReportDto {
	summary: SemaphoreReportSummaryDto[];
	redDetail: SemaphoreReportSummaryDto[];
	yellowDetail: SemaphoreReportSummaryDto[];
	greenDetail: SemaphoreReportSummaryDto[];
	metadata: SemaphoreMetadataDto;
}

export class SemaphoreMetadataDto {
	programName: string;
	commissionName: string;
	academicPeriodCode: string;
	accreditorCode: string;
}
