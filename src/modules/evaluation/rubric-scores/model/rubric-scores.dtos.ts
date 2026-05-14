import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateRubricScoreDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	evaluation_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubric_outcome_criteria_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	rubric_question_criteria_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	score: number;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'commentaries_example', required: false })
	commentaries?: string;
}

export class UpdateRubricScoreDto extends BaseDto {
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
	evaluation_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rubric_outcome_criteria_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	rubric_question_criteria_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	score?: number;

	@IsOptional()
	@IsString()
	@Length(1, 5000)
	@ApiProperty({ example: 'commentaries_example', required: false })
	commentaries?: string;
}

export class FilterRubricScoreDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	evaluation_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubric_outcome_criteria_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	rubric_question_criteria_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	score?: number;

	@IsOptional()
	@ApiProperty({ example: 'commentaries_example', required: false })
	commentaries?: string;
}
