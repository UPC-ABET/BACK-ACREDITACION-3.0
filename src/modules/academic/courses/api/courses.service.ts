import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { CourseRepository } from '../core/courses.repository';
import { CourseValidation } from '../core/courses.validation';

import { CreateCourseDto, FilterCourseDto, UpdateCourseDto } from '../model/courses.dtos';
import { DataSource, EntityManager } from 'typeorm';
import { CourseEntity } from '../model/courses.entity';
import { StudyPlanCourseEntity } from '../../study-plan-courses/model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from '../../study-plans/model/study-plans.entity';

const SCHOOL_TYPE_CODE = 'TG903-T001';
const PROGRAM_TYPE_CODE = 'TG903-T002';

@Injectable()
export class CourseService extends BaseService<CourseRepository> {
	constructor(
		protected readonly repository: CourseRepository,
		protected readonly dataSource: DataSource,
	) {
		super(repository);
	}

	async create(dto: CreateCourseDto, manager?: EntityManager) {
		await CourseValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateCourseDto, manager?: EntityManager) {
		await CourseValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async delete(id: number, manager?: EntityManager) {
		await CourseValidation.validateDelete(this.repository, id);
		return await super.delete(id, manager);
	}

	async getByFilters(filters: FilterCourseDto): Promise<CourseEntity[]> {
		const qb = this.dataSource
			.createQueryBuilder(CourseEntity, 'c');

		// ── Direct Filters ─────────────────────────────────────────────────
		if (filters.code) qb.andWhere('c.code = :code', { code: filters.code });
		if (filters.is_active !== undefined) qb.andWhere('c.is_active = :is_active', { is_active: filters.is_active });

		// ── Flags ────────────────────────────────────────────────────────────
		const needsSpc = !!(filters.academic_period_id || filters.program_id || filters.school_code);
		const needsSpap = needsSpc;
		const needsSp = !!(filters.program_id || filters.school_code);

		// ── JOINs ────────────────────────────────────────────────────────────
		if (needsSpc) {
			qb.leftJoin(StudyPlanCourseEntity, 'spc', 'spc.course_id = c.id');
			qb.leftJoin(StudyPlanAcademicPeriodEntity, 'spap', 'spap.id = spc.study_plan_academic_period_id');
		}

		if (filters.academic_period_id) {
			qb.andWhere('spap.academic_period_id = :academic_period_id', {
				academic_period_id: filters.academic_period_id,
			});
		}

		if (needsSp) {
			qb.leftJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
		}

		if (filters.program_id) {
			qb.andWhere('sp.program_id = :program_id', { program_id: filters.program_id });
		}

		// ── School ──────────────────────────────────────────────────────────
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
