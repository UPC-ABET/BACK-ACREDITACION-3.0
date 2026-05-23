import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { AcceptanceLevelEntity } from '../model/acceptance-levels.entity';

@Injectable()
export class AcceptanceLevelRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(AcceptanceLevelEntity)
		repository: Repository<AcceptanceLevelEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findBySurveyTypeAndPeriod(survey_type_id: number, academic_period_id: number): Promise<AcceptanceLevelEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository
				.createQueryBuilder('al')
				.where('al.survey_type_id = :survey_type_id', { survey_type_id })
				.andWhere('al.academic_period_id = :academic_period_id', { academic_period_id })
				.andWhere('al.is_active = true')
				.orderBy('al.order', 'ASC', 'NULLS LAST')
				.addOrderBy('al.min_score', 'ASC')
				.getMany();
		} finally {
			await queryRunner.release();
		}
	}

	async countBySurveyTypeAndPeriod(survey_type_id: number, academic_period_id: number): Promise<number> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository
				.createQueryBuilder('al')
				.where('al.survey_type_id = :survey_type_id', { survey_type_id })
				.andWhere('al.academic_period_id = :academic_period_id', { academic_period_id })
				.andWhere('al.is_active = true')
				.getCount();
		} finally {
			await queryRunner.release();
		}
	}

	async findSurveyTypeIdByCode(code: string): Promise<number | null> {
		const { queryRunner } = await this.getRepository();
		try {
			const result = await queryRunner.manager.query(`SELECT id FROM core.types WHERE code = $1 AND is_active = true LIMIT 1`, [code]);
			return result?.[0]?.id ?? null;
		} finally {
			await queryRunner.release();
		}
	}
}
