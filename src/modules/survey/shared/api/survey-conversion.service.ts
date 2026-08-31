import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { evaluateFormula, extractFormulaReferences } from 'src/libs/formula.functions';
import { OutcomeConversionsRepository } from 'src/modules/accreditation/outcome-conversions/core/outcome-conversions.repository';
import type { ConversionRuleRow } from 'src/modules/accreditation/outcome-conversions/core/outcome-conversions.repository';
import {
	SurveyConversionRepository,
	type SurveyNonConvertedScoreRow,
} from '../core/survey-conversion.repository';

const CHUNK_SIZE = 200;

/** The min/max a survey type's scores are answered on — a converted score is never allowed to
 *  land outside its own survey type's scale (LCFC 1-10, PPP 1-5, GRA 1-5). */
export interface SurveyConversionScale {
	min: number;
	max: number;
}

export interface SurveyConversionResult {
	surveysProcessed: number;
	convertedRows: number;
	skippedConversions: number;
}

/**
 * Applies `accreditation.outcome_conversions` formulas to a survey type's `survey.scores` rows —
 * the same engine `LcfcConversionService` runs for LCFC, generalized for any other survey type
 * (PPP, GRA) that also scores more than one commission. LCFC keeps its own copy rather than
 * delegating here, since it already shipped and is separately tested; this is for the survey
 * types that had no conversion step at all.
 *
 * A conversion rule is never allowed to overwrite a directly-answered score: rules only ever
 * target outcomes the survey doesn't already carry a non-converted row for, and every write goes
 * through `SurveyConversionRepository.upsertConvertedScore`, which itself guards on
 * `is_converted = true`.
 */
@Injectable()
export class SurveyConversionService {
	private readonly logger = new Logger(SurveyConversionService.name);

	constructor(
		private readonly repo: SurveyConversionRepository,
		private readonly conversionsRepository: OutcomeConversionsRepository,
	) {}

	/** Applies conversions for a batch of surveys inside the given transaction manager. */
	async convertSurveys(
		surveyIds: number[],
		scale: SurveyConversionScale,
		manager: EntityManager,
	): Promise<SurveyConversionResult> {
		const result: SurveyConversionResult = {
			surveysProcessed: surveyIds.length,
			convertedRows: 0,
			skippedConversions: 0,
		};
		if (surveyIds.length === 0) return result;

		const rows = await this.repo.getNonConvertedScoresBySurvey(surveyIds, manager);
		if (rows.length === 0) return result;

		const bySurvey = this.groupBy(rows, (row) => row.surveyId);
		const commissionIds = [...new Set(rows.map((row) => row.programCommissionId))];
		const rules = await this.conversionsRepository.getActiveRulesBySources(commissionIds);
		if (rules.length === 0) return result;
		const rulesBySource = this.groupBy(rules, (rule) => rule.sourceProgramCommissionId);

		for (const [surveyId, surveyRows] of bySurvey) {
			const counts = await this.convertSurvey(surveyId, surveyRows, rulesBySource, scale, manager);
			result.convertedRows += counts.convertedRows;
			result.skippedConversions += counts.skippedConversions;
		}

		return result;
	}

	/** Re-applies conversions to every active survey of a type/period — the one-time historical
	 *  backfill, and the action staff re-run after a conversion rule changes. Chunked +
	 *  transactional so a period with thousands of surveys stays within reasonable transaction
	 *  sizes. */
	async rebuildForSurveyType(
		surveyTypeCode: string,
		academicPeriodId: number,
		scale: SurveyConversionScale,
	): Promise<SurveyConversionResult> {
		const surveyIds = await this.repo.getSurveyIdsForConversion(surveyTypeCode, academicPeriodId);
		const total: SurveyConversionResult = {
			surveysProcessed: 0,
			convertedRows: 0,
			skippedConversions: 0,
		};

		for (let index = 0; index < surveyIds.length; index += CHUNK_SIZE) {
			const chunk = surveyIds.slice(index, index + CHUNK_SIZE);
			const chunkResult = await this.repo.runInTransaction((manager) =>
				this.convertSurveys(chunk, scale, manager),
			);
			total.surveysProcessed += chunkResult.surveysProcessed;
			total.convertedRows += chunkResult.convertedRows;
			total.skippedConversions += chunkResult.skippedConversions;
		}

		return total;
	}

	private async convertSurvey(
		surveyId: number,
		surveyRows: SurveyNonConvertedScoreRow[],
		rulesBySource: Map<number, ConversionRuleRow[]>,
		scale: SurveyConversionScale,
		manager: EntityManager,
	): Promise<Pick<SurveyConversionResult, 'convertedRows' | 'skippedConversions'>> {
		const counts = { convertedRows: 0, skippedConversions: 0 };
		const nonConvertedOutcomeIds = new Set(surveyRows.map((row) => row.outcomeId));
		const scopeByCommission = this.groupBy(surveyRows, (row) => row.programCommissionId);

		for (const [programCommissionId, commissionRows] of scopeByCommission) {
			const applicableRules = rulesBySource.get(programCommissionId) ?? [];
			if (applicableRules.length === 0) continue;

			const scope: Record<string, number> = {};
			for (const row of commissionRows) scope[row.outcomeCode] = Number(row.score);

			for (const rule of applicableRules) {
				if (nonConvertedOutcomeIds.has(rule.targetOutcomeId)) continue;

				const converted = this.evaluate(rule, scope, scale);
				if (converted === null) {
					counts.skippedConversions++;
					continue;
				}

				await this.repo.upsertConvertedScore(
					surveyId,
					rule.targetOutcomeId,
					converted,
					rule.sourceProgramCommissionId,
					rule.formula,
					manager,
				);
				counts.convertedRows++;
			}
		}

		return counts;
	}

	private evaluate(
		rule: ConversionRuleRow,
		scope: Record<string, number>,
		scale: SurveyConversionScale,
	): number | null {
		const references = extractFormulaReferences(rule.formula);
		if (references.some((code) => scope[code] === undefined)) return null;

		try {
			const value = evaluateFormula(rule.formula, scope);
			const clamped = Math.min(Math.max(value, scale.min), scale.max);
			return Math.round(clamped * 100) / 100;
		} catch (error) {
			this.logger.warn(
				`Skipping outcome conversion ${rule.id} (formula "${rule.formula}"): ${
					error instanceof Error ? error.message : 'unknown error'
				}`,
			);
			return null;
		}
	}

	private groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
		const map = new Map<K, T[]>();
		for (const item of items) {
			const k = key(item);
			const bucket = map.get(k);
			if (bucket) bucket.push(item);
			else map.set(k, [item]);
		}
		return map;
	}
}
