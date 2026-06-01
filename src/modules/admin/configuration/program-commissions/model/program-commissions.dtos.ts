import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssociateProgramCommissionDto {
	@IsInt()
	@ApiProperty({ example: 5, required: true, description: 'academic.programs.id of the career' })
	programId: number;

	@IsInt()
	@ApiProperty({ example: 12, required: true, description: 'accreditation.commissions.id of the commission' })
	commissionId: number;

	@IsInt()
	@ApiProperty({ example: 3, required: true, description: 'academic.academic_periods.id of the period' })
	academicPeriodId: number;

	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'core.types id of the commission type' })
	commissionTypeId: number;
}

export class ListProgramCommissionQueryDto {
	@IsInt()
	@ApiProperty({ example: 3, required: true, description: 'academic.academic_periods.id to list associations for' })
	academicPeriodId: number;
}
