import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProjectEntity } from '../model/projects.entity';
import { CreateProjectDto, FilterProjectDto } from '../model/projects.dtos';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { EnrolledStudentEntity } from 'src/modules/academic/enrolled-students/model/enrolled-students.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { CourseEntity } from 'src/modules/academic/courses/model/courses.entity';
import { ProfessorEntity } from 'src/modules/academic/professors/model/professors.entity';
import { StaffEntity } from 'src/modules/organization/staff/model/staff.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from 'src/modules/academic/study-plans/model/study-plans.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { ScopeFilters } from 'src/commons/scope.dtos';
import {
	programInSchoolSubquery,
	schoolProgramFilterParams,
} from 'src/libs/school-program.functions';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { PaginatedResult, resolvePagination, toPaginated } from 'src/commons/pagination.dtos';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { EvaluationEntity } from 'src/modules/evidence/evaluations/model/evaluations.entity';
import { RubricQuestionCriteriaEntity } from '../../rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricQuestionEntity } from '../../rubric-questions/model/rubric-questions.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { I18nText } from 'src/shared/types/i18n';
import {
	CAPSTONE_MAX_LEVEL_VALUE_SQL,
	COURSE_BASIC_BY_ID_SQL,
	PROGRAM_IDS_BY_SCHOOL_SQL,
	PROGRAM_NAMES_BY_STUDY_PLAN_COURSE_SQL,
	PROJECTS_BY_PROFESSOR_DETAIL_SQL,
	PROJECT_DUPLICATE_CODE_SQL,
	PROJECT_DUPLICATE_NAME_SQL,
	PROJECT_GRADES_EXPORT_SQL,
	RUBRIC_QUESTION_COUNT_SQL,
	SSE_TO_STUDY_PLAN_COURSE_SQL,
	STUDENT_ALREADY_IN_PROJECT_SQL,
} from './project-config.sql';

export interface CapstoneMaxValueRow {
	maxValue: string | null;
}

export interface RubricQuestionCountRow {
	questionCount: string | null;
}

export interface ProgramIdRow {
	programId: number;
}

export interface ProjectIdRow {
	id: number;
}

export interface CourseBasicRow {
	id: number;
	name: unknown;
	description: unknown;
	learningOutcome: unknown;
}

export interface SseToStudyPlanCourseRow {
	sseId: number;
	studyPlanCourseId: number;
}

export interface ProgramNameRow {
	spcId: number;
	programName: unknown;
}

export interface CreateProjectArgs {
	code: string;
	name: CreateProjectDto['name'];
	description: CreateProjectDto['description'];
	isActive: boolean;
	extra: CreateProjectDto['extra'];
	studentSectionEnrollmentIds: number[];
	evaluators: CreateProjectDto['evaluators'];
}

export interface ProjectsByProfessorFilterArgs {
	professorId: number;
	gradeTypeId?: number;
	academicPeriodId?: number;
	programIds: number[] | null;
	search?: string;
}

export interface ProjectsByProfessorRawRow {
	projectId: number;
	projectCode: string | null;
	projectName: I18nText | string | null;
	evaluationDate: Date | null;
	evalId: number | null;
	evalProfessorId: number | null;
	evalFirstName: string | null;
	evalLastName: string | null;
	evalEmail: string | null;
	evalTypeName: I18nText | string | null;
	evalTypeCode: string | null;
	studentPsId: number | null;
	studentId: number | null;
	stuFirstName: string | null;
	stuLastName: string | null;
	stuEmail: string | null;
	stuCode: string | null;
	courseName: I18nText | string | null;
}

export interface GradeExportRow {
	sectionCode: string;
	courseCode: string;
	studentCode: string;
	studentName: string;
	rubricId: number;
	rubricTypeId: number;
	rubricTypeCode: string;
	gradeTypeCode: string;
	totalScore: string;
}

