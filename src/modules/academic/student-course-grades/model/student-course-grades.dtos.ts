import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudentCourseGradeDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	student_section_enrollment_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	grade_type_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	grade_type_percentage: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	grade: number;
}

export class UpdateStudentCourseGradeDto {
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
	student_section_enrollment_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	grade_type_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	grade_type_percentage?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	grade?: number;
}

export class FilterStudentCourseGradeDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	student_section_enrollment_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	grade_type_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	grade_type_percentage?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	grade?: number;
}
