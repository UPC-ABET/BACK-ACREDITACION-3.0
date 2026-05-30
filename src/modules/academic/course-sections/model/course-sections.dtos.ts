import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseSectionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	studyPlanCourseId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campusId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	professorId: number;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'section_code_example', required: true })
	sectionCode: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'schedule_value' }, required: false })
	schedule?: any;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	sectionModalityTypeId: number;
}

export class UpdateCourseSectionDto {
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
	studyPlanCourseId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	professorId?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'section_code_example', required: false })
	sectionCode?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'schedule_value' }, required: false })
	schedule?: any;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	sectionModalityTypeId?: number;
}

export class FilterCourseSectionDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	studyPlanCourseId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campusId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	professorId?: number;

	@IsOptional()
	@ApiProperty({ example: 'section_code_example', required: false })
	sectionCode?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'schedule_value' }, required: false })
	schedule?: any;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	sectionModalityTypeId?: number;
}
