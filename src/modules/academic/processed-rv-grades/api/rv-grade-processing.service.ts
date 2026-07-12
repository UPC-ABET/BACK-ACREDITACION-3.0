import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { evaluateFormula, extractFormulaReferences } from 'src/libs/formula.functions';
import { OutcomeConversionsRepository } from 'src/modules/accreditation/outcome-conversions/core/outcome-conversions.repository';
import type { ConversionRuleRow } from 'src/modules/accreditation/outcome-conversions/core/outcome-conversions.repository';
import { ProcessedRvGradeEntity } from '../model/processed-rv-grades.entity';
import {
	ProcessedRvGradesRepository,
	type RvPerformanceLevelRow,
	type RvSourceGradeRow,
} from '../core/processed-rv-grades.repository';

/** The 20-point scale RV is reported on. A conversion may average or weight outcomes, but it can
 * never lift a student above the top of the scale, so results are clamped (legacy did the same via
 * `IIF(... > NotaOutcomeMaxima, NotaOutcomeMaxima, ...)`). */
const RV_SCALE_MAX = 20;

export interface RvProcessingResult {
	evaluationsProcessed: number;
	gradedRows: number;
	convertedRows: number;
	skippedConversions: number;
}

interface ScaledGrade {
	row: RvSourceGradeRow;
	scaledGrade: number;
}

@Injectable()
export class RvGradeProcessingService {
	private readonly logger = new Logger(RvGradeProcessingService.name);

	constructor(
		private readonly processedRepository: ProcessedRvGradesRepository,
		private readonly conversionsRepository: OutcomeConversionsRepository,
	) {}

	/**
	 * Recomputes `academic.processed_rv_grades` for the given evaluations: the directly graded
	 * outcomes, plus every outcome of another commission that a conversion rule can derive from them.
	 *
	 * Called inside the grading transaction (see `EvaluationSubmissionService.persistEvaluationScores`)
	 * so the converted grades a report reads are never staler than the rubric scores they came from.
	 */
	async processEvaluations(
		evaluationIds: number[],
		manager?: EntityManager,
	): Promise<RvProcessingResult> {
		const empty: RvProcessingResult = {
			evaluationsProcessed: 0,
			gradedRows: 0,
			convertedRows: 0,
			skippedConversions: 0,
		};
		if (evaluationIds.length === 0) return empty;

		const sourceGrades = await this.processedRepository.getSourceGrades(evaluationIds, manager);
		if (sourceGrades.length === 0) {
			await this.processedRepository.replaceForEvaluations(evaluationIds, [], manager);
			return empty;
		}

		const rules = await this.loadRules(sourceGrades);
		const levelsByPeriod = await this.loadLevels(sourceGrades, manager);

		const rows: Array<Partial<ProcessedRvGradeEntity>> = [];
		const result = { ...empty };

		for (const grades of this.groupByEvaluation(sourceGrades).values()) {
			const levels = levelsByPeriod.get(grades[0].academicPeriodId) ?? [];
			const scaled = grades.map((row) => ({ row, scaledGrade: this.scale(row) }));

			const claimedOutcomeIds = new Set<number>();
			for (const entry of scaled) {
				rows.push(this.buildGradedRow(entry, levels));
				claimedOutcomeIds.add(entry.row.outcomeId);
				result.gradedRows++;
			}

			for (const converted of this.convert(scaled, rules, levels, claimedOutcomeIds, result)) {
				rows.push(converted);
				result.convertedRows++;
			}

			result.evaluationsProcessed++;
		}

		await this.processedRepository.replaceForEvaluations(evaluationIds, rows, manager);
		return result;
	}

	/** Rebuilds every evaluation of a period. Used to backfill after conversion rules change. */
	async rebuildPeriod(academicPeriodId: number): Promise<RvProcessingResult> {
		const evaluationIds =
			await this.processedRepository.getEvaluationIdsForPeriod(academicPeriodId);

		const total: RvProcessingResult = {
			evaluationsProcessed: 0,
			gradedRows: 0,
			convertedRows: 0,
			skippedConversions: 0,
		};

		const CHUNK_SIZE = 200;
		for (let index = 0; index < evaluationIds.length; index += CHUNK_SIZE) {
			const chunk = evaluationIds.slice(index, index + CHUNK_SIZE);
			const chunkResult = await this.processedRepository.runInTransaction((manager) =>
				this.processEvaluations(chunk, manager),
			);
			total.evaluationsProcessed += chunkResult.evaluationsProcessed;
			total.gradedRows += chunkResult.gradedRows;
			total.convertedRows += chunkResult.convertedRows;
			total.skippedConversions += chunkResult.skippedConversions;
		}

		return total;
	}

	private async loadRules(sourceGrades: RvSourceGradeRow[]): Promise<ConversionRuleRow[]> {
		const sourceCommissionIds = [...new Set(sourceGrades.map((row) => row.programCommissionId))];
		return this.conversionsRepository.getActiveRulesBySources(sourceCommissionIds);
	}

