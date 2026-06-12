import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { StudyPlanEntity } from '../model/study-plans.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';

export interface StudyPlanDeleteBlockerCounts {
	academicPeriods: number;
}

export class StudyPlanRepository extends BaseRepository<StudyPlanEntity> {
	constructor(
		@InjectRepository(StudyPlanEntity)
		repository: Repository<StudyPlanEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByIdWithProgram(id: number): Promise<StudyPlanEntity | null> {
		return await this.dataSource
			.createQueryBuilder(StudyPlanEntity, 'plan')
			.innerJoinAndSelect('plan.program', 'program')
			.where('plan.id = :id', { id })
			.getOne();
	}

	async findMaintenancePage(
		modalityTypeId: number,
		programId: number | undefined,
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[StudyPlanEntity[], number]> {
		const qb = this.dataSource
			.createQueryBuilder(StudyPlanEntity, 'plan')
			.innerJoinAndSelect('plan.program', 'program')
			.where('program.modality_type_id = :modalityTypeId', { modalityTypeId });

		if (programId !== undefined) {
			qb.andWhere('plan.program_id = :programId', { programId });
		}

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.andWhere(
				`(plan.code ILIKE :term OR program.name->>'es' ILIKE :term OR program.name->>'en' ILIKE :term)`,
				{ term },
			);
		}

		return await qb
			.orderBy('program.code', 'ASC')
			.addOrderBy('plan.code', 'ASC')
			.addOrderBy('plan.id', 'ASC')
			.skip(skip)
			.take(take)
			.getManyAndCount();
	}

	async findCoursesForView(
		studyPlanId: number,
		academicPeriodId: number,
	): Promise<StudyPlanCourseEntity[]> {
		return await this.dataSource
			.createQueryBuilder(StudyPlanCourseEntity, 'spc')
			.innerJoinAndSelect('spc.course', 'course')
			.innerJoinAndSelect('spc.levelType', 'level')
			.innerJoin('spc.studyPlanAcademicPeriod', 'spap')
			.where('spap.study_plan_id = :studyPlanId', { studyPlanId })
			.andWhere('spap.academic_period_id = :academicPeriodId', { academicPeriodId })
			.orderBy('course.code', 'ASC')
			.getMany();
	}

	async findDeleteBlockerCounts(id: number): Promise<StudyPlanDeleteBlockerCounts> {
		const [row] = await this.dataSource.query(
			`SELECT (SELECT COUNT(*) FROM academic.study_plan_academic_periods WHERE study_plan_id = $1) AS "academicPeriods"`,
			[id],
		);
		return { academicPeriods: Number(row.academicPeriods) };
	}
}
