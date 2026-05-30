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

		if (filters.isActive !== undefined)
			qb.andWhere('spc.is_active = :isActive', { isActive: filters.isActive });
		if (filters.courseId !== undefined)
			qb.andWhere('spc.course_id = :courseId', { courseId: filters.courseId });
		if (filters.isElective !== undefined)
			qb.andWhere('spc.is_elective = :isElective', { isElective: filters.isElective });
		if (filters.levelTypeId !== undefined)
			qb.andWhere('spc.level_type_id = :levelTypeId', { levelTypeId: filters.levelTypeId });
		if (filters.studyPlanAcademicPeriodId !== undefined)
			qb.andWhere('spc.study_plan_academic_period_id = :studyPlanAcademicPeriodId', {
				studyPlanAcademicPeriodId: filters.studyPlanAcademicPeriodId,
			});

		if (filters.academicPeriodId !== undefined || filters.schoolId !== undefined) {
			qb.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			);

			if (filters.academicPeriodId !== undefined) {
				qb.andWhere('spap.academic_period_id = :academicPeriodId', {
					academicPeriodId: filters.academicPeriodId,
				});
			}

			if (filters.schoolId !== undefined) {
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
						WHERE  sch.id = :schoolId
					)`,
				);
				qb.setParameter('schoolId', filters.schoolId);
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