export class ProjectRepository extends BaseRepository<ProjectEntity> {
	constructor(
		@InjectRepository(ProjectEntity)
		repository: Repository<ProjectEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	private buildFilterQb(
		filters: FilterProjectDto & ScopeFilters,
		academicPeriodId: number | undefined,
		schoolId: number | undefined,
	): SelectQueryBuilder<ProjectEntity> {
		const search = filters.search?.trim() || undefined;

		const qb = this.dataSource
			.createQueryBuilder(ProjectEntity, 'project')
			.leftJoin('project.students', 'ps');

		if (filters.code) {
			qb.andWhere('project.code = :code', { code: filters.code });
		}
		if (filters.isActive !== undefined) {
			qb.andWhere('project.is_active = :isActive', { isActive: filters.isActive });
		}
		if (filters.professorId) {
			qb.leftJoin('project.evaluators', 'pe_f', 'pe_f.is_active = true');
			qb.andWhere('pe_f.professor_id = :professorId', { professorId: filters.professorId });
		}

		const needsSseJoin = !!(
			filters.studentId ||
			filters.courseId ||
			academicPeriodId ||
			filters.programId ||
			schoolId ||
			search
		);
		const needsCsJoin = !!(filters.courseId || academicPeriodId || schoolId);

		if (needsSseJoin) {
			qb.innerJoin(
				StudentSectionEnrollmentEntity,
				'sse',
				'sse.id = ps.student_section_enrollment_id',
			);
		}
		if (needsCsJoin) {
			qb.innerJoin(CourseSectionEntity, 'cs', 'cs.id = sse.course_section_id');
		}
		if (filters.courseId) {
			qb.andWhere('cs.course_id = :courseId', { courseId: filters.courseId });
		}
		if (academicPeriodId) {
			qb.andWhere('cs.academic_period_id = :academicPeriodId', { academicPeriodId });
		}
		if (filters.studentId) {
			qb.innerJoin(EnrolledStudentEntity, 'es', 'es.id = sse.enrolled_student_id');
			qb.andWhere('es.student_id = :studentId', { studentId: filters.studentId });
		}
		if (filters.programId) {
			qb.innerJoin(EnrolledStudentEntity, 'es_prog', 'es_prog.id = sse.enrolled_student_id');
			qb.innerJoin(StudentEntity, 'st_prog', 'st_prog.id = es_prog.student_id');
			qb.andWhere('st_prog.program_id = :programId', { programId: filters.programId });
		}
		if (schoolId) {
			qb.innerJoin(StudyPlanCourseEntity, 'spc', 'spc.course_id = cs.course_id');
			qb.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			);
			qb.innerJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
			qb.andWhere(programInSchoolSubquery('sp.program_id')).setParameters(
				schoolProgramFilterParams(schoolId),
			);
		}

		if (search) {
			qb.innerJoin(EnrolledStudentEntity, 'es_search', 'es_search.id = sse.enrolled_student_id');
			qb.innerJoin(StudentEntity, 'st_search', 'st_search.id = es_search.student_id');
			qb.andWhere(
				`(project.code ILIKE :search
				OR project.name->>'es' ILIKE :search
				OR project.name->>'en' ILIKE :search
				OR CONCAT(st_search.first_name, ' ', st_search.last_name) ILIKE :search)`,
				{ search: `%${search}%` },
			);
		}

		return qb;
	}

