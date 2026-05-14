import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateActionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'description_example', required: true })
	description: string;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	correlative: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	action_status_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	program_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	academic_period_id: number;
}

export class UpdateActionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'description_example', required: false })
	description?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	correlative?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	action_status_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;
}

export class FilterActionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 'description_example', required: false })
	description?: string;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	correlative?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	action_status_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	program_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;
}
