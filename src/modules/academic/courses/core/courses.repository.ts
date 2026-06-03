import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { CourseEntity } from '../model/courses.entity';
import { FilterCourseDto } from '../model/courses.dtos';
import { StudyPlanCourseEntity } from '../../study-plan-courses/model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from '../../study-plans/model/study-plans.entity';

const SCHOOL_TYPE_CODE = 'TG903-T002';
const PROGRAM_TYPE_CODE = 'TG903-T003';

export class CourseRepository extends BaseRepository<CourseEntity> {
	constructor(
		@InjectRepository(CourseEntity)
		repository: Repository<CourseEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(filters: FilterCourseDto): Promise<CourseEntity[]> {
		const qb = this.dataSource.createQueryBuilder(CourseEntity, 'c');

		// ── Direct Filters ─────────────────────────────────────────────────
		if (filters.code) qb.andWhere('c.code = :code', { code: filters.code });
		if (filters.isActive !== undefined)
			qb.andWhere('c.is_active = :isActive', { isActive: filters.isActive });

		// ── Flags ────────────────────────────────────────────────────────────
		const needsSpc = !!(filters.academicPeriodId || filters.programId || filters.schoolId);
		const needsSpap = needsSpc;
		const needsSp = !!(filters.programId || filters.schoolId);

		// ── JOINs ────────────────────────────────────────────────────────────
		if (needsSpc) {
			qb.leftJoin(StudyPlanCourseEntity, 'spc', 'spc.course_id = c.id');
			qb.leftJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			);
		}

		if (filters.academicPeriodId) {
			qb.andWhere('spap.academic_period_id = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		}

		if (needsSp) {
			qb.leftJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
		}

		if (filters.programId) {
			qb.andWhere('sp.program_id = :programId', { programId: filters.programId });
		}

		// ── School ──────────────────────────────────────────────────────────
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

		return await qb.getMany();
	}
}