	async getByFilters(filters: FilterProjectDto & ScopeFilters): Promise<PaginatedResult<any>> {
		const { page, pageSize, skip, take } = resolvePagination(filters);
		const academicPeriodId = filters.academicPeriodId ?? undefined;
		const schoolId = filters.schoolId ?? undefined;

		const countRow = await this.buildFilterQb(filters, academicPeriodId, schoolId)
			.select('COUNT(DISTINCT project.id)', 'total')
			.getRawOne<{ total: string }>();
		const total = Number(countRow?.total ?? 0);

		if (total === 0) return toPaginated([], 0, page, pageSize);

		const idRows = await this.buildFilterQb(filters, academicPeriodId, schoolId)
			.select('project.id')
			.distinct(true)
			.orderBy('project.id', 'ASC')
			.skip(skip)
			.take(take)
			.getRawMany<{ project_id: number }>();

		const projectIds = idRows.map((r) => r.project_id);
		if (!projectIds.length) return toPaginated([], total, page, pageSize);

		const { entities, raw } = await this.dataSource
			.createQueryBuilder(ProjectEntity, 'project')
			.where('project.id IN (:...projectIds)', { projectIds })
			.leftJoinAndSelect('project.students', 'ps')
			.leftJoinAndSelect('project.evaluators', 'pe', 'pe.is_active = true')
			.leftJoin(
				StudentSectionEnrollmentEntity,
				'sse_enrich',
				'sse_enrich.id = ps.student_section_enrollment_id',
			)
			.leftJoin(EnrolledStudentEntity, 'es_enrich', 'es_enrich.id = sse_enrich.enrolled_student_id')
			.leftJoin(StudentEntity, 'st_enrich', 'st_enrich.id = es_enrich.student_id')
			.leftJoin(CourseSectionEntity, 'cs_enrich', 'cs_enrich.id = sse_enrich.course_section_id')
			.leftJoin(CourseEntity, 'course_enrich', 'course_enrich.id = cs_enrich.course_id')
			.leftJoin(ProfessorEntity, 'prof_enrich', 'prof_enrich.id = pe.professor_id')
			.leftJoin(StaffEntity, 'staff_enrich', 'staff_enrich.id = prof_enrich.staff_id')
			.leftJoin(UserEntity, 'u_prof_enrich', 'u_prof_enrich.id = staff_enrich.user_id')
			.leftJoin(TypeEntity, 'eval_type_enrich', 'eval_type_enrich.id = pe.evaluator_type_id')
			.addSelect('st_enrich.id', 'st_enrich_id')
			.addSelect('st_enrich.first_name', 'st_enrich_first_name')
			.addSelect('st_enrich.last_name', 'st_enrich_last_name')
			.addSelect('cs_enrich.section_code', 'cs_enrich_section_code')
			.addSelect('cs_enrich.id', 'cs_enrich_id')
			.addSelect('u_prof_enrich.first_name', 'u_prof_enrich_first_name')
			.addSelect('u_prof_enrich.last_name', 'u_prof_enrich_last_name')
			.addSelect('u_prof_enrich.email', 'u_prof_enrich_email')
			.addSelect('staff_enrich.first_name', 'staff_enrich_first_name')
			.addSelect('staff_enrich.last_name', 'staff_enrich_last_name')
			.addSelect('eval_type_enrich.name', 'eval_type_enrich_name')
			.addSelect('eval_type_enrich.code', 'eval_type_enrich_code')
			.addSelect('eval_type_enrich.extra', 'eval_type_enrich_extra')
			.addSelect('course_enrich.name', 'course_enrich_name')
			.addSelect('prof_enrich.code', 'prof_enrich_code')
			.addSelect(
				`EXISTS (
					SELECT 1
					FROM   evaluation.rubric_scores rs
					INNER JOIN evidence.evaluations e   ON e.id  = rs.evaluation_id
					INNER JOIN evaluation.project_students ps2 ON ps2.id = e.project_student_id
					WHERE  ps2.project_id = project.id
				)`,
				'project_has_evaluations',
			)
			.getRawAndEntities();

		const items = entities.map((project) => {
			const projectRaws = raw.filter((r) => r.project_id === project.id);
			const hasEvaluations =
				projectRaws[0]?.project_has_evaluations === true ||
				projectRaws[0]?.project_has_evaluations === 't';

			return {
				...project,
				hasEvaluations,
				courseName: projectRaws[0]?.course_enrich_name ?? null,
				students: project.students.map((student) => {
					const studentRaw = projectRaws.find((r) => r.ps_id === student.id);
					return {
						...student,
						studentInfo: studentRaw
							? {
									firstName: studentRaw.st_enrich_first_name || '',
									lastName: studentRaw.st_enrich_last_name || '',
									studentId: studentRaw.st_enrich_id,
									sectionCode: studentRaw.cs_enrich_section_code,
									sectionId: studentRaw.cs_enrich_id,
								}
							: null,
					};
				}),
				evaluators: project.evaluators.map((evaluator) => {
					const evalRaw = projectRaws.find((r) => r.pe_id === evaluator.id);
					return {
						...evaluator,
						professorFirstName:
							evalRaw?.u_prof_enrich_first_name || evalRaw?.staff_enrich_first_name || '',
						professorLastName:
							evalRaw?.u_prof_enrich_last_name || evalRaw?.staff_enrich_last_name || '',
						professorCode: evalRaw?.prof_enrich_code || '',
						evaluatorTypeName: evalRaw?.eval_type_enrich_name ?? null,
						evaluatorTypeCode: evalRaw?.eval_type_enrich_code ?? null,
						canEvaluate: evalRaw?.eval_type_enrich_extra?.can_evaluate === true,
						maxEvaluators: evalRaw?.eval_type_enrich_extra?.max_evaluators ?? null,
					};
				}),
			};
		});

		return toPaginated(items, total, page, pageSize);
	}

