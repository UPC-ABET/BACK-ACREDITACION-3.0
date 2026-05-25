import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudyPlanCourseEntity } from '../model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from '../../study-plans/model/study-plans.entity';
import { FilterStudyPlanCourseDto } from '../model/study-plan-courses.dtos';

const SCHOOL_TYPE_CODE = 'TG903-T001';
const PROGRAM_TYPE_CODE = 'TG903-T002';

export class StudyPlanCourseRepository extends BaseRepository<StudyPlanCourseEntity> {
	constructor(
		@InjectRepository(StudyPlanCourseEntity)
		repository: Repository<StudyPlanCourseEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(filters: FilterStudyPlanCourseDto): Promise<StudyPlanCourseEntity[]> {
		const qb = this.dataSource
			.createQueryBuilder(StudyPlanCourseEntity, 'spc')
			.leftJoinAndSelect('spc.course', 'course');

		if (filters.is_active !== undefined)
			qb.andWhere('spc.is_active = :is_active', { is_active: filters.is_active });
		if (filters.course_id !== undefined)
			qb.andWhere('spc.course_id = :course_id', { course_id: filters.course_id });
		if (filters.is_elective !== undefined)
			qb.andWhere('spc.is_elective = :is_elective', { is_elective: filters.is_elective });
		if (filters.level_type_id !== undefined)
			qb.andWhere('spc.level_type_id = :level_type_id', { level_type_id: filters.level_type_id });
		if (filters.study_plan_academic_period_id !== undefined)
			qb.andWhere('spc.study_plan_academic_period_id = :spap_id', {
				spap_id: filters.study_plan_academic_period_id,
			});

		if (filters.academic_period_id !== undefined || filters.school_id !== undefined) {
			qb.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			);

			if (filters.academic_period_id !== undefined) {
				qb.andWhere('spap.academic_period_id = :academic_period_id', {
					academic_period_id: filters.academic_period_id,
				});
			}

			if (filters.school_id !== undefined) {
				qb.innerJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
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
						WHERE  sch.id = :school_id
					)`,
				);
				qb.setParameter('school_id', filters.school_id);
			}
		}

		if (filters.extra && typeof filters.extra === 'object') {
			for (const [key, value] of Object.entries(filters.extra)) {
				if (value === null || value === undefined) continue;
				qb.andWhere(`spc.extra->>'${key}' = :extra_${key}`, {
					[`extra_${key}`]: String(value),
				});
			}
		}

		return await qb.getMany();
	}
}
