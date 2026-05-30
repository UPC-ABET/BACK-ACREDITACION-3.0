import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Body of POST /configuration/periods/:periodId/program-commissions.
export class CreateProgramCommissionDto {
	@IsInt()
	@ApiProperty({ example: 5, required: true, description: 'academic.programs.id of the career' })
	program_id: number;

	@IsInt()
	@ApiProperty({ example: 12, required: true, description: 'accreditation.commissions.id of the commission (EAC, CAC, CAC-CC, WASC, CIC)' })
	commission_id: number;
}

export interface ProgramCommissionResponse {
	id: number;
	academic_period_id: number;
	program_id: number;
	commission_id: number;
}
