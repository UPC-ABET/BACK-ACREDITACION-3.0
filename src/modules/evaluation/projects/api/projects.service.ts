import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { ProjectRepository } from '../core/projects.repository';
import { ProjectValidation } from '../core/projects.validation';

import { CreateProjectDto, FilterProjectDto, UpdateProjectDto } from '../model/projects.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { StudyPlanEntity } from 'src/modules/academic/study-plans/model/study-plans.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { CourseSectionEntity } from 'src/modules/academic/course-sections/model/course-sections.entity';
import { EnrolledStudentEntity } from 'src/modules/academic/enrolled-students/model/enrolled-students.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { ProjectEntity } from '../model/projects.entity';

// Origanization types for school and program
const SCHOOL_TYPE_CODE = 'TG903-T001';
const PROGRAM_TYPE_CODE = 'TG903-T002';

@Injectable()
export class ProjectService extends BaseService<ProjectRepository> {
	constructor(
		protected readonly repository: ProjectRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateProjectDto, manager?: EntityManager) {
		await ProjectValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateProjectDto, manager?: EntityManager) {
		await ProjectValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await ProjectValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByFilters(filters: FilterProjectDto): Promise<ProjectEntity[]> {
		const qb = this.dataSource
			.createQueryBuilder(ProjectEntity, 'project')
			.leftJoinAndSelect('project.students', 'ps')
			.leftJoinAndSelect('project.evaluators', 'pe');

		// ── Filters ─────────────────────────────────────────────

		if (filters.code) {
			qb.andWhere('project.code = :code', { code: filters.code });
		}
		if (filters.is_active !== undefined) {
			qb.andWhere('project.is_active = :is_active', { is_active: filters.is_active });
		}

		// ── Evaluador ────────────────────────────────────────────────────

		if (filters.professor_id) {
			qb.andWhere('pe.professor_id = :professor_id', { professor_id: filters.professor_id });
		}

		// ── Flags to build JOINs only when needed ──────────

		const needsEnrollment = !!(
			filters.student_id ||
			filters.course_id ||
			filters.academic_period_id ||
			filters.program_id ||
			filters.school_code
		);
		const needsCourseSection = !!(
			filters.course_id ||
			filters.academic_period_id ||
			filters.program_id ||
			filters.school_code
		);
		const needsSpc = needsCourseSection; 
		const needsSpap = !!(
			filters.academic_period_id ||
			filters.program_id ||
			filters.school_code
		);
		const needsSp = !!(filters.program_id || filters.school_code);

		// ── JOIN: Student Section Enrollment ────────────────────────────

		if (needsEnrollment) {
			qb.leftJoin(
				StudentSectionEnrollmentEntity,
				'sse',
				'sse.id = ps.student_section_enrollment_id',
			);
		}

		// ── Student ───────────────────────────────────────────────────────

		if (filters.student_id) {
			qb.leftJoin(EnrolledStudentEntity, 'es', 'es.id = sse.enrolled_student_id');
			qb.andWhere('es.student_id = :student_id', { student_id: filters.student_id });
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

		if (filters.course_id) {
			qb.andWhere('spc.course_id = :course_id', { course_id: filters.course_id });
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

		if (filters.academic_period_id) {
			qb.andWhere('spap.academic_period_id = :academic_period_id', {
				academic_period_id: filters.academic_period_id,
			});
		}

		// ── Join Study Plan ────────────────────────────────────────────

		if (needsSp) {
			qb.leftJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
		}

		// ── Program ─────────────────────────────────────────────

		if (filters.program_id) {
			qb.andWhere('sp.program_id = :program_id', { program_id: filters.program_id });
		}

		// ── School ──────────────────────────────────────────────────────
		if (filters.school_code) {
			qb.andWhere(
				`sp.program_id IN (
					SELECT ch_prog.entity_code
					FROM   organization.charts   ch_prog
					INNER JOIN core.types        t_prog
					       ON  t_prog.id   = ch_prog.entity_type_id
					       AND t_prog.code = '${PROGRAM_TYPE_CODE}'
					INNER JOIN organization.charts ch_sch
					       ON  ch_sch.id   = ch_prog.root_chart_detail_id
					INNER JOIN core.types        t_sch
					       ON  t_sch.id    = ch_sch.entity_type_id
					       AND t_sch.code  = '${SCHOOL_TYPE_CODE}'
					INNER JOIN organization.schools sch
					       ON  sch.id      = ch_sch.entity_code
					WHERE  sch.code = :school_code
				)`,
			);
			qb.setParameter('school_code', filters.school_code);
		}

		return await qb.getMany();
	}
}
