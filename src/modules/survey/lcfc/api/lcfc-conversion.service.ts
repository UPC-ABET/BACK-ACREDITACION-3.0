import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { evaluateFormula, extractFormulaReferences } from 'src/libs/formula.functions';
import { OutcomeConversionsRepository } from 'src/modules/accreditation/outcome-conversions/core/outcome-conversions.repository';
import type { ConversionRuleRow } from 'src/modules/accreditation/outcome-conversions/core/outcome-conversions.repository';
import {
	LcfcNotificationRepository,
	type LcfcNonConvertedScoreRow,
} from '../core/lcfc-notification.repository';

/** The 1–10 scale LCFC surveys are answered on (see LcfcScoreItemDto's @Min(1)/@Max(10)) — NOT
 *  the RV pipeline's 0–20 scale. A conversion may average or weight outcomes, but it can never
 *  push a student outside this range. */
const LCFC_SCALE_MIN = 1;
const LCFC_SCALE_MAX = 10;

const CHUNK_SIZE = 200;

export interface LcfcConversionResult {
	surveysProcessed: number;
	convertedRows: number;
	skippedConversions: number;
}

/**
 * Applies `accreditation.outcome_conversions` formulas to LCFC survey scores — the same pattern
 * `RvGradeProcessingService` already uses for rubric grades, adapted to a single survey's
 * `survey.scores` rows instead of a batch of evaluation rows.
 *
 * A conversion rule is never allowed to overwrite a directly-answered score: rules only ever
 * target outcomes the survey doesn't already carry a non-converted row for, and every write goes
 * through `LcfcNotificationRepository.upsertConvertedScore`, which itself guards on
 * `is_converted = true`.
 *
 * Known gap (v1): editing or deleting a conversion rule does not retroactively touch previously
 * derived `is_converted = true` rows. Re-run `rebuildPeriod` after changing rules in
 * "Reportes de Desempeño → Conversión de Outcomes" for the change to reach historical surveys.
 */
@Injectable()
export class LcfcConversionService {
	private readonly logger = new Logger(LcfcConversionService.name);

	constructor(
		private readonly notifRepo: LcfcNotificationRepository,
		private readonly conversionsRepository: OutcomeConversionsRepository,
	) {}

	/** Applies conversions for a batch of surveys inside the given transaction manager. */
	async convertSurveys(surveyIds: number[], manager: EntityManager): Promise<LcfcConversionResult> {
		const result: LcfcConversionResult = {
			surveysProcessed: surveyIds.length,
			convertedRows: 0,
			skippedConversions: 0,
		};
		if (surveyIds.length === 0) return result;

		const rows = await this.notifRepo.getNonConvertedScoresBySurvey(surveyIds, manager);
		if (rows.length === 0) return result;

		const bySurvey = this.groupBy(rows, (row) => row.surveyId);
		const commissionIds = [...new Set(rows.map((row) => row.programCommissionId))];
		const rules = await this.conversionsRepository.getActiveRulesBySources(commissionIds);
		if (rules.length === 0) return result;
		const rulesBySource = this.groupBy(rules, (rule) => rule.sourceProgramCommissionId);

		for (const [surveyId, surveyRows] of bySurvey) {
			const counts = await this.convertSurvey(surveyId, surveyRows, rulesBySource, manager);
			result.convertedRows += counts.convertedRows;
			result.skippedConversions += counts.skippedConversions;
		}

		return result;
	}

	/** Applies every rule of every commission present in one survey's scores. A survey can show
	 *  outcomes from more than one commission at once (LCFC groups the form by commission) — the
	 *  scope stays bucketed per commission, never flattened, since outcome_codes are only unique
	 *  within a commission. */
	private async convertSurvey(
		surveyId: number,
		surveyRows: LcfcNonConvertedScoreRow[],
		rulesBySource: Map<number, ConversionRuleRow[]>,
		manager: EntityManager,
	): Promise<Pick<LcfcConversionResult, 'convertedRows' | 'skippedConversions'>> {
		const counts = { convertedRows: 0, skippedConversions: 0 };
		const nonConvertedOutcomeIds = new Set(surveyRows.map((row) => row.outcomeId));
		const scopeByCommission = this.groupBy(surveyRows, (row) => row.programCommissionId);

		for (const [programCommissionId, commissionRows] of scopeByCommission) {
			const applicableRules = rulesBySource.get(programCommissionId) ?? [];
			if (applicableRules.length === 0) continue;

			const scope: Record<string, number> = {};
			for (const row of commissionRows) scope[row.outcomeCode] = Number(row.score);

			for (const rule of applicableRules) {
				if (nonConvertedOutcomeIds.has(rule.targetOutcomeId)) continue; // never overwrite a real answer

				const converted = this.evaluate(rule, scope);
				if (converted === null) {
					counts.skippedConversions++;
					continue;
				}

				await this.notifRepo.upsertConvertedScore(
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

	/** Re-applies conversions to every CLOSED LCFC survey of a period — the one-time historical
	 *  backfill, and the action staff re-run after a conversion rule changes. Chunked +
	 *  transactional so a period with thousands of surveys stays within reasonable transaction
	 *  sizes. */
	async rebuildPeriod(academicPeriodId: number): Promise<LcfcConversionResult> {
		const surveyIds = await this.notifRepo.getClosedLcfcSurveyIdsForPeriod(academicPeriodId);
		const total: LcfcConversionResult = {
			surveysProcessed: 0,
			convertedRows: 0,
			skippedConversions: 0,
		};

		for (let index = 0; index < surveyIds.length; index += CHUNK_SIZE) {
			const chunk = surveyIds.slice(index, index + CHUNK_SIZE);
			const chunkResult = await this.notifRepo.runInTransaction((manager) =>
				this.convertSurveys(chunk, manager),
			);
			total.surveysProcessed += chunkResult.surveysProcessed;
			total.convertedRows += chunkResult.convertedRows;
			total.skippedConversions += chunkResult.skippedConversions;
		}

		return total;
	}

	/** Evaluates one rule against a scope, clamped to the LCFC scale. Returns null when the
	 *  formula references an outcome missing from the scope (a partial rubric shouldn't silently
	 *  understate the student) or when evaluation itself fails. */
	private evaluate(rule: ConversionRuleRow, scope: Record<string, number>): number | null {
		const references = extractFormulaReferences(rule.formula);
		if (references.some((code) => scope[code] === undefined)) return null;

		try {
			const value = evaluateFormula(rule.formula, scope);
			const clamped = Math.min(Math.max(value, LCFC_SCALE_MIN), LCFC_SCALE_MAX);
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
