import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/** One directly-answered (`is_converted = false`) score, resolved to outcome_code + source
 *  program_commission_id — the input the conversion engine needs to evaluate formulas. */
export interface SurveyNonConvertedScoreRow {
	surveyId: number;
	outcomeId: number;
	outcomeCode: string;
	programCommissionId: number;
	score: number;
}

/**
 * Generic `survey.scores` access for outcome conversion (`accreditation.outcome_conversions`),
 * shared by every survey type that supports it (LCFC has its own copy inside
 * `LcfcNotificationRepository`, kept as-is; PPP and GRA share this one).
 */
@Injectable()
export class SurveyConversionRepository {
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	async runInTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	async getNonConvertedScoresBySurvey(
		surveyIds: number[],
		manager?: EntityManager,
	): Promise<SurveyNonConvertedScoreRow[]> {
		if (surveyIds.length === 0) return [];
		const runner = manager ?? this.dataSource;
		return runner.query(
			`SELECT
				sc.survey_id             AS "surveyId",
				sc.outcome_id            AS "outcomeId",
				o.outcome_code           AS "outcomeCode",
				o.program_commission_id  AS "programCommissionId",
				sc.score                 AS "score"
			FROM survey.scores sc
			JOIN accreditation.outcomes o ON o.id = sc.outcome_id
			WHERE sc.survey_id = ANY($1) AND sc.is_active = true AND sc.is_converted = false`,
			[surveyIds],
		);
	}

	/** Ids of every active survey of a given type in a period — the scope of a conversion rebuild. */
	async getSurveyIdsForConversion(
		surveyTypeCode: string,
		academicPeriodId: number,
	): Promise<number[]> {
		const rows: { id: number }[] = await this.dataSource.query(
			`SELECT s.id
			FROM evidence.surveys s
			WHERE s.survey_type_id = (SELECT id FROM core.types WHERE code = $1)
			  AND s.academic_period_id = $2
			  AND s.is_active = true`,
			[surveyTypeCode, academicPeriodId],
		);
		return rows.map((row) => row.id);
	}

	/**
	 * Upserts one converted score, guarded so it never overwrites a direct answer: the UPDATE only
	 * ever matches a row that is itself already `is_converted = true`.
	 */
	async upsertConvertedScore(
		surveyId: number,
		outcomeId: number,
		score: number,
		sourceProgramCommissionId: number,
		formula: string,
		manager: EntityManager,
	): Promise<void> {
		const existing: { id: number }[] = await manager.query(
			`SELECT id FROM survey.scores WHERE survey_id = $1 AND outcome_id = $2 AND is_converted = true LIMIT 1`,
			[surveyId, outcomeId],
		);

		if (existing?.length > 0) {
			await manager.query(
				`UPDATE survey.scores
				 SET score = $1, source_program_commission_id = $2, formula = $3, updated_at = NOW()
				 WHERE survey_id = $4 AND outcome_id = $5 AND is_converted = true`,
				[score, sourceProgramCommissionId, formula, surveyId, outcomeId],
			);
		} else {
			await manager.query(
				`INSERT INTO survey.scores
					(survey_id, outcome_id, score, is_converted, source_program_commission_id, formula)
				 VALUES ($1, $2, $3, true, $4, $5)`,
				[surveyId, outcomeId, score, sourceProgramCommissionId, formula],
			);
		}
	}
}
