import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudyPlanCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	study_plan_academic_period_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	course_id: number;

	@IsBoolean()
	@ApiProperty({ example: true, required: true })
	is_elective: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	level_type_id: number;
}

export class UpdateStudyPlanCourseDto {
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
	study_plan_academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	course_id?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_elective?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	level_type_id?: number;
}

export class FilterStudyPlanCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	study_plan_academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	school_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	course_id?: number;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_elective?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	level_type_id?: number;

}
