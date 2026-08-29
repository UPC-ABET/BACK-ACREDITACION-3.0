import {
	IsArray,
	IsIn,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { ReportLanguage } from 'src/libs/reporting/report.types';

export class PerceptionReportDto {
	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Program / career ID', required: false })
	programId?: number;

	@ValidateIf((o) => o.programId !== undefined && o.programId !== null)
	@IsNotEmpty({ message: 'commissionId is required when programId (career) is filtered' })
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Filter by commission. Required when programId is set.',
		required: false,
	})
	commissionId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		description: 'Filter by a single campus (sede). Omit to generate "all sedes" + one per sede.',
		required: false,
	})
	campusId?: number;

	@IsOptional()
	@IsArray()
	@IsNumber({}, { each: true })
	@ApiProperty({
		example: [1, 2],
		description: 'Survey numbers to include (e.g. practice number for PPP)',
		required: false,
		type: [Number],
	})
	surveyNumbers?: number[];

	@IsOptional()
	@IsString()
	@ApiProperty({
		example: 'TODOS',
		description: 'Study modality label shown in the report header (display only)',
		required: false,
	})
	modalityLabel?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 10,
		description: 'Filter by course (curso). When set, the report header shows the course.',
		required: false,
	})
	courseId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 55,
		description:
			'Filter by course section (NRC). When set, the report header also shows the NRC and professor.',
		required: false,
	})
	courseSectionId?: number;

	@IsOptional()
	@IsIn(['es', 'en'])
	@ApiProperty({ example: 'es', description: 'Report language: es | en', required: false })
	lang?: ReportLanguage;
}
