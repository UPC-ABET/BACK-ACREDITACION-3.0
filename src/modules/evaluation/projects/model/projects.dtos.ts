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
	@ApiProperty({ example: 5, required: true, description: 'ID del tipo de evaluador (TG403)' })
	evaluatorTypeId: number;
}

export class CreateProjectDto {
	@IsString()
	@IsNotEmpty()
	@Length(1, 50)
	@ApiProperty({ example: 'code_example', required: true })
	code: string;

	@IsObject()
	@IsNotEmpty()
	@ApiProperty({ example: { es: 'name_es', en: 'name_en' }, required: true })
	name: I18nText;

	@IsOptional()
	@IsObject()
	@ApiProperty({ example: { es: 'description_es', en: 'description_en' }, required: false })
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
		type: [ProjectEvaluatorInputDto],
		required: true,
		description: 'Evaluadores con su tipo',
	})
	evaluators: ProjectEvaluatorInputDto[];

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;
}

export class UpdateProjectDto {
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
		example: [1, 2],
		required: false,
	})
	evaluatorProfessorIds?: number[];
}

export class EvaluatorInfoDto {
	@ApiProperty()
	id: number; // project_evaluator_id

	@ApiProperty()
	professorId: number;

	@ApiProperty()
	firstName: string;

	@ApiProperty()
	lastName: string;

	@ApiProperty()
	email: string;

	@ApiProperty()
	evaluatorType: string; // DOC, COM, GER...
}

export class StudentInfoDto {
	@ApiProperty()
	id: number; // project_student_id

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
}

export class ProjectEvaluatorResponseDto {
	@ApiProperty()
	projectId: number;

	@ApiProperty()
	projectCode: string;

	@ApiProperty()
	projectName: I18nText;

	@ApiProperty()
	evaluationDate: Date;

	@ApiProperty()
	courseName: string;

	@ApiProperty({ type: EvaluatorInfoDto })
	evaluators: EvaluatorInfoDto[];

	@ApiProperty({ type: [StudentInfoDto] })
	students: StudentInfoDto[];
}

export class CriteriaScoreDto {
	@ApiProperty()
	studentId: number; // o project_student_id

	@ApiProperty()
	evaluatorId: number; // project_evaluator_id

	@ApiProperty()
	score: number;

	@ApiProperty()
	commentaries: string;
}

export class RubricCriteriaDetailsDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	text: I18nText;

	@ApiProperty()
	minValue: string;

	@ApiProperty()
	maxValue: string;

	@ApiProperty({ type: [CriteriaScoreDto], nullable: true })
	scores: CriteriaScoreDto[] | null;
}

export class RubricQuestionDetailsDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	text: I18nText;

	@ApiProperty()
	outcomeId: number | null;

	@ApiProperty({ type: [RubricCriteriaDetailsDto] })
	criterias: RubricCriteriaDetailsDto[];
}

export class StudentEvaluationStatusDto {
	@ApiProperty({ description: 'project_evaluator_id del evaluador que registró la evaluación' })
	evaluatorId: number;

	@ApiProperty({ description: 'ID del tipo de estado de calificación desde core.types (TG404)' })
	qualificationStatusTypeId: number;
}

export class ProjectDetailsStudentDto extends StudentInfoDto {
	@ApiProperty({ nullable: true })
	totalGrade: number | null;

	@ApiProperty({
		type: [StudentEvaluationStatusDto],
		description: 'Estado de calificación por evaluador. Solo presente en modo evaluación.',
	})
	evaluations: StudentEvaluationStatusDto[];
}

export class ProjectEvaluatorDetailDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	professorId: number;

	@ApiProperty()
	professorFirstName: string;

	@ApiProperty()
	professorLastName: string;

	@ApiProperty()
	professorEmail: string;

	@ApiProperty()
	evaluatorTypeId: number;

	@ApiProperty()
	evaluatorTypeName: string;
}

export class ProjectDetailsResponseDto {
	@ApiProperty()
	project: {
		id: number;
		code: string;
		name: I18nText;
		description: I18nText;
	};

	@ApiProperty()
	academicPeriod: {
		id: number;
		modalityTypeId: number;
		code: string;
	};

	@ApiProperty({ type: [ProjectDetailsStudentDto] })
	students: ProjectDetailsStudentDto[];

	@ApiProperty({ type: [ProjectEvaluatorDetailDto] })
	evaluators: ProjectEvaluatorDetailDto[];

	@ApiProperty()
	rubric: {
		rubric: any;
		course: any;
		outcomes: any[];
		questions: RubricQuestionDetailsDto[];
	};
}

export class FilterProjectDto {
	// ── Filtros propios del proyecto ──────────────────────────────────────
	@IsOptional()
	@IsString()
	@ApiProperty({ example: 'PROJ-001', required: false })
	code?: string;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	isActive?: boolean;

	@IsOptional()
	@ApiProperty({ example: { es: 'nombre', en: 'name' }, required: false })
	name?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { es: 'descripción', en: 'description' }, required: false })
	description?: I18nText;

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	// ── Filtros contextuales ──────────────────────────────────────────────
	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 5,
		required: false,
		description: 'ID del periodo académico',
	})
	academicPeriodId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 3,
		required: false,
		description: 'ID del programa/carrera',
	})
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID de la escuela' })
	schoolId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 12,
		required: false,
		description: 'ID del curso (academic.courses)',
	})
	courseId?: number;

	// ── Filtros por personas ──────────────────────────────────────────────
	@IsOptional()
	@ApiProperty({
		example: 15,
		required: false,
		description: 'ID del estudiante.',
	})
	studentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 8,
		required: false,
		description: 'ID del profesor evaluador.',
	})
	professorId?: number;
}