	private async loadLevels(
		sourceGrades: RvSourceGradeRow[],
		manager?: EntityManager,
	): Promise<Map<number, RvPerformanceLevelRow[]>> {
		const periodIds = [...new Set(sourceGrades.map((row) => row.academicPeriodId))];
		const levelsByPeriod = new Map<number, RvPerformanceLevelRow[]>();
		for (const periodId of periodIds) {
			levelsByPeriod.set(
				periodId,
				await this.processedRepository.getRvPerformanceLevels(periodId, manager),
			);
		}
		return levelsByPeriod;
	}

	private groupByEvaluation(rows: RvSourceGradeRow[]): Map<number, RvSourceGradeRow[]> {
		const grouped = new Map<number, RvSourceGradeRow[]>();
		for (const row of rows) {
			const bucket = grouped.get(row.evaluationId);
			if (bucket) bucket.push(row);
			else grouped.set(row.evaluationId, [row]);
		}
		return grouped;
	}

	/**
	 * `student_course_outcome_grades.grade` is the raw sum of the outcome's criteria scores, so it
	 * only becomes comparable to the performance levels once divided by that outcome's own maximum.
	 * Matches the `scaled_grades` CTE the semaphore SQL used to compute inline.
	 */
	private scale(row: RvSourceGradeRow): number {
		const maxOutcome = row.maxOutcome;
		const scaled =
			maxOutcome && maxOutcome > 0 ? (row.grade * RV_SCALE_MAX) / maxOutcome : row.grade;
		return this.round(Math.min(scaled, RV_SCALE_MAX));
	}

	private round(value: number): number {
		return Math.round(value * 100) / 100;
	}

	private classify(
		scaledGrade: number,
		levels: RvPerformanceLevelRow[],
	): { performanceLevelId: number | null; levelRank: number | null } {
		const level = levels.find(
			(candidate) => scaledGrade >= candidate.minScore && scaledGrade <= candidate.maxScore,
		);
		return {
			performanceLevelId: level?.id ?? null,
			levelRank: level?.levelRank ?? null,
		};
	}

	private buildGradedRow(
		entry: ScaledGrade,
		levels: RvPerformanceLevelRow[],
	): Partial<ProcessedRvGradeEntity> {
		const { row, scaledGrade } = entry;
		return {
			studentSectionEnrollmentId: row.studentSectionEnrollmentId,
			outcomeId: row.outcomeId,
			evaluationId: row.evaluationId,
			programCommissionId: row.programCommissionId,
			academicPeriodId: row.academicPeriodId,
			courseSectionId: row.courseSectionId,
			grade: row.grade,
			scaledGrade,
			maxOutcome: row.maxOutcome ?? null,
			isConverted: false,
			sourceProgramCommissionId: null,
			formula: null,
			...this.classify(scaledGrade, levels),
		};
	}

	/**
	 * Derives the target commissions' outcomes from one evaluation's graded outcome vector.
	 *
	 * A rule is skipped (not zero-filled) when the evaluation does not carry every outcome its
	 * formula references: the rubric simply did not measure those outcomes, and averaging over a
	 * missing input would understate the student rather than report nothing.
	 */
	private convert(
		scaled: ScaledGrade[],
		rules: ConversionRuleRow[],
		levels: RvPerformanceLevelRow[],
		claimedOutcomeIds: Set<number>,
		result: RvProcessingResult,
	): Array<Partial<ProcessedRvGradeEntity>> {
		if (rules.length === 0) return [];

		const scopeByCommission = new Map<number, Record<string, number>>();
		for (const { row, scaledGrade } of scaled) {
			const scope = scopeByCommission.get(row.programCommissionId) ?? {};
			scope[row.outcomeCode] = scaledGrade;
			scopeByCommission.set(row.programCommissionId, scope);
		}

		const reference = scaled[0].row;
		const converted: Array<Partial<ProcessedRvGradeEntity>> = [];

		for (const rule of rules) {
			const scope = scopeByCommission.get(rule.sourceProgramCommissionId);
			if (!scope) continue;
			if (claimedOutcomeIds.has(rule.targetOutcomeId)) continue;

			const references = extractFormulaReferences(rule.formula);
			if (references.some((code) => scope[code] === undefined)) {
				result.skippedConversions++;
				continue;
			}

			let value: number;
			try {
				value = evaluateFormula(rule.formula, scope);
			} catch (error) {
				this.logger.warn(
					`Skipping outcome conversion ${rule.id} (formula "${rule.formula}"): ${
						error instanceof Error ? error.message : 'unknown error'
					}`,
				);
				result.skippedConversions++;
				continue;
			}

			const scaledGrade = this.round(Math.min(Math.max(value, 0), RV_SCALE_MAX));
			claimedOutcomeIds.add(rule.targetOutcomeId);

			converted.push({
				studentSectionEnrollmentId: reference.studentSectionEnrollmentId,
				outcomeId: rule.targetOutcomeId,
				evaluationId: reference.evaluationId,
				programCommissionId: rule.targetProgramCommissionId,
				academicPeriodId: reference.academicPeriodId,
				courseSectionId: reference.courseSectionId,
				grade: this.round(value),
				scaledGrade,
				maxOutcome: RV_SCALE_MAX,
				isConverted: true,
				sourceProgramCommissionId: rule.sourceProgramCommissionId,
				formula: rule.formula,
				...this.classify(scaledGrade, levels),
			});
		}

		return converted;
	}
}
