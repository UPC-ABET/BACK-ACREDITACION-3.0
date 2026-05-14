import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateOutcomeConfigDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	outcome_id: number;

	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'user_outcome_name_example', required: true })
	user_outcome_name: string;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'user_outcome_description_example', required: false })
	user_outcome_description?: string;
}

export class UpdateOutcomeConfigDto extends BaseDto {
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
	outcome_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 1000)
	@ApiProperty({ example: 'user_outcome_name_example', required: false })
	user_outcome_name?: string;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'user_outcome_description_example', required: false })
	user_outcome_description?: string;
}

export class FilterOutcomeConfigDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	outcome_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'user_outcome_name_example', required: false })
	user_outcome_name?: string;

	@IsOptional()
	@ApiProperty({ example: 'user_outcome_description_example', required: false })
	user_outcome_description?: string;
}
