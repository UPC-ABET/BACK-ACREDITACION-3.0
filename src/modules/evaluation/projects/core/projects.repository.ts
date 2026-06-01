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
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from 'src/modules/academic/study-plans/model/study-plans.entity';

// Origanization types for school and program
const SCHOOL_TYPE_CODE = 'TG903-T001';
const PROGRAM_TYPE_CODE = 'TG903-T002';

export class ProjectRepository extends BaseRepository<ProjectEntity> {
	constructor(
		@InjectRepository(ProjectEntity)
		repository: Repository<ProjectEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(filters: FilterProjectDto): Promise<any[]> {
		const qb = this.dataSource
			.createQueryBuilder(ProjectEntity, 'project')
			.leftJoinAndSelect('project.students', 'ps')
			.leftJoinAndSelect('project.evaluators', 'pe')
			.leftJoin(
				StudentSectionEnrollmentEntity,
				'sse_enrich',
				'sse_enrich.id = ps.student_section_enrollment_id',
			)
			.leftJoin(EnrolledStudentEntity, 'es_enrich', 'es_enrich.id = sse_enrich.enrolled_student_id')
			.leftJoin(StudentEntity, 'st_enrich', 'st_enrich.id = es_enrich.student_id')
			.leftJoin(UserEntity, 'u_enrich', 'u_enrich.id = st_enrich.user_id')
			.leftJoin(CourseSectionEntity, 'cs_enrich', 'cs_enrich.id = sse_enrich.course_section_id')
			.leftJoin(ProfessorEntity, 'prof_enrich', 'prof_enrich.id = pe.professor_id')
			.leftJoin(StaffEntity, 'staff_enrich', 'staff_enrich.id = prof_enrich.staff_id')
			.leftJoin(UserEntity, 'u_prof_enrich', 'u_prof_enrich.id = staff_enrich.user_id')
			.leftJoin(TypeEntity, 'eval_type_enrich', 'eval_type_enrich.id = pe.evaluator_type_id')
			.addSelect([
				'u_enrich.first_name',
				'u_enrich.last_name',
				'st_enrich.id',
				'cs_enrich.section_code',
				'cs_enrich.id',
				'u_prof_enrich.first_name',
				'u_prof_enrich.last_name',
				'eval_type_enrich.name',
				'eval_type_enrich.code',
			]);

		// ── Filters ─────────────────────────────────────────────

		if (filters.code) {
			qb.andWhere('project.code = :code', { code: filters.code });
		}
		if (filters.isActive !== undefined) {
			qb.andWhere('project.is_active = :isActive', { isActive: filters.isActive });
		}

		// ── Evaluador ────────────────────────────────────────────────────

		if (filters.professorId) {
			qb.andWhere('pe.professor_id = :professorId', { professorId: filters.professorId });
		}

		// ── Flags to build JOINs only when needed ──────────

		const needsEnrollment = !!(
			filters.studentId ||
			filters.courseId ||
			filters.academicPeriodId ||
			filters.programId ||
			filters.schoolId
		);
		const needsCourseSection = !!(
			filters.courseId ||
			filters.academicPeriodId ||
			filters.programId ||
			filters.schoolId
		);
		const needsSpc = needsCourseSection;
		const needsSpap = !!(filters.academicPeriodId || filters.programId || filters.schoolId);
		const needsSp = !!(filters.programId || filters.schoolId);

		// ── JOIN: Student Section Enrollment ────────────────────────────

		if (needsEnrollment) {
			qb.leftJoin(
				StudentSectionEnrollmentEntity,
				'sse',
				'sse.id = ps.student_section_enrollment_id',
			);
		}

		// ── Student ───────────────────────────────────────────────────────

		if (filters.studentId) {
			qb.leftJoin(EnrolledStudentEntity, 'es', 'es.id = sse.enrolled_student_id');
			qb.andWhere('es.student_id = :studentId', { studentId: filters.studentId });
		}

		// ── JOIN: Course Section ────────────────────────────────────────

		if (needsCourseSection) {
			qb.leftJoin(CourseSectionEntity, 'cs', 'cs.id = sse.course_section_id');
		}

		// ── JOIN: Study Plan Course ─────────────────────────────────────

		if (needsSpc) {
			qb.leftJoin(StudyPlanCourseEntity, 'spc', 'spc.id = cs.study_plan_course_id');
		}

		// ── Course ────────────────────────────────────────────────────────

		if (filters.courseId) {
			qb.andWhere('spc.course_id = :courseId', { courseId: filters.courseId });
		}

		// ── JOIN: Study Plan Academic Period ────────────────────────────

		if (needsSpap) {
			qb.leftJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			);
		}

		// ── Academic Period ────────────────────────────────────────────

		if (filters.academicPeriodId) {
			qb.andWhere('spap.academic_period_id = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		}

		// ── Join Study Plan ────────────────────────────────────────────

		if (needsSp) {
			qb.leftJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
		}

		// ── Program ─────────────────────────────────────────────

		if (filters.programId) {
			qb.andWhere('sp.program_id = :programId', { programId: filters.programId });
		}

		// ── School ──────────────────────────────────────────────────────
		if (filters.schoolId) {
			qb.andWhere(
				`sp.program_id IN (
                SELECT ch_prog.entity_code
                FROM   organization.charts   ch_prog
                INNER JOIN core.types        t_prog
                       ON  t_prog.id   = ch_prog.entity_type_id
                       AND t_prog.code = '${PROGRAM_TYPE_CODE}'
                INNER JOIN organization.charts ch_sch
                       ON  ch_sch.id   = ch_prog.root_chart_id
                INNER JOIN core.types        t_sch
                       ON  t_sch.id    = ch_sch.entity_type_id
                       AND t_sch.code  = '${SCHOOL_TYPE_CODE}'
                INNER JOIN organization.schools sch
                       ON  sch.id      = ch_sch.entity_code
                WHERE  sch.id = :schoolId
            )`,
			);
			qb.setParameter('schoolId', filters.schoolId);
		}

		const { entities, raw } = await qb.getRawAndEntities();

		return entities.map((project) => {
			const projectRaws = raw.filter((r) => r.projectId === project.id);

			return {
				...project,
				students: project.students.map((student) => {
					const studentRaw = projectRaws.find((r) => r.ps_id === student.id);
					return {
						...student,
						studentInfo: studentRaw
							? {
									firstName: studentRaw.u_enrich_first_name,
									lastName: studentRaw.u_enrich_last_name,
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
						evaluatorInfo: evalRaw
							? {
									firstName: evalRaw.u_prof_enrich_first_name,
									lastName: evalRaw.u_prof_enrich_last_name,
									evaluatorTypeName: evalRaw.eval_type_enrich_name,
									evaluatorTypeCode: evalRaw.eval_type_enrich_code,
								}
							: null,
					};
				}),
			};
		});
	}
}
