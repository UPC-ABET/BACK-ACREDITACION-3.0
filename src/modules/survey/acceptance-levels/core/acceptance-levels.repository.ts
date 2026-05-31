import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PerformanceLevelEntity } from '../model/acceptance-levels.entity';

@Injectable()
export class PerformanceLevelRepository extends BaseRepository<PerformanceLevelEntity> {
	constructor(
		@InjectRepository(PerformanceLevelEntity)
		repository: Repository<PerformanceLevelEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findBySurveyTypeAndPeriod(
		surveyTypeId: number,
		academicPeriodId: number,
	): Promise<PerformanceLevelEntity[]> {
		return await this.repository
			.createQueryBuilder('al')
			.where('al.survey_type_id = :surveyTypeId', { surveyTypeId })
			.andWhere('al.academic_period_id = :academicPeriodId', { academicPeriodId })
			.andWhere('al.is_active = true')
			.orderBy('al.order', 'ASC', 'NULLS LAST')
			.addOrderBy('al.min_score', 'ASC')
			.getMany();
	}

	async countBySurveyTypeAndPeriod(
		surveyTypeId: number,
		academicPeriodId: number,
	): Promise<number> {
		return await this.repository
			.createQueryBuilder('al')
			.where('al.survey_type_id = :surveyTypeId', { surveyTypeId })
			.andWhere('al.academic_period_id = :academicPeriodId', { academicPeriodId })
			.andWhere('al.is_active = true')
			.getCount();
	}

	async findSurveyTypeIdByCode(code: string): Promise<number | null> {
		const result = await this.dataSource.query(
			`SELECT id FROM core.types WHERE code = $1 AND is_active = true LIMIT 1`,
			[code],
		);
		return result?.[0]?.id ?? null;
	}
}
