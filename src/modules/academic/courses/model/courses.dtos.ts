import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: true })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: true })
	name: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: true })
	description: I18nText;

	@IsObject()
	@ApiProperty({
		example: { es: 'learningOutcomeEs', en: 'learningOutcomeEn' },
		required: true,
	})
	learningOutcome: I18nText;
}

export class UpdateCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'learningOutcomeEs', en: 'learningOutcomeEn' },
		required: false,
	})
	learningOutcome?: I18nText;
}

export class FilterCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({
		example: { es: 'learningOutcomeEs', en: 'learningOutcomeEn' },
		required: false,
	})
	learningOutcome?: I18nText;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID del período académico' })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID de la carrera' })
	programId?: number;
}

export interface CourseLookupItem {
	id: number;
	code: string;
	name: I18nText;
}

export class FilterCourseEnrolledStudentsDto {
	@IsOptional()
	@IsBoolean()
	@ApiProperty({
		example: true,
		required: false,
		description: 'Filtrar por estado activo de la matrícula',
	})
	isActive?: boolean;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'ID del período académico',
	})
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'ID del campus',
	})
	campusId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'ID del período académico del plan de estudios',
	})
	studyPlanAcademicPeriodId?: number;
}

export class CourseEnrolledStudentDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 1 })
	studentSectionEnrollmentId: number;

	@ApiProperty({ example: 1 })
	studentId: number;

	@ApiProperty({ example: 'firstNameExample' })
	firstName: string;

	@ApiProperty({ example: 'lastNameExample' })
	lastName: string;

	@ApiProperty({ example: 'user@example.com' })
	email: string;

	@ApiProperty({ example: 'studentCodeExample' })
	studentCode: string;

	@ApiProperty({ example: 1 })
	courseSectionId: number;

	@ApiProperty({ example: 'sectionCodeExample' })
	sectionCode: string;

	@ApiProperty({ example: 1 })
	professorId: number;

	@ApiProperty({ example: 'professorFirstNameExample' })
	professorFirstName: string;

	@ApiProperty({ example: 'professorLastNameExample' })
	professorLastName: string;

	@ApiProperty({ example: 1 })
	campusId: number;

	@ApiProperty({ example: '2024-01-01T00:00:00Z' })
	enrollmentDate: Date;

	@ApiProperty({ example: true })
	isActive: boolean;
}
