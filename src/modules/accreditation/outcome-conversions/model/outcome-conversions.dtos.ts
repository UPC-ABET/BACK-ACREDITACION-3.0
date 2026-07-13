import { IsInt, IsOptional, IsString, IsBoolean, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const toOptionalInt = ({ value }: { value: unknown }) =>
	value === undefined || value === null || value === '' ? undefined : Number(value);

export class CreateOutcomeConversionDto {
	@IsInt()
	@ApiProperty({ example: 1, description: 'Program commission whose outcomes are actually graded' })
	sourceProgramCommissionId: number;

	@IsInt()
	@ApiProperty({ example: 2, description: 'Program commission the grades are converted into' })
	targetProgramCommissionId: number;

	@IsInt()
	@ApiProperty({
		example: 10,
		description: 'Outcome of the target commission this formula produces',
	})
	targetOutcomeId: number;

	@IsString()
	@Length(1, 100)
	@ApiProperty({
		example: '([6] + [7]) / 2',
		description:
			'Arithmetic expression over the source commission outcome codes. Bracket a code when it starts with a digit, e.g. [6]. Supports + - * / and parentheses.',
	})
	formula: string;
}

export class UpdateOutcomeConversionDto {
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	sourceProgramCommissionId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 2, required: false })
	targetProgramCommissionId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 10, required: false })
	targetOutcomeId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 100)
	@ApiProperty({ example: '([6] + [7]) / 2', required: false })
	formula?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class FilterOutcomeConversionDto {
	@Transform(toOptionalInt)
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	sourceProgramCommissionId?: number;

	@Transform(toOptionalInt)
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 2, required: false })
	targetProgramCommissionId?: number;

	@Transform(toOptionalInt)
	@IsOptional()
	@IsInt()
	@ApiProperty({
		example: 3,
		required: false,
		description: 'Restrict to conversions whose commissions belong to this academic period',
	})
	academicPeriodId?: number;
}

export class OutcomeConversionDto {
	id: number;
	sourceProgramCommissionId: number;
	sourceCommissionCode: string;
	targetProgramCommissionId: number;
	targetCommissionCode: string;
	targetOutcomeId: number;
	targetOutcomeCode: string;
	formula: string;
	referencedOutcomeCodes: string[];
	isActive: boolean;
}

/**
 * A target commission plus the conversion coverage of its outcomes, so the frontend can show
 * which outcomes still lack a formula before anyone trusts the converted report.
 */
export class OutcomeConversionCoverageDto {
	targetProgramCommissionId: number;
	targetCommissionCode: string;
	totalOutcomes: number;
	mappedOutcomes: number;
	missingOutcomeCodes: string[];
}
