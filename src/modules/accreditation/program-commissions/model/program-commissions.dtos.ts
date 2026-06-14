import { IsBoolean, IsInt, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProgramCommissionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	commissionId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	programId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academicPeriodId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	commissionTypeId: number;
}

export class UpdateProgramCommissionDto {
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
	commissionId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	commissionTypeId?: number;
}

export class FilterProgramCommissionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	commissionId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	programId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	commissionTypeId?: number;
}

export class CommissionOptionsQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	accreditorId?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Only commissions linked to this program in the active period',
	})
	programId?: number;
}

export class ProgramOptionsQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	commissionId?: number;
}

export class FilterProgramCommissionDetailedDto {
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	accreditorId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	commissionId?: number;

	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	programId?: number;
}
