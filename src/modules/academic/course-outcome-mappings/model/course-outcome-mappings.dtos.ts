import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseOutcomeMappingDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	outcomeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	studyPlanCourseId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	outcomeTypeId: number;
}

export class UpdateCourseOutcomeMappingDto {
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
	outcomeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	studyPlanCourseId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	outcomeTypeId?: number;
}

export class FilterCourseOutcomeMappingDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	outcomeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	studyPlanCourseId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	outcomeTypeId?: number;
}
