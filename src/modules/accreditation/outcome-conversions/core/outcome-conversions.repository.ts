import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { OutcomeConversionEntity } from '../model/outcome-conversions.entity';

/** One conversion row resolved down to the codes the formula engine works in. */
export interface ConversionRuleRow {
	id: number;
	sourceProgramCommissionId: number;
	targetProgramCommissionId: number;
	targetOutcomeId: number;
	targetOutcomeCode: string;
	formula: string;
}

export interface OutcomeConversionListRow extends ConversionRuleRow {
	sourceCommissionCode: string;
	targetCommissionCode: string;
	isActive: boolean;
}

export interface OutcomeConversionCoverageRow {
	targetProgramCommissionId: number;
	targetCommissionCode: string;
	totalOutcomes: number;
	mappedOutcomes: number;
	missingOutcomeCodes: string[];
}

const LIST_SQL = `
	SELECT
		oc.id                              AS "id",
		oc.source_program_commission_id    AS "sourceProgramCommissionId",
		sc.code                            AS "sourceCommissionCode",
		oc.target_program_commission_id    AS "targetProgramCommissionId",
		tc.code                            AS "targetCommissionCode",
		oc.target_outcome_id               AS "targetOutcomeId",
		o.outcome_code                     AS "targetOutcomeCode",
		oc.formula                         AS "formula",
		oc.is_active                       AS "isActive"
	FROM accreditation.outcome_conversions oc
	JOIN accreditation.program_commissions spc ON spc.id = oc.source_program_commission_id
	JOIN accreditation.commissions sc ON sc.id = spc.commission_id
	JOIN accreditation.program_commissions tpc ON tpc.id = oc.target_program_commission_id
	JOIN accreditation.commissions tc ON tc.id = tpc.commission_id
	JOIN accreditation.outcomes o ON o.id = oc.target_outcome_id
	WHERE ($1::int IS NULL OR oc.source_program_commission_id = $1::int)
	  AND ($2::int IS NULL OR oc.target_program_commission_id = $2::int)
	  AND ($3::int IS NULL OR tpc.academic_period_id = $3::int)
	ORDER BY sc.code, tc.code, o.outcome_code
`;

/**
 * Active rules for one source commission, used by the grading-time conversion engine.
 * Only rules whose target outcome is still active are returned -- a retired outcome must not keep
 * receiving converted grades.
 */
const ACTIVE_RULES_BY_SOURCE_SQL = `
	SELECT
		oc.id                           AS "id",
		oc.source_program_commission_id AS "sourceProgramCommissionId",
		oc.target_program_commission_id AS "targetProgramCommissionId",
		oc.target_outcome_id            AS "targetOutcomeId",
		o.outcome_code                  AS "targetOutcomeCode",
		oc.formula                      AS "formula"
	FROM accreditation.outcome_conversions oc
	JOIN accreditation.outcomes o ON o.id = oc.target_outcome_id
	WHERE oc.source_program_commission_id = ANY($1::int[])
	  AND oc.is_active = true
	  AND o.is_active = true
	ORDER BY oc.source_program_commission_id, o.outcome_code
`;

const COVERAGE_SQL = `
	WITH target_commissions AS (
		SELECT DISTINCT oc.target_program_commission_id AS pc_id
		FROM accreditation.outcome_conversions oc
		JOIN accreditation.program_commissions tpc ON tpc.id = oc.target_program_commission_id
		WHERE oc.is_active = true
		  AND ($1::int IS NULL OR tpc.academic_period_id = $1::int)
	)
	SELECT
		tc.pc_id                                                    AS "targetProgramCommissionId",
		c.code                                                      AS "targetCommissionCode",
		COUNT(o.id)::int                                            AS "totalOutcomes",
		COUNT(oc.id)::int                                           AS "mappedOutcomes",
		COALESCE(
			ARRAY_AGG(o.outcome_code ORDER BY o.outcome_code) FILTER (WHERE oc.id IS NULL),
			ARRAY[]::varchar[]
		)                                                           AS "missingOutcomeCodes"
	FROM target_commissions tc
	JOIN accreditation.program_commissions pc ON pc.id = tc.pc_id
	JOIN accreditation.commissions c ON c.id = pc.commission_id
	JOIN accreditation.outcomes o ON o.program_commission_id = pc.id AND o.is_active = true
	LEFT JOIN accreditation.outcome_conversions oc
		ON oc.target_outcome_id = o.id AND oc.is_active = true
	GROUP BY tc.pc_id, c.code
	ORDER BY c.code
`;

@Injectable()
export class OutcomeConversionsRepository extends BaseRepository<OutcomeConversionEntity> {
	constructor(
		@InjectRepository(OutcomeConversionEntity) repository: Repository<OutcomeConversionEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async list(
		sourceProgramCommissionId: number | null,
		targetProgramCommissionId: number | null,
		academicPeriodId: number | null,
	): Promise<OutcomeConversionListRow[]> {
		return this.dataSource.query(LIST_SQL, [
			sourceProgramCommissionId,
			targetProgramCommissionId,
			academicPeriodId,
		]);
	}

	async getActiveRulesBySources(
		sourceProgramCommissionIds: number[],
	): Promise<ConversionRuleRow[]> {
		if (sourceProgramCommissionIds.length === 0) return [];
		return this.dataSource.query(ACTIVE_RULES_BY_SOURCE_SQL, [sourceProgramCommissionIds]);
	}

	async getCoverage(academicPeriodId: number | null): Promise<OutcomeConversionCoverageRow[]> {
		return this.dataSource.query(COVERAGE_SQL, [academicPeriodId]);
	}
}
