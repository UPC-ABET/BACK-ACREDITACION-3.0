import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgramFilterQueryDto } from 'src/commons/pagination.dtos';
import type { I18nText } from 'src/shared/types/i18n';
import type { StudentSectionEnrollmentEntity } from './student-section-enrollments.entity';

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

export class StudentSectionEnrollmentMaintenanceQueryDto extends ProgramFilterQueryDto {
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
	isClassRepresentative: boolean;
	courseName: I18nText;
	courseCode: string;
	sectionCode: string;
	studentCode: string;
	studentFirstName: string;
	studentLastName: string;
}

export function toStudentSectionEnrollmentMaintenanceItem(
	entity: StudentSectionEnrollmentEntity,
): StudentSectionEnrollmentMaintenanceItem {
	return {
		id: entity.id,
		courseSectionId: entity.courseSectionId,
		enrolledStudentId: entity.enrolledStudentId,
		isClassRepresentative: entity.isClassRepresentative,
		courseName: entity.courseSection.course.name,
		courseCode: entity.courseSection.course.code,
		sectionCode: entity.courseSection.sectionCode,
		studentCode: entity.enrolledStudent.student.code,
		studentFirstName: entity.enrolledStudent.student.firstName,
		studentLastName: entity.enrolledStudent.student.lastName,
	};
}
