import { IsBoolean, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateStudentSectionEnrollmentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	enrolledStudentId: number;

	@IsNumber()
	@ApiProperty({ example: 1, required: true })
	courseSectionId: number;
}

export class UpdateStudentSectionEnrollmentDto {
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
	enrolledStudentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false })
	courseSectionId?: number;
}

export class FilterStudentSectionEnrollmentDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	enrolledStudentId?: number;

	@IsOptional()
	@ApiProperty({ example: 1, required: false })
	courseSectionId?: number;
}

export class StudentSectionEnrollmentMaintenanceQueryDto extends PaginationQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@ApiPropertyOptional({ example: 1, description: 'Filter by program (carrera) id' })
	programId?: number;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'searchExample',
		description: 'Search by course code, section code or student code',
	})
	search?: string;
}

export class UpdateStudentSectionEnrollmentMaintenanceDto {
	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1, description: 'Course section id' })
	courseSectionId?: number;

	@IsOptional()
	@IsNumber()
	@ApiPropertyOptional({ example: 1, description: 'Enrolled student id' })
	enrolledStudentId?: number;
}

export class CreateStudentSectionEnrollmentMaintenanceDto {
	@IsNumber()
	@ApiProperty({ example: 1, description: 'Course section id' })
	courseSectionId: number;

	@IsNumber()
	@ApiProperty({ example: 1, description: 'Enrolled student id' })
	enrolledStudentId: number;
}

export interface StudentSectionEnrollmentMaintenanceItem {
	id: number;
	courseSectionId: number;
	enrolledStudentId: number;
	courseName: I18nText;
	courseCode: string;
	sectionCode: string;
	studentCode: string;
	studentFirstName: string;
	studentLastName: string;
}
