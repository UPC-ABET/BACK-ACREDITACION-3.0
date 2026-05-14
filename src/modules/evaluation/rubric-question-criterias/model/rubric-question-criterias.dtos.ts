import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateRubricQuestionCriteriaDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubric_question_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubric_scale_id: number;

	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'criteria_example', required: true })
	criteria: string;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	min_value: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	max_value: number;
}

export class UpdateRubricQuestionCriteriaDto extends BaseDto {
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
	rubric_question_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rubric_scale_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'criteria_example', required: false })
	criteria?: string;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	min_value?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	max_value?: number;
}

export class FilterRubricQuestionCriteriaDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubric_question_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubric_scale_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'criteria_example', required: false })
	criteria?: string;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	min_value?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	max_value?: number;
}
