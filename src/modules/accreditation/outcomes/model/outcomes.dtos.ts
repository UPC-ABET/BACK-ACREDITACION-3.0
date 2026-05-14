import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateOutcomeDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	program_commission_id: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'outcome_name_example', required: true })
	outcome_name: string;

	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'outcome_description_example', required: true })
	outcome_description: string;
}

export class UpdateOutcomeDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	program_commission_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'outcome_name_example', required: false })
	outcome_name?: string;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'outcome_description_example', required: false })
	outcome_description?: string;
}

export class FilterOutcomeDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	program_commission_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'outcome_name_example', required: false })
	outcome_name?: string;

	@IsOptional()
	@ApiProperty({ example: 'outcome_description_example', required: false })
	outcome_description?: string;
}
