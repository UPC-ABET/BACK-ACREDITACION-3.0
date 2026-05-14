import { IsBoolean, IsDate, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateEvaluationDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	project_student_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	project_evaluator_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	qualification_status_type_id: number;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'observation_example', required: false })
	observation?: string;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	register_at?: Date;
}

export class UpdateEvaluationDto extends BaseDto {
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
	project_student_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	project_evaluator_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	qualification_status_type_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'observation_example', required: false })
	observation?: string;

	@IsOptional()
	@IsDate()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	register_at?: Date;
}

export class FilterEvaluationDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	project_student_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	project_evaluator_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	qualification_status_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'observation_example', required: false })
	observation?: string;

	@IsOptional()
	@ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
	register_at?: Date;
}
