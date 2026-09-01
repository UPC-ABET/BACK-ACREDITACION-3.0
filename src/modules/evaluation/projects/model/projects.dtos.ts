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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { I18nText } from 'src/shared/types/i18n';
import { PaginationQueryDto } from 'src/commons/pagination.dtos';

export class ProjectEvaluatorInputDto {
	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Evaluator professor ID' })
	professorId: number;

	@IsInt()
	@ApiProperty({ example: 1, required: true, description: 'Evaluator type ID (TG403)' })
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
	@ApiProperty({ example: 1, required: true, description: 'Study plan course ID' })
	studyPlanCourseId: number;

	@IsInt()
	@ApiProperty({
		example: 1,
		required: true,
		description: 'Project group (virtual company) ID the project belongs to',
	})
	projectGroupId: number;

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
		description: 'Evaluators with their type',
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
	@IsInt()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Project group (virtual company) ID the project belongs to',
	})
	projectGroupId?: number;

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

	@ApiProperty({
		example: 18,
		nullable: true,
		description:
			'Grade from the latest evaluation for this student under the requested competencyScopeCode. ' +
			'Scaled to 20 for Capstone + Multiple competency rubrics, raw score sum otherwise. Null if not graded yet.',
	})
	totalGrade: number | null;
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
		description: 'Project evaluator ID of the evaluator who registered the evaluation',
	})
	evaluatorId: number;

	@ApiProperty({
		example: 1,
		description: 'Qualification status type ID from core.types (TG404)',
	})
	qualificationStatusTypeId: number;
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

export class ProjectDetailsStudentWithSpcDto extends StudentInfoDto {
	@ApiProperty({ example: 42, description: 'Study plan course ID the student belongs to' })
	studyPlanCourseId: number | null;
}

export class ProjectRubricItemStudentGradeDto {
	@ApiProperty({ example: 1, description: 'Project student ID graded in this rubric' })
	projectStudentId: number;

	@ApiProperty({ example: 18, nullable: true })
	totalGrade: number | null;

	@ApiProperty({
		example: {},
		type: [StudentEvaluationStatusDto],
		description: 'Qualification status per evaluator in this rubric. Evaluation mode only.',
	})
	evaluationStatuses: StudentEvaluationStatusDto[];

	@ApiProperty({
		example: { es: 'Observación general', en: 'Overall observation' },
		nullable: true,
		description:
			'Observation in I18nText format (JSONB). Always an object, never a plain string. Null if not set.',
	})
	observation: I18nText | null;
}

export class ProjectRubricItemDto {
	@ApiProperty({
		example: { id: 5, code: 'TG205-T005', name: { es: 'TP', en: 'TP' } },
		description: 'Grade type this rubric belongs to',
	})
	gradeType: any;

	@ApiProperty({
		example: { id: 7, code: 'TG402-T001', name: { es: 'Parcial', en: 'Midterm' } },
		description: 'Evaluation stage (Midterm/Final) this rubric belongs to',
	})
	competencyScopeType: any;

	@ApiProperty({ example: {}, nullable: true })
	rubric: any;

	@ApiProperty({ example: [], type: Array })
	commissions: any[];

	@ApiProperty({ example: [], type: Array })
	outcomes: any[];

	@ApiProperty({ example: {}, type: [RubricQuestionDetailsDto] })
	questions: RubricQuestionDetailsDto[];

	@ApiProperty({ example: [], type: [ProjectRubricItemStudentGradeDto] })
	students: ProjectRubricItemStudentGradeDto[];
}

export class ProjectRubricGroupDto {
	@ApiProperty({
		example: 42,
		description: 'Study plan course ID the rubrics belong to',
	})
	studyPlanCourseId: number;

	@ApiProperty({
		example: { es: 'Ingeniería de Software', en: 'Software Engineering' },
		nullable: true,
	})
	programName: any;

	@ApiProperty({
		example: [],
		type: [ProjectRubricItemDto],
		description: 'Active rubrics for the requested evaluation stage, one per grade type',
	})
	items: ProjectRubricItemDto[];
}

export class ProjectDetailsResponseDto {
	@ApiProperty({ example: { es: 'Ejemplo', en: 'Example' } })
	project: {
		id: number;
		code: string;
		name: I18nText;
		description: I18nText;
		projectGroup: {
			id: number;
			code: string;
			name: I18nText;
		} | null;
	};

	@ApiProperty({ example: {} })
	academicPeriod: {
		id: number;
		modalityTypeId: number;
		code: string;
	};

	@ApiProperty({ example: {}, type: [ProjectDetailsStudentWithSpcDto] })
	students: ProjectDetailsStudentWithSpcDto[];

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

	@ApiProperty({ example: [], type: [ProjectRubricGroupDto] })
	rubrics: ProjectRubricGroupDto[];
}

export class GetProjectsByProfessorQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'TG402-T001',
		description: 'Filter by evaluation stage code (Midterm/Final)',
	})
	competencyScopeCode?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'García',
		description: 'Search by project code, project name (es/en) or student full name',
	})
	search?: string;
}

export class FilterProjectDto extends PaginationQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		example: 'García',
		description: 'Search by code, project name or student name',
	})
	search?: string;

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
		description: 'Program ID',
	})
	programId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Project group (virtual company) ID',
	})
	projectGroupId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Course ID (academic.courses)',
	})
	courseId?: number;

	@IsOptional()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Student ID.',
	})
	studentId?: number;

	@IsOptional()
	@IsNumber()
	@ApiProperty({
		example: 1,
		required: false,
		description: 'Evaluator professor ID.',
	})
	professorId?: number;

	@IsOptional()
	@IsBoolean()
	@ApiProperty({
		example: true,
		required: false,
		description:
			'When true, restrict results to projects whose course section applies to the X-Academic-Period-Id header. Ignored (no filter applied) when false or omitted, even if the header is present.',
	})
	useAcademicPeriod?: boolean;
}
