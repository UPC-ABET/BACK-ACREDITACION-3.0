import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { OutcomeConfigEntity } from 'src/modules/survey/outcome-configs/model/outcome-configs.entity';
import type { I18nText } from 'src/shared/types/i18n';

export const GRA_SURVEY_TYPE = 'GRA';

export interface GraOutcomeRow {
	programCommissionId: number;
	commissionId: number;
	commissionName: I18nText;
	commissionTypeCode: string;
	outcomeId: number;
	outcomeCode: string;
	outcomeName: I18nText;
	outcomeDescription: I18nText;
}

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
			.leftJoinAndSelect('outcome.programCommission', 'programCommission')
			.leftJoinAndSelect('programCommission.commissionType', 'commissionType')
			.where(`oc.extra->>'survey_type' = :type`, { type: GRA_SURVEY_TYPE });

		if (filters?.programId !== undefined) {
			qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: filters.programId });
		}
		if (filters?.academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, {
				periodId: filters.academicPeriodId,
			});
		}
		if (filters?.commissionId !== undefined) {
			qb.andWhere(`(oc.extra->>'commission_id')::int = :commissionId`, {
				commissionId: filters.commissionId,
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

	async findOneGra(id: number): Promise<OutcomeConfigEntity | null> {
		return await this.repository
			.createQueryBuilder('oc')
			.leftJoinAndSelect('oc.outcome', 'outcome')
			.leftJoinAndSelect('outcome.programCommission', 'programCommission')
			.leftJoinAndSelect('programCommission.commissionType', 'commissionType')
			.where('oc.id = :id', { id })
			.andWhere(`oc.extra->>'survey_type' = :type`, { type: GRA_SURVEY_TYPE })
			.getOne();
	}

	async existsGra(
		outcomeId: number,
		programId?: number,
		academicPeriodId?: number,
		excludeId?: number,
	): Promise<boolean> {
		const qb = this.repository
			.createQueryBuilder('oc')
			.where('oc.outcome_id = :outcomeId', { outcomeId })
			.andWhere(`oc.extra->>'survey_type' = :type`, { type: GRA_SURVEY_TYPE })
			.andWhere('oc.is_active = true');

		if (programId !== undefined) {
			qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: programId });
		}
		if (academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, {
				periodId: academicPeriodId,
			});
		}
		if (excludeId !== undefined) {
			qb.andWhere('oc.id != :excludeId', { excludeId });
		}

		return (await qb.getCount()) > 0;
	}

	async findExistingGra(
		outcomeId: number,
		programId?: number,
		academicPeriodId?: number,
	): Promise<OutcomeConfigEntity | null> {
		const qb = this.repository
			.createQueryBuilder('oc')
			.where('oc.outcome_id = :outcomeId', { outcomeId })
			.andWhere(`oc.extra->>'survey_type' = :type`, { type: GRA_SURVEY_TYPE });

		if (programId !== undefined) {
			qb.andWhere(`(oc.extra->>'program_id')::int = :programId`, { programId: programId });
		}
		if (academicPeriodId !== undefined) {
			qb.andWhere(`(oc.extra->>'academic_period_id')::int = :periodId`, {
				periodId: academicPeriodId,
			});
		}

		return await qb.getOne();
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
	): Promise<GraOutcomeRow[]> {
		return await this.dataSource.query(
			`SELECT
				pc.id          AS "programCommissionId",
				pc.commission_id AS "commissionId",
				c.name         AS "commissionName",
				ct.code        AS "commissionTypeCode",
				o.id           AS "outcomeId",
				o.outcome_code AS "outcomeCode",
				o.outcome_name AS "outcomeName",
				o.outcome_description AS "outcomeDescription"
			FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			LEFT JOIN accreditation.commissions c ON c.id = pc.commission_id
			LEFT JOIN core.types ct ON ct.id = pc.commission_type_id
			WHERE pc.program_id = $1
			  AND pc.academic_period_id = $2
			  AND o.is_active = true
			ORDER BY pc.commission_id, o.outcome_code`,
			[programId, academicPeriodId],
		);
	}
}
