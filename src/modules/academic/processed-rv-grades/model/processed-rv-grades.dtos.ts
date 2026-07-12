import { IsInt, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const toOptionalInt = ({ value }: { value: unknown }) =>
	value === undefined || value === null || value === '' ? undefined : Number(value);

export class FilterProcessedRvGradeDto {
	@Transform(toOptionalInt)
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 2, required: false, description: 'Program commission to report on' })
	programCommissionId?: number;

	@Transform(toOptionalInt)
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 10, required: false })
	outcomeId?: number;

	@Transform(toOptionalInt)
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 5, required: false })
	courseSectionId?: number;

	@Transform(({ value }) =>
		value === undefined || value === null || value === ''
			? undefined
			: value === true || value === 'true',
	)
	@IsOptional()
	@IsBoolean()
	@ApiProperty({
		example: true,
		required: false,
		description: 'true = only converted rows, false = only directly graded rows',
	})
	isConverted?: boolean;
}

export class ProcessedRvGradeDto {
	id: number;
	studentSectionEnrollmentId: number;
	studentCode: string;
	studentName: string;
	courseCode: string;
	outcomeCode: string;
	commissionCode: string;
	grade: number;
	scaledGrade: number;
	levelRank: number | null;
	levelName: string;
	isConverted: boolean;
	formula: string | null;
	sourceCommissionCode: string | null;
}

export class RvRebuildResultDto {
	@ApiProperty({ example: 120 })
	evaluationsProcessed: number;

	@ApiProperty({ example: 480 })
	gradedRows: number;

	@ApiProperty({ example: 360 })
	convertedRows: number;

	@ApiProperty({
		example: 4,
		description:
			'Conversions whose formula referenced an outcome the evaluation did not grade, so no row was written',
	})
	skippedConversions: number;
}
