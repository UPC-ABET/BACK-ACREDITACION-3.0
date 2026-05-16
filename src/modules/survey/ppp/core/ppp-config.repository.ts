import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepostitory } from 'src/commons/base.repository';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';

export const PPP_SURVEY_TYPE = 'PPP';

@Injectable()
export class PppConfigRepository extends BaseRepostitory {
	constructor(
		@InjectRepository(OutcomeConfigEntity)
		repository: Repository<OutcomeConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findAllPpp(filters?: { program_id?: number; academic_period_id?: number; is_active?: boolean; is_visible?: boolean }): Promise<OutcomeConfigEntity[]> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			const qb = repository.createQueryBuilder('oc').leftJoinAndSelect('oc.outcome', 'outcome').where(`oc.extra->>'survey_type' = :type`, { type: PPP_SURVEY_TYPE });

			if (filters?.program_id !== undefined) {
				qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: filters.program_id });
			}
			if (filters?.academic_period_id !== undefined) {
				qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, { periodId: filters.academic_period_id });
			}
			if (filters?.is_active !== undefined) {
				qb.andWhere('oc.is_active = :isActive', { isActive: filters.is_active });
			}
			if (filters?.is_visible !== undefined) {
				qb.andWhere(`(oc.extra->>'is_visible')::boolean = :isVisible`, { isVisible: filters.is_visible });
			}

			qb.orderBy(`(oc.extra->>'order')::int`, 'ASC', 'NULLS LAST');

			return await qb.getMany();
		} finally {
			await queryRunner.release();
		}
	}

	async findOnePpp(id: number): Promise<OutcomeConfigEntity | null> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			return await repository
				.createQueryBuilder('oc')
				.leftJoinAndSelect('oc.outcome', 'outcome')
				.where('oc.id = :id', { id })
				.andWhere(`oc.extra->>'survey_type' = :type`, { type: PPP_SURVEY_TYPE })
				.getOne();
		} finally {
			await queryRunner.release();
		}
	}

	async existsPpp(outcome_id: number, program_id?: number, academic_period_id?: number): Promise<boolean> {
		const { repository, queryRunner } = await this.getRepository();
		try {
			const qb = repository.createQueryBuilder('oc').where('oc.outcome_id = :outcome_id', { outcome_id }).andWhere(`oc.extra->>'survey_type' = :type`, { type: PPP_SURVEY_TYPE });

			if (program_id !== undefined) {
				qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: program_id });
			}
			if (academic_period_id !== undefined) {
				qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, { periodId: academic_period_id });
			}

			const count = await qb.getCount();
			return count > 0;
		} finally {
			await queryRunner.release();
		}
	}
}
