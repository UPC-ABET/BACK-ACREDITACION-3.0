import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { EvaluationEntity } from '../model/evaluations.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';

export class EvaluationRepository extends BaseRepository<EvaluationEntity> {
	constructor(
		@InjectRepository(EvaluationEntity)
		repository: Repository<EvaluationEntity>,
		dataSource: DataSource,
		@InjectRepository(RubricEntity)
		private readonly rubricRepo: Repository<RubricEntity>,
	) {
		super(repository, dataSource);
	}

	runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	/** Active rubrics for the study plan course tied to the given course + academic period. */
	async getActiveRubricsForCoursePeriod(
		courseId: number,
		academicPeriodId: number,
	): Promise<RubricEntity[]> {
		return await this.rubricRepo
			.createQueryBuilder('r')
			.innerJoin(StudyPlanCourseEntity, 'spc', 'spc.id = r.study_plan_course_id')
			.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			)
			.leftJoinAndSelect('r.questions', 'questions')
			.leftJoinAndSelect('questions.criterias', 'criterias')
			.where('spc.course_id = :courseId', { courseId })
			.andWhere('spap.academic_period_id = :academicPeriodId', { academicPeriodId })
			.andWhere('r.is_active = :isActive', { isActive: true })
			.getMany();
	}
}
