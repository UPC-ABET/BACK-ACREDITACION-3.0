import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProjectEntity } from '../model/projects.entity';
import { FilterProjectDto } from '../model/projects.dtos';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { EnrolledStudentEntity } from 'src/modules/academic/enrolled-students/model/enrolled-students.entity';
import { StudentEntity } from 'src/modules/academic/students/model/students.entity';
import { UserEntity } from 'src/modules/organization/users/model/users.entity';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
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

export class ProjectRepository extends BaseRepository<ProjectEntity> {
	constructor(
		@InjectRepository(ProjectEntity)
		repository: Repository<ProjectEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(filters: FilterProjectDto & ScopeFilters): Promise<any[]> {
		const academicPeriodId = filters.academicPeriodId ?? undefined;
		const schoolId = filters.schoolId ?? undefined;

		const qb = this.dataSource
			.createQueryBuilder(ProjectEntity, 'project')
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
			);

		if (filters.code) {
			qb.andWhere('project.code = :code', { code: filters.code });
		}
		if (filters.isActive !== undefined) {
			qb.andWhere('project.is_active = :isActive', { isActive: filters.isActive });
		}

		if (filters.professorId) {
			qb.andWhere('pe.professor_id = :professorId', { professorId: filters.professorId });
		}

		const needsSseJoin = !!(
			filters.studentId ||
			filters.courseId ||
			academicPeriodId ||
			filters.programId ||
			schoolId
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

		const { entities, raw } = await qb.getRawAndEntities();

		return entities.map((project) => {
			const projectRaws = raw.filter((r) => r.project_id === project.id);
			const hasEvaluations =
				projectRaws[0]?.project_has_evaluations === true ||
				projectRaws[0]?.project_has_evaluations === 't';

			return {
				...project,
				hasEvaluations,
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
}