	async deleteWithChildren(id: number) {
		return await this.dataSource.transaction(async (tx) => {
			await tx.delete(ProjectStudentEntity, { projectId: id });
			await tx.delete(ProjectEvaluatorEntity, { projectId: id });
			return await this.remove(id, tx);
		});
	}

	async hasRubricScores(projectId: number): Promise<boolean> {
		const result = await this.dataSource.query(
			`SELECT 1
			 FROM   evaluation.rubric_scores rs
			 INNER JOIN evidence.evaluations e  ON e.id  = rs.evaluation_id
			 INNER JOIN evaluation.project_students ps ON ps.id = e.project_student_id
			 WHERE  ps.project_id = $1
			 LIMIT  1`,
			[projectId],
		);
		return result.length > 0;
	}

	async getCapstoneMaxLevelValue(academicPeriodId: number, rubricId: number): Promise<number> {
		const [[levelRow], [questionRow]] = (await Promise.all([
			this.dataSource.query(CAPSTONE_MAX_LEVEL_VALUE_SQL, [
				TYPE_CODES.PERF_LEVEL_INSTRUMENT.TYPE,
				academicPeriodId,
			]),
			this.dataSource.query(RUBRIC_QUESTION_COUNT_SQL, [rubricId]),
		])) as [CapstoneMaxValueRow[], RubricQuestionCountRow[]];

		const maxPerQuestion = Number(levelRow?.maxValue ?? 0);
		const questionCount = Number(questionRow?.questionCount ?? 0);
		return maxPerQuestion * questionCount;
	}

	async getProgramIdsBySchoolId(schoolId: number): Promise<number[]> {
		const rows = (await this.dataSource.query(PROGRAM_IDS_BY_SCHOOL_SQL, [
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			schoolId,
			TYPE_CODES.ENTITY_TYPE.PROGRAM,
		])) as ProgramIdRow[];
		return rows.map((row) => row.programId);
	}

	async existsProjectWithCodeInPeriod(code: string, academicPeriodId: number): Promise<boolean> {
		const rows = (await this.dataSource.query(PROJECT_DUPLICATE_CODE_SQL, [
			code,
			academicPeriodId,
		])) as ProjectIdRow[];
		return rows.length > 0;
	}

	async existsProjectWithNameInPeriod(
		nameEs: string | undefined,
		nameEn: string | undefined,
		academicPeriodId: number,
	): Promise<boolean> {
		const rows = (await this.dataSource.query(PROJECT_DUPLICATE_NAME_SQL, [
			nameEs,
			nameEn,
			academicPeriodId,
		])) as ProjectIdRow[];
		return rows.length > 0;
	}

	async existsStudentInActiveProject(
		enrollmentId: number,
		academicPeriodId: number,
	): Promise<boolean> {
		const rows = (await this.dataSource.query(STUDENT_ALREADY_IN_PROJECT_SQL, [
			enrollmentId,
			academicPeriodId,
		])) as ProjectIdRow[];
		return rows.length > 0;
	}

	async createProjectWithChildren(args: CreateProjectArgs): Promise<ProjectEntity> {
		return await this.dataSource.transaction(async (manager) => {
			const project = manager.create(ProjectEntity, {
				code: args.code,
				name: args.name,
				description: args.description,
				isActive: args.isActive,
				extra: args.extra,
			});

			const savedProject = await manager.save(project);

			const projectStudents = args.studentSectionEnrollmentIds.map((enrollmentId) =>
				manager.create(ProjectStudentEntity, {
					projectId: savedProject.id,
					studentSectionEnrollmentId: enrollmentId,
					isActive: true,
				}),
			);
			await manager.save(projectStudents);

			const projectEvaluators = args.evaluators.map((ev) =>
				manager.create(ProjectEvaluatorEntity, {
					projectId: savedProject.id,
					professorId: ev.professorId,
					evaluatorTypeId: ev.evaluatorTypeId,
					isActive: true,
				}),
			);
			await manager.save(projectEvaluators);

			return savedProject;
		});
	}

