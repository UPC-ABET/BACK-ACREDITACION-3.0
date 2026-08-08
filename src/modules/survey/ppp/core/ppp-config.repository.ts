import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';

export const PPP_SURVEY_TYPE = 'PPP';

@Injectable()
export class PppConfigRepository extends BaseRepository<OutcomeConfigEntity> {
	constructor(
		@InjectRepository(OutcomeConfigEntity)
		repository: Repository<OutcomeConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findAllPpp(filters?: {
		programId?: number;
		academicPeriodId?: number;
		isActive?: boolean;
		isVisible?: boolean;
	}): Promise<OutcomeConfigEntity[]> {
		const qb = this.repository
			.createQueryBuilder('oc')
			.leftJoinAndSelect('oc.outcome', 'outcome')
			.leftJoinAndSelect('outcome.programCommission', 'programCommission')
			.leftJoinAndSelect('programCommission.commissionType', 'commissionType')
			.where(`oc.extra->>'survey_type' = :type`, { type: PPP_SURVEY_TYPE });

		if (filters?.programId !== undefined) {
			qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: filters.programId });
		}
		if (filters?.academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, {
				periodId: filters.academicPeriodId,
			});
		}
		if (filters?.isActive !== undefined) {
			qb.andWhere('oc.is_active = :isActive', { isActive: filters.isActive });
		}
		if (filters?.isVisible !== undefined) {
			qb.andWhere(`(oc.extra->>'is_visible')::boolean = :isVisible`, {
				isVisible: filters.isVisible,
			});
		}

		qb.orderBy(`(oc.extra->>'order')::int`, 'ASC', 'NULLS LAST');

		return await qb.getMany();
	}

	async findOnePpp(id: number): Promise<OutcomeConfigEntity | null> {
		return await this.repository
			.createQueryBuilder('oc')
			.leftJoinAndSelect('oc.outcome', 'outcome')
			.leftJoinAndSelect('outcome.programCommission', 'programCommission')
			.leftJoinAndSelect('programCommission.commissionType', 'commissionType')
			.where('oc.id = :id', { id })
			.andWhere(`oc.extra->>'survey_type' = :type`, { type: PPP_SURVEY_TYPE })
			.getOne();
	}

	async findSurveyTypeIdByCode(code: string): Promise<number | null> {
		const result = await this.dataSource.query(
			`SELECT id FROM core.types WHERE code = $1 AND is_active = true LIMIT 1`,
			[code],
		);
		return result?.[0]?.id ?? null;
	}

	async existsPpp(
		outcomeId: number,
		programId?: number,
		academicPeriodId?: number,
	): Promise<boolean> {
		const qb = this.repository
			.createQueryBuilder('oc')
			.where('oc.outcome_id = :outcomeId', { outcomeId })
			.andWhere(`oc.extra->>'survey_type' = :type`, { type: PPP_SURVEY_TYPE })
			.andWhere('oc.is_active = true');

		if (programId !== undefined) {
			qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: programId });
		}
		if (academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, {
				periodId: academicPeriodId,
			});
		}

		const count = await qb.getCount();
		return count > 0;
	}

	async findExistingPpp(
		outcomeId: number,
		programId?: number,
		academicPeriodId?: number,
	): Promise<OutcomeConfigEntity | null> {
		const qb = this.repository
			.createQueryBuilder('oc')
			.where('oc.outcome_id = :outcomeId', { outcomeId })
			.andWhere(`oc.extra->>'survey_type' = :type`, { type: PPP_SURVEY_TYPE });

		// Match "no program"/"no period" explicitly (IS NULL) instead of skipping the clause —
		// otherwise a global config (programId omitted) could match, and reactivate, an unrelated
		// soft-deleted row that does belong to a specific program/period.
		if (programId !== undefined) {
			qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: programId });
		} else {
			qb.andWhere(`oc.extra->>'program_id' IS NULL`);
		}
		if (academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, {
				periodId: academicPeriodId,
			});
		} else {
			qb.andWhere(`oc.extra->>'academic_period_id' IS NULL`);
		}

		return await qb.getOne();
	}
}
