import { IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudentCourseGradeDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	studentSectionEnrollmentId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	gradeTypeId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	gradeTypePercentage: number;

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
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	studentSectionEnrollmentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	gradeTypeId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	gradeTypePercentage?: number;

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
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	studentSectionEnrollmentId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	gradeTypeId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	gradeTypePercentage?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	grade?: number;
}
