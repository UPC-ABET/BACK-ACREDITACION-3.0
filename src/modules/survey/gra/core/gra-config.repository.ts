import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';

export const GRA_SURVEY_TYPE = 'GRA';

@Injectable()
export class GraConfigRepository extends BaseRepository<OutcomeConfigEntity> {
	constructor(
		@InjectRepository(OutcomeConfigEntity)
		repository: Repository<OutcomeConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findAllGra(filters?: {
		programId?: number;
		academicPeriodId?: number;
		commissionId?: number;
		isActive?: boolean;
		isVisible?: boolean;
	}): Promise<OutcomeConfigEntity[]> {
		const qb = this.repository
			.createQueryBuilder('oc')
			.leftJoinAndSelect('oc.outcome', 'outcome')
			.where(`oc.extra->>'surveyType' = :type`, { type: GRA_SURVEY_TYPE });

		if (filters?.programId !== undefined) {
			qb.andWhere(`(oc.extra->>'programId')::int = :programId`, { programId: filters.programId });
		}
		if (filters?.academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academicPeriodId')::int = :periodId`, {
				periodId: filters.academicPeriodId,
			});
		}
		if (filters?.commissionId !== undefined) {
			qb.andWhere(`(oc.extra->>'commissionId')::int = :commissionId`, {
				commissionId: filters.commissionId,
			});
		}
		if (filters?.isActive !== undefined) {
			qb.andWhere('oc.is_active = :isActive', { isActive: filters.isActive });
		}
		if (filters?.isVisible !== undefined) {
			qb.andWhere(`(oc.extra->>'isVisible')::boolean = :isVisible`, {
				isVisible: filters.isVisible,
			});
		}

		qb.orderBy(`(oc.extra->>'order')::int`, 'ASC', 'NULLS LAST');

		return await qb.getMany();
	}

	async findOneGra(id: number): Promise<OutcomeConfigEntity | null> {
		return await this.repository
			.createQueryBuilder('oc')
			.leftJoinAndSelect('oc.outcome', 'outcome')
			.where('oc.id = :id', { id })
			.andWhere(`oc.extra->>'surveyType' = :type`, { type: GRA_SURVEY_TYPE })
			.getOne();
	}

	async existsGra(
		outcomeId: number,
		programId?: number,
		academicPeriodId?: number,
	): Promise<boolean> {
		const qb = this.repository
			.createQueryBuilder('oc')
			.where('oc.outcome_id = :outcomeId', { outcomeId })
			.andWhere(`oc.extra->>'surveyType' = :type`, { type: GRA_SURVEY_TYPE });

		if (programId !== undefined) {
			qb.andWhere(`(oc.extra->>'programId')::int = :programId`, { programId: programId });
		}
		if (academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academicPeriodId')::int = :periodId`, {
				periodId: academicPeriodId,
			});
		}

		return (await qb.getCount()) > 0;
	}

	async findSurveyTypeIdByCode(code: string): Promise<number | null> {
		const result = await this.dataSource.query(
			`SELECT id FROM core.types WHERE code = $1 AND is_active = true LIMIT 1`,
			[code],
		);
		return result?.[0]?.id ?? null;
	}

	async findOutcomesGroupedByCommission(
		programId: number,
		academicPeriodId: number,
	): Promise<Record<string, any>[]> {
		return await this.dataSource.query(
			`SELECT
				pc.id          AS "programCommissionId",
				pc.commission_id AS "commissionId",
				c.name         AS "commissionName",
				o.id           AS "outcomeId",
				o.outcome_code AS "outcomeCode",
				o.outcome_name AS "outcomeName",
				o.outcome_description AS "outcomeDescription"
			FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			LEFT JOIN accreditation.commissions c ON c.id = pc.commission_id
			WHERE pc.program_id = $1
			  AND pc.academic_period_id = $2
			  AND o.is_active = true
			ORDER BY pc.commission_id, o.outcome_code`,
			[programId, academicPeriodId],
		);
	}
}
