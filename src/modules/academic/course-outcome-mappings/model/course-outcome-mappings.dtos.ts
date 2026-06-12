import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
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

export class FilterCourseOutcomeMappingMaintenanceDto {
	@IsOptional()
	@IsInt()
	@ApiProperty({ example: 1, required: false })
	academicPeriodId?: number;

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

export class CourseOutcomeMappingViewDto {
	@IsInt()
	@ApiProperty({ example: 1, required: true })
	programCommissionId: number;
}

export class BulkSaveCourseOutcomeDto {
	@IsInt()
	@ApiProperty({ example: 1, required: true })
	outcomeId: number;

	@IsInt()
	@ApiProperty({ example: 1, required: true })
	outcomeTypeId: number;
}

export class BulkSaveCourseDto {
	@IsInt()
	@ApiProperty({ example: 1, required: true })
	studyPlanCourseId: number;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => BulkSaveCourseOutcomeDto)
	@ApiProperty({ type: [BulkSaveCourseOutcomeDto], required: true })
	outcomes: BulkSaveCourseOutcomeDto[];
}

export class BulkSaveCourseOutcomeMappingDto {
	@IsInt()
	@ApiProperty({ example: 1, required: true })
	programCommissionId: number;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => BulkSaveCourseDto)
	@ApiProperty({ type: [BulkSaveCourseDto], required: true })
	courses: BulkSaveCourseDto[];
}
