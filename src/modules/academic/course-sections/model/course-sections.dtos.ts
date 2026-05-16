import { IsBoolean, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDto } from 'src/commons/base.dtos';

export class CreateCourseSectionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	study_plan_course_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	campus_id: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	professor_id: number;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'section_code_example', required: true })
	section_code: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'schedule_value' }, required: false })
	schedule?: any;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	section_modality_type_id: number;
}

export class UpdateCourseSectionDto extends BaseDto {
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
	study_plan_course_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	campus_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	professor_id?: number;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'section_code_example', required: false })
	section_code?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'schedule_value' }, required: false })
	schedule?: any;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	section_modality_type_id?: number;
}

export class FilterCourseSectionDto extends BaseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	study_plan_course_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	campus_id?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	professor_id?: number;

	@IsOptional()
	@ApiProperty({ example: 'section_code_example', required: false })
	section_code?: string;

	@IsOptional()
	@ApiProperty({ example: { key: 'schedule_value' }, required: false })
	schedule?: any;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	section_modality_type_id?: number;
}
