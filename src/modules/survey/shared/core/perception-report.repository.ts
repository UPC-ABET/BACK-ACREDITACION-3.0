import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { I18nText } from 'src/shared/types/i18n';

export interface PerceptionScoreRow {
	outcomeId: number;
	outcomeCode: string;
	outcomeName: I18nText | string | null;
	campusId: number;
	campusName: I18nText | string | null;
	commissionId: number | null;
	commissionName: I18nText | string | null;
	score: string;
	count: number;
}

export interface PerceptionQueryFilters {
	surveyTypeId: number;
	academicPeriodId: number;
	programId?: number;
	commissionId?: number;
	campusId?: number;
	surveyNumbers?: number[];
}

export interface ConfiguredOutcomeRow {
	outcomeId: number;
	outcomeCode: string;
	outcomeName: I18nText | string | null;
	commissionId: number | null;
	commissionName: I18nText | string | null;
}

@Injectable()
export class PerceptionReportRepository {
	constructor(private readonly dataSource: DataSource) {}

	async getSurveyTypeId(code: string): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/**
	 * Per outcome and campus, the number of responses at each raw score. Callers
	 * bucket the scores into the configured acceptance levels. Scores live in a
	 * single table keyed by survey, so the survey type id alone selects PPP/GRA/LCFC.
	 */
	async getScoreRows(filters: PerceptionQueryFilters): Promise<PerceptionScoreRow[]> {
		const params: unknown[] = [filters.surveyTypeId, filters.academicPeriodId];
		const conditions = ['s.survey_type_id = $1', 's.academic_period_id = $2', 's.is_active = true'];

		if (filters.programId !== undefined) {
			params.push(filters.programId);
			conditions.push(`s.program_id = $${params.length}`);
		}
		if (filters.commissionId !== undefined) {
			params.push(filters.commissionId);
			conditions.push(`pc.commission_id = $${params.length}`);
		}
		if (filters.campusId !== undefined) {
			params.push(filters.campusId);
			conditions.push(`s.campus_id = $${params.length}`);
		}
		if (filters.surveyNumbers?.length) {
			params.push(filters.surveyNumbers);
			conditions.push(`s.survey_number = ANY($${params.length})`);
		}

		return await this.dataSource.query(
			`SELECT
				o.id              AS "outcomeId",
				o.outcome_code    AS "outcomeCode",
				o.outcome_name    AS "outcomeName",
				s.campus_id       AS "campusId",
				c.name            AS "campusName",
				pc.commission_id  AS "commissionId",
				comm.name         AS "commissionName",
				sc.score          AS "score",
				COUNT(*)::int     AS "count"
			FROM evidence.surveys s
			INNER JOIN survey.scores sc ON sc.survey_id = s.id
			INNER JOIN accreditation.outcomes o ON o.id = sc.outcome_id
			LEFT JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			LEFT JOIN accreditation.commissions comm ON comm.id = pc.commission_id
			LEFT JOIN organization.campuses c ON c.id = s.campus_id
			WHERE ${conditions.join(' AND ')}
			GROUP BY o.id, o.outcome_code, o.outcome_name, s.campus_id, c.name, pc.commission_id, comm.name, sc.score
			ORDER BY o.outcome_code, s.campus_id`,
			params,
		);
	}

	/**
	 * Every active outcome configured for a program/period (via the mass outcomes upload,
	 * accreditation.outcomes + program_commissions) — independent of whether it has any survey
	 * responses yet. The report body must be seeded from this list (not from getScoreRows, which
	 * only returns outcomes that already have at least one score) so commissions/outcomes with
	 * zero responses still show up with a zero count instead of silently disappearing.
	 */
	async getConfiguredOutcomes(
		academicPeriodId: number,
		programId?: number,
		commissionId?: number,
	): Promise<ConfiguredOutcomeRow[]> {
		const params: unknown[] = [academicPeriodId];
		const conditions = ['pc.academic_period_id = $1', 'o.is_active = true'];

		if (programId !== undefined) {
			params.push(programId);
			conditions.push(`pc.program_id = $${params.length}`);
		}
		if (commissionId !== undefined) {
			params.push(commissionId);
			conditions.push(`pc.commission_id = $${params.length}`);
		}

		return await this.dataSource.query(
			`SELECT
				o.id              AS "outcomeId",
				o.outcome_code    AS "outcomeCode",
				o.outcome_name    AS "outcomeName",
				pc.commission_id  AS "commissionId",
				comm.name         AS "commissionName"
			FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			LEFT JOIN accreditation.commissions comm ON comm.id = pc.commission_id
			WHERE ${conditions.join(' AND ')}
			ORDER BY o.outcome_code`,
			params,
		);
	}

	async getAcceptanceLevels(
		instrumentTypeId: number,
		academicPeriodId: number,
	): Promise<
		Array<{ name: I18nText | string; uniqueValue: string; minScore: string; maxScore: string }>
	> {
		return await this.dataSource.query(
			`SELECT name, unique_value AS "uniqueValue", min_score AS "minScore", max_score AS "maxScore"
			 FROM academic.performance_levels
			 WHERE instrument_type_id = $1 AND academic_period_id = $2 AND is_active = true
			 ORDER BY min_score ASC`,
			[instrumentTypeId, academicPeriodId],
		);
	}

	async getProgramName(programId: number): Promise<I18nText | string | null> {
		const rows = await this.dataSource.query(
			`SELECT name FROM academic.programs WHERE id = $1 LIMIT 1`,
			[programId],
		);
		return rows?.[0]?.name ?? null;
	}

	async getPeriodCode(academicPeriodId: number): Promise<string | null> {
		const rows = await this.dataSource.query(
			`SELECT code FROM academic.academic_periods WHERE id = $1 LIMIT 1`,
			[academicPeriodId],
		);
		return rows?.[0]?.code ?? null;
	}

	async getCommissionName(commissionId: number): Promise<I18nText | string | null> {
		const rows = await this.dataSource.query(
			`SELECT name FROM accreditation.commissions WHERE id = $1 LIMIT 1`,
			[commissionId],
		);
		return rows?.[0]?.name ?? null;
	}

	async getCommissions(
		surveyTypeId: number,
		academicPeriodId: number,
		programId?: number,
	): Promise<{ id: number; name: I18nText | string }[]> {
		const params: unknown[] = [surveyTypeId, academicPeriodId];
		const conditions = ['s.survey_type_id = $1', 's.academic_period_id = $2', 's.is_active = true'];
		if (programId !== undefined) {
			params.push(programId);
			conditions.push(`s.program_id = $${params.length}`);
		}
		return await this.dataSource.query(
			`SELECT DISTINCT pc.commission_id AS id, comm.name
			 FROM evidence.surveys s
			 INNER JOIN survey.scores sc ON sc.survey_id = s.id
			 INNER JOIN accreditation.outcomes o ON o.id = sc.outcome_id
			 INNER JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			 INNER JOIN accreditation.commissions comm ON comm.id = pc.commission_id
			 WHERE ${conditions.join(' AND ')}`,
			params,
		);
	}
}
