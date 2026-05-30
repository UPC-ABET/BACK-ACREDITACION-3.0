import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class CreateCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: true })
	code: string;

	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: true })
	name: I18nText;

	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: true })
	description: I18nText;

	@IsObject()
	@ApiProperty({
		example: { es: 'learning_outcome_es', en: 'learning_outcome_en' },
		required: true,
	})
	learningOutcome: I18nText;
}

export class UpdateCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@IsString()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: false })
	code?: string;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({
		example: { es: 'learning_outcome_es', en: 'learning_outcome_en' },
		required: false,
	})
	learningOutcome?: I18nText;
}

export class FilterCourseDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: 'code_example', required: false })
	code?: string;

	@IsOptional()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({
		example: { es: 'learning_outcome_es', en: 'learning_outcome_en' },
		required: false,
	})
	learningOutcome?: I18nText;

	// Filters by related entities

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID del período académico' })
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID de la carrera' })
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID de la escuela' })
	schoolId?: number;
}

// ── DTOs for Enrolled Students Endpoint ────────────────────────────────────

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
		example: 5,
		required: false,
		description: 'ID del período académico',
	})
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 2,
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
	@ApiProperty()
	id: number; // enrolled_student_id

	@ApiProperty()
	studentSectionEnrollmentId: number;

	@ApiProperty()
	studentId: number;

	@ApiProperty()
	firstName: string;

	@ApiProperty()
	lastName: string;

	@ApiProperty()
	email: string;

	@ApiProperty()
	studentCode: string;

	@ApiProperty()
	courseSectionId: number;

	@ApiProperty()
	sectionCode: string;

	@ApiProperty()
	professorId: number;

	@ApiProperty()
	professorFirstName: string;

	@ApiProperty()
	professorLastName: string;

	@ApiProperty()
	campusId: number;

	@ApiProperty()
	enrollmentDate: Date;

	@ApiProperty()
	isActive: boolean;
}
