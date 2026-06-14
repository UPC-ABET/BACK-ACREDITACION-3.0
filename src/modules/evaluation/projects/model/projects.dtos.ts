import {
	IsBoolean,
	IsObject,
	IsOptional,
	IsString,
	Length,
	IsArray,
	IsInt,
	IsNotEmpty,
	IsNumber,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

export class ProjectEvaluatorInputDto {
	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'ID del profesor evaluador' })
	professorId: number;

	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'ID del tipo de evaluador (TG403)' })
	evaluatorTypeId: number;
}

export class CreateProjectDto {
	@IsString()
	@IsNotEmpty()
	@Length(1, 50)
	@ApiProperty({ example: 'codeExample', required: true })
	code: string;

	@IsObject()
	@IsNotEmpty()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: true })
	name: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'ID del study_plan_course' })
	studyPlanCourseId: number;

	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2, 3],
		required: true,
		description: 'IDs de student_section_enrollments',
	})
	studentSectionEnrollmentIds: number[];

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ProjectEvaluatorInputDto)
	@ApiProperty({
		example: {},
		type: [ProjectEvaluatorInputDto],
		required: true,
		description: 'Evaluadores con su tipo',
	})
	evaluators: ProjectEvaluatorInputDto[];

	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class UpdateProjectDto {
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
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2, 3],
		required: false,
	})
	studentSectionEnrollmentIds?: number[];

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2, 3],
		required: false,
	})
	evaluatorProfessorIds?: number[];
}

export class EvaluatorInfoDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 1 })
	professorId: number;

	@ApiProperty({ example: 'firstNameExample' })
	firstName: string;

	@ApiProperty({ example: 'lastNameExample' })
	lastName: string;

	@ApiProperty({ example: 'user@example.com' })
	email: string;

	@ApiProperty({ example: { es: 'COMITÉ', en: 'COMMITTEE' } })
	evaluatorType: string; // jsonb i18n object at runtime

	@ApiProperty({ example: 'COM' })
	evaluatorTypeCode: string;
}

export class StudentInfoDto {
	@ApiProperty({ example: 1 })
	id: number;

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
}

export class ProjectEvaluatorResponseDto {
	@ApiProperty({ example: 1 })
	projectId: number;

	@ApiProperty({ example: 'projectCodeExample' })
	projectCode: string;

	@ApiProperty({ example: { es: 'projectNameEs', en: 'projectNameEn' } })
	projectName: I18nText;

	@ApiProperty({ example: '2024-01-01T00:00:00Z' })
	evaluationDate: Date;

	@ApiProperty({ example: 'courseNameExample' })
	courseName: string;

	@ApiProperty({ example: {}, type: EvaluatorInfoDto })
	evaluators: EvaluatorInfoDto[];

	@ApiProperty({ example: {}, type: [StudentInfoDto] })
	students: StudentInfoDto[];
}

export class CriteriaScoreDto {
	@ApiProperty({ example: 1 })
	studentId: number;

	@ApiProperty({ example: 1 })
	evaluatorId: number;

	@ApiProperty({ example: 1 })
	score: number;

	@ApiProperty({ example: 'commentariesExample' })
	commentaries: string;
}

export class RubricCriteriaDetailsDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: { es: 'textEs', en: 'textEn' } })
	text: I18nText;

	@ApiProperty({ example: 'minValueExample' })
	minValue: string;

	@ApiProperty({ example: 'maxValueExample' })
	maxValue: string;

	@ApiProperty({ example: {}, type: [CriteriaScoreDto], nullable: true })
	scores: CriteriaScoreDto[] | null;
}

export class RubricQuestionDetailsDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: { es: 'textEs', en: 'textEn' } })
	text: I18nText;

	@ApiProperty({ example: 1 })
	outcomeId: number | null;

	@ApiProperty({ example: {}, type: [RubricCriteriaDetailsDto] })
	criterias: RubricCriteriaDetailsDto[];
}

export class StudentEvaluationStatusDto {
	@ApiProperty({
		example: 1,
		description: 'project_evaluator_id del evaluador que registró la evaluación',
	})
	evaluatorId: number;

	@ApiProperty({
		example: 1,
		description: 'ID del tipo de estado de calificación desde core.types (TG404)',
	})
	qualificationStatusTypeId: number;
}

export class ProjectDetailsStudentDto extends StudentInfoDto {
	@ApiProperty({ example: 1, nullable: true })
	totalGrade: number | null;

	@ApiProperty({
		example: {},
		type: [StudentEvaluationStatusDto],
		description: 'Estado de calificación por evaluador. Solo presente en modo evaluación.',
	})
	evaluations: StudentEvaluationStatusDto[];
}

export class ProjectEvaluatorDetailDto {
	@ApiProperty({ example: 1 })
	id: number;

	@ApiProperty({ example: 1 })
	professorId: number;

	@ApiProperty({ example: 'professorFirstNameExample' })
	professorFirstName: string;

	@ApiProperty({ example: 'professorLastNameExample' })
	professorLastName: string;

	@ApiProperty({ example: 'professorEmailExample' })
	professorEmail: string;

	@ApiProperty({ example: 1 })
	evaluatorTypeId: number;

	@ApiProperty({ example: { es: 'COMITÉ', en: 'COMMITTEE' } })
	evaluatorTypeName: string; // jsonb i18n object at runtime

	@ApiProperty({ example: 'COM' })
	evaluatorTypeCode: string;
}

export class ProjectDetailsResponseDto {
	@ApiProperty({ example: { es: 'Ejemplo', en: 'Example' } })
	project: {
		id: number;
		code: string;
		name: I18nText;
		description: I18nText;
	};

	@ApiProperty({ example: {} })
	academicPeriod: {
		id: number;
		modalityTypeId: number;
		code: string;
	};

	@ApiProperty({ example: {}, type: [ProjectDetailsStudentDto] })
	students: ProjectDetailsStudentDto[];

	@ApiProperty({ example: {}, type: [ProjectEvaluatorDetailDto] })
	evaluators: ProjectEvaluatorDetailDto[];

	@ApiProperty({
		example: { id: 1, name: { es: 'Curso', en: 'Course' }, description: {}, learningOutcome: {} },
		nullable: true,
	})
	course: {
		id: number;
		name: any;
		description: any;
		learningOutcome: any;
	} | null;

	@ApiProperty({ example: {}, nullable: true })
	rubric: {
		rubric: any;
		outcomes: any[];
		questions: RubricQuestionDetailsDto[];
	} | null;
}

export class FilterProjectDto {
	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'codeExample', required: false })
	code?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: { es: 'nameEs', en: 'nameEn' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'descriptionEs', en: 'descriptionEn' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'extraValue' }, required: false })
	extra?: any;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'ID del periodo académico',
	})
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'ID del programa/carrera',
	})
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'ID del curso (academic.courses)',
	})
	courseId?: number;

	@IsOptional()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'ID del estudiante.',
	})
	studentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'ID del profesor evaluador.',
	})
	professorId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID de la escuela' })
	schoolId?: number;
}