	async getProjectDetailEntity(projectId: number): Promise<ProjectEntity | null> {
		return await this.repository
			.createQueryBuilder('p')
			.leftJoinAndSelect('p.students', 's')
			.leftJoinAndSelect('s.studentSectionEnrollment', 'sse')
			.leftJoinAndSelect('sse.enrolledStudent', 'es')
			.leftJoinAndSelect('es.student', 'stu')
			.leftJoinAndSelect('sse.courseSection', 'cs')
			.leftJoinAndSelect('cs.academicPeriod', 'ap')
			.leftJoinAndSelect('p.evaluators', 'pe', 'pe.is_active = true')
			.leftJoinAndSelect('pe.professor', 'prof')
			.leftJoinAndSelect('prof.staff', 'staff')
			.leftJoinAndSelect('staff.user', 'puser')
			.where('p.id = :projectId', { projectId })
			.getOne();
	}

	async getCourseBasicById(courseId: number): Promise<CourseBasicRow | null> {
		const [row] = (await this.dataSource.query(COURSE_BASIC_BY_ID_SQL, [
			courseId,
		])) as CourseBasicRow[];
		return row ?? null;
	}

	async getSseToStudyPlanCourse(
		courseId: number,
		sseIds: number[],
	): Promise<SseToStudyPlanCourseRow[]> {
		return (await this.dataSource.query(SSE_TO_STUDY_PLAN_COURSE_SQL, [
			courseId,
			sseIds,
		])) as SseToStudyPlanCourseRow[];
	}

	async getProgramNamesByStudyPlanCourseIds(spcIds: number[]): Promise<ProgramNameRow[]> {
		return (await this.dataSource.query(PROGRAM_NAMES_BY_STUDY_PLAN_COURSE_SQL, [
			spcIds,
		])) as ProgramNameRow[];
	}

	async getActiveRubricForStudyPlanCourse(
		studyPlanCourseId: number,
		gradeTypeId?: number,
		rubricTypeId?: number,
	): Promise<RubricEntity | null> {
		return await this.dataSource
			.getRepository(RubricEntity)
			.createQueryBuilder('r')
			.leftJoinAndSelect('r.rubricType', 'rt')
			.leftJoinAndSelect('r.gradeType', 'gt')
			.where('r.study_plan_course_id = :spcId', { spcId: studyPlanCourseId })
			.andWhere('r.is_active = :isActive', { isActive: true })
			.andWhere(gradeTypeId ? 'r.grade_type_id = :gradeTypeId' : '1=1', { gradeTypeId })
			.andWhere(rubricTypeId ? 'r.rubric_type_id = :rubricTypeId' : '1=1', { rubricTypeId })
			.getOne();
	}

	async getEvaluationsForProjectStudents(
		projectId: number,
		projectStudentIds: number[],
		rubricId: number,
	): Promise<EvaluationEntity[]> {
		return await this.dataSource
			.getRepository(EvaluationEntity)
			.createQueryBuilder('ev')
			.leftJoinAndSelect('ev.scores', 'score')
			.innerJoin('ev.projectStudent', 'ps')
			.innerJoin(RubricQuestionCriteriaEntity, 'rqc', 'rqc.id = score.rubric_question_criteria_id')
			.innerJoin(RubricQuestionEntity, 'rq', 'rq.id = rqc.rubric_question_id')
			.where('ps.project_id = :projectId', { projectId })
			.andWhere('ps.id = ANY(:psIds)', { psIds: projectStudentIds })
			.andWhere('rq.rubric_id = :rubricId', { rubricId })
			.getMany();
	}

