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
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';

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

	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2, 3],
		required: true,
		description: 'IDs de student_section_enrollments',
	})
	student_section_enrollment_ids: number[];

	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2],
		required: true,
		description: 'IDs de profesores evaluadores',
	})
	evaluator_professor_ids: number[];

	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
}

export class UpdateProjectDto {
	@IsOptional()
	@ApiProperty({ example: { key: 'extra_value' }, required: false })
	extra?: any;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({ example: true, required: false })
	is_active?: boolean;
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
	student_section_enrollment_ids?: number[];

	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	@ApiProperty({
		type: [Number],
		example: [1, 2],
		required: false,
	})
	evaluator_professor_ids?: number[];
}

export class EvaluatorInfoDto {
	@ApiProperty()
	id: number; // project_evaluator_id

	@ApiProperty()
	professor_id: number;

	@ApiProperty()
	first_name: string;

	@ApiProperty()
	last_name: string;

	@ApiProperty()
	email: string;

	@ApiProperty()
	evaluator_type: string; // DOC, COM, GER...
}

export class StudentInfoDto {
	@ApiProperty()
	id: number; // project_student_id

	@ApiProperty()
	student_id: number;

	@ApiProperty()
	first_name: string;

	@ApiProperty()
	last_name: string;

	@ApiProperty()
	email: string;

	@ApiProperty()
	student_code: string;
}

export class ProjectEvaluatorResponseDto {
	@ApiProperty()
	project_id: number;

	@ApiProperty()
	project_code: string;

	@ApiProperty()
	project_name: I18nText;

	@ApiProperty()
	evaluation_date: Date;

	@ApiProperty()
	course_name: string;

	@ApiProperty({ type: EvaluatorInfoDto })
	evaluators: EvaluatorInfoDto[];

	@ApiProperty({ type: [StudentInfoDto] })
	students: StudentInfoDto[];
}

export class CriteriaScoreDto {
	@ApiProperty()
	student_id: number; // o project_student_id

	@ApiProperty()
	evaluator_id: number; // project_evaluator_id

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
	min_value: string;

	@ApiProperty()
	max_value: string;

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
	evaluator_id: number;

	@ApiProperty({ description: 'ID del tipo de estado de calificación desde core.types (TG404)' })
	qualification_status_type_id: number;
}

export class ProjectDetailsStudentDto extends StudentInfoDto {
	@ApiProperty({ nullable: true })
	total_grade: number | null;

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
	professor_id: number;

	@ApiProperty()
	professor_first_name: string;

	@ApiProperty()
	professor_last_name: string;

	@ApiProperty()
	professor_email: string;

	@ApiProperty()
	evaluator_type_id: number;

	@ApiProperty()
	evaluator_type_name: string;
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
	academic_period: {
		id: number;
		modality_type_id: number;
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
	is_active?: boolean;

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
	academic_period_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 3,
		required: false,
		description: 'ID del programa/carrera',
	})
	program_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({ example: 1, required: false, description: 'ID de la escuela' })
	school_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 12,
		required: false,
		description: 'ID del curso (academic.courses)',
	})
	course_id?: number;

	// ── Filtros por personas ──────────────────────────────────────────────
	@IsOptional()
	@ApiProperty({
		example: 15,
		required: false,
		description: 'ID del estudiante.',
	})
	student_id?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 8,
		required: false,
		description: 'ID del profesor evaluador.',
	})
	professor_id?: number;
}
