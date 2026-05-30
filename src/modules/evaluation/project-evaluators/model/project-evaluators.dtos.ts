import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectEvaluatorDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	projectId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	professorId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	evaluatorTypeId: number;
}

export class UpdateProjectEvaluatorDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	projectId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	professorId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	evaluatorTypeId?: number;
}

export class FilterProjectEvaluatorDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	projectId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	professorId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	evaluatorTypeId?: number;
}
