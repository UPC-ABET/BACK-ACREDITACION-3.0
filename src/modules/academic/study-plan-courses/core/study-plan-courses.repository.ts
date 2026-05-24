import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudyPlanCourseEntity } from '../model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { FilterStudyPlanCourseDto } from '../model/study-plan-courses.dtos';

export class StudyPlanCourseRepository extends BaseRepository {
	constructor(
		@InjectRepository(StudyPlanCourseEntity)
		repository: Repository<StudyPlanCourseEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(filters: FilterStudyPlanCourseDto): Promise<StudyPlanCourseEntity[]> {
		const qb = this.dataSource.createQueryBuilder(StudyPlanCourseEntity, 'spc');

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

		if (filters.academic_period_id !== undefined) {
			qb.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			).andWhere('spap.academic_period_id = :academic_period_id', {
				academic_period_id: filters.academic_period_id,
			});
		}

		return await qb.getMany();
	}
}