	private buildProjectsByProfessorFilter(args: ProjectsByProfessorFilterArgs): {
		filterFromWhere: string;
		params: unknown[];
		nextParamIdx: number;
	} {
		const { professorId, gradeTypeId, academicPeriodId, programIds, search } = args;

		let filterFromWhere = `
    FROM evaluation.project_evaluators pe
    INNER JOIN evaluation.projects p_filter ON p_filter.id = pe.project_id
    INNER JOIN evaluation.project_students ps ON ps.project_id = pe.project_id
    INNER JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
    INNER JOIN academic.course_sections cs ON cs.id = sse.course_section_id
    INNER JOIN academic.courses c ON c.id = cs.course_id
    INNER JOIN academic.study_plan_courses spc ON spc.course_id = c.id
    INNER JOIN academic.study_plan_academic_periods sp_ap ON sp_ap.id = spc.study_plan_academic_period_id
    INNER JOIN academic.study_plans sp ON sp.id = sp_ap.study_plan_id
    INNER JOIN academic.programs program ON program.id = sp.program_id`;

		if (search) {
			filterFromWhere += `
    INNER JOIN academic.enrolled_students es_s ON es_s.id = sse.enrolled_student_id
    INNER JOIN academic.students stu_s ON stu_s.id = es_s.student_id`;
		}

		filterFromWhere += `
    WHERE pe.professor_id = $1 AND pe.is_active = true`;

		const params: unknown[] = [professorId];
		let paramIdx = 2;

		if (gradeTypeId) {
			filterFromWhere += `
      AND EXISTS (
        SELECT 1
        FROM evaluation.rubrics r
        WHERE r.study_plan_course_id IN (
          SELECT spc2.id
          FROM academic.study_plan_courses spc2
          INNER JOIN academic.study_plan_academic_periods spap2
                  ON spap2.id = spc2.study_plan_academic_period_id
          WHERE (spc2.course_id, spap2.academic_period_id) IN (
            SELECT cs2.course_id, cs2.academic_period_id
            FROM evaluation.project_students ps2
            INNER JOIN academic.student_section_enrollments sse2
                    ON sse2.id = ps2.student_section_enrollment_id
            INNER JOIN academic.course_sections cs2
                    ON cs2.id = sse2.course_section_id
            WHERE ps2.project_id = pe.project_id
          )
        )
        AND r.grade_type_id = $${paramIdx}
      )`;
			params.push(gradeTypeId);
			paramIdx++;
		}

		if (academicPeriodId) {
			filterFromWhere += ` AND cs.academic_period_id = $${paramIdx}`;
			params.push(academicPeriodId);
			paramIdx++;
		}

		if (programIds !== null) {
			filterFromWhere += ` AND program.id = ANY($${paramIdx}::int[])`;
			params.push(programIds);
			paramIdx++;
		}

		if (search) {
			filterFromWhere += `
      AND (
        p_filter.code ILIKE $${paramIdx}
        OR p_filter.name->>'es' ILIKE $${paramIdx}
        OR p_filter.name->>'en' ILIKE $${paramIdx}
        OR CONCAT(stu_s.first_name, ' ', stu_s.last_name) ILIKE $${paramIdx}
      )`;
			params.push(`%${search}%`);
			paramIdx++;
		}

		return { filterFromWhere, params, nextParamIdx: paramIdx };
	}

	async countProjectsByProfessor(args: ProjectsByProfessorFilterArgs): Promise<number> {
		const { filterFromWhere, params } = this.buildProjectsByProfessorFilter(args);
		const [countRow] = (await this.dataSource.query(
			`SELECT COUNT(DISTINCT pe.project_id) AS "total" ${filterFromWhere}`,
			params,
		)) as [{ total: string }];
		return Number(countRow?.total ?? 0);
	}

	async getProjectIdsByProfessor(
		args: ProjectsByProfessorFilterArgs,
		take: number,
		skip: number,
	): Promise<number[]> {
		const { filterFromWhere, params, nextParamIdx } = this.buildProjectsByProfessorFilter(args);
		const rows = (await this.dataSource.query(
			`SELECT DISTINCT pe.project_id AS "projectId" ${filterFromWhere} ORDER BY pe.project_id LIMIT $${nextParamIdx} OFFSET $${nextParamIdx + 1}`,
			[...params, take, skip],
		)) as { projectId: number }[];
		return rows.map((r) => r.projectId);
	}

	async getProjectsByProfessorDetail(
		projectIds: number[],
		gradeTypeId?: number,
	): Promise<ProjectsByProfessorRawRow[]> {
		return (await this.dataSource.query(PROJECTS_BY_PROFESSOR_DETAIL_SQL, [
			projectIds,
			gradeTypeId ?? null,
		])) as ProjectsByProfessorRawRow[];
	}

	async getProjectGradesForExport(
		academicPeriodId: number,
		gradeTypeId: number,
		programIds: number[],
	): Promise<GradeExportRow[]> {
		return (await this.dataSource.query(PROJECT_GRADES_EXPORT_SQL, [
			academicPeriodId,
			gradeTypeId,
			programIds,
		])) as GradeExportRow[];
	}
}
