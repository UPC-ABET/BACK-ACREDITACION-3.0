import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { CourseEntity } from '../model/courses.entity';
import { FilterCourseDto } from '../model/courses.dtos';
import { StudyPlanCourseEntity } from '../../study-plan-courses/model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { StudyPlanEntity } from '../../study-plans/model/study-plans.entity';

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

		if (filters.code) qb.andWhere('c.code = :code', { code: filters.code });
		if (filters.isActive !== undefined)
			qb.andWhere('c.is_active = :isActive', { isActive: filters.isActive });

		const needsJoins = !!(filters.academicPeriodId || filters.programId);

		if (needsJoins) {
			qb.innerJoin(StudyPlanCourseEntity, 'spc', 'spc.course_id = c.id');
			qb.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			);
			qb.innerJoin(StudyPlanEntity, 'sp', 'sp.id = spap.study_plan_id');
		}

		if (filters.academicPeriodId) {
			qb.andWhere('spap.academic_period_id = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		}

		if (filters.programId) {
			qb.andWhere('sp.program_id = :programId', { programId: filters.programId });
		}

		return await qb.getMany();
	}

	async findLookupPage(
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[CourseEntity[], number]> {
		const qb = this.dataSource.createQueryBuilder(CourseEntity, 'c');

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.where(`(c.code ILIKE :term OR c.name->>'es' ILIKE :term OR c.name->>'en' ILIKE :term)`, {
				term,
			});
		}

		return await qb.orderBy('c.code', 'ASC').skip(skip).take(take).getManyAndCount();
	}
}
