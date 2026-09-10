import { Injectable } from '@nestjs/common';
import { ReportChartService } from 'src/libs/reporting/report-chart.service';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import { createConcurrencyLimiter } from 'src/libs/reporting/concurrency-limit';
import type { ReportDocument, ReportLanguage } from 'src/libs/reporting/report.types';
import { escapeHtml, localize, sanitizeReportFilename } from 'src/libs/reporting/report.utils';
import { BadRequestError } from 'src/commons/domain-error';
import type { I18nText } from 'src/shared/types/i18n';
import { perceptionReportValidationStrings } from './config/strings/perception-report.validation';
import { SURVEY_TABLE_STYLES } from './survey-report.theme';
import {
	PerceptionReportRepository,
	type ConfiguredOutcomeRow,
	type PerceptionScoreRow,
} from './core/perception-report.repository';
import type { GeneratedReportFile, PerceptionReportResult } from './perception-report.service';

export interface OutcomeImportanceReportRequest {
	surveyTypeCode: string;
	fileLabel: string;
	reportName: I18nText;
	academicPeriodId: number;
	programId: number;
	commissionId: number;
	/** Narrows the report to a single outcome. Omitted, every outcome of the commission is charted. */
	outcomeId?: number;
	modalityLabel?: string;
	lang: ReportLanguage;
}

/** One acceptance level of the period, as a score interval with the colour its bars take. */
interface AcceptanceBand {
	name: string;
	minScore: number;
	maxScore: number;
	color: string;
}

/** Per-outcome importance: what graduates scored it, aggregated. */
interface OutcomeImportance {
	code: string;
	/** The outcome number, as the chart axis and the table both show it. */
	label: string;
	students: number;
	minScore: number | null;
	maxScore: number | null;
	/** Most frequently given score; ties go to the lower one. */
	modeScore: number | null;
	average: number | null;
	/** Kept past aggregation so the TOTALES row can take a mode over every outcome at once. */
	countByScore: Map<number, number>;
	/** Kept for the same reason: totals re-weight by responses rather than average the averages. */
	scoreSum: number;
}

/** One PDF's worth of rows: the combined "TODAS" section, or a single sede's. */
interface CampusSection {
	campusId: number | null;
	label: string;
	rows: PerceptionScoreRow[];
}

const BAND_COLORS = ['#e30613', '#f4c20d', '#16a34a', '#2563eb', '#7c3aed'];

const REPORT_STYLES = `
	${SURVEY_TABLE_STYLES}
`;

const LABELS = {
	es: {
		chartTitle: 'Importancia por Outcome',
		outcome: 'Outcome',
		minimum: 'Mínimo',
		maximum: 'Máximo',
		mode: 'Moda',
		average: 'Promedio',
		students: 'Cantidad de alumnos',
		totals: 'TOTALES',
		period: 'Periodo',
		campus: 'Sede',
		commission: 'Comisión',
		modality: 'Modalidad de Estudio',
		allCampuses: 'TODAS',
		all: 'TODOS',
		empty: 'No hay datos para los filtros seleccionados',
	},
	en: {
		chartTitle: 'Importance by Outcome',
		outcome: 'Outcome',
		minimum: 'Minimum',
		maximum: 'Maximum',
		mode: 'Mode',
		average: 'Average',
		students: 'Students',
		totals: 'TOTALS',
		period: 'Period',
		campus: 'Campus',
		commission: 'Commission',
		modality: 'Study modality',
		allCampuses: 'ALL',
		all: 'ALL',
		empty: 'No data for the selected filters',
	},
} as const;

/**
 * "Importancia por Outcome": how highly graduates rated each outcome on average, charted as one
 * bar per outcome coloured by the acceptance band its mean falls into. Same score data and same
 * sede split as PerceptionReportService, aggregated on the mean instead of on band counts.
 */
@Injectable()
export class OutcomeImportanceReportService {
	constructor(
		private readonly repository: PerceptionReportRepository,
		private readonly reportChart: ReportChartService,
		private readonly reportGenerator: ReportGeneratorService,
	) {}

	async generate(request: OutcomeImportanceReportRequest): Promise<PerceptionReportResult> {
		const surveyTypeId = await this.repository.getSurveyTypeId(request.surveyTypeCode);
		if (!surveyTypeId) return { reports: [], zip: null };

		const [rows, bands, programName, commissionName, periodCode, configuredOutcomes] =
			await Promise.all([
				this.repository.getScoreRows({
					surveyTypeId,
					academicPeriodId: request.academicPeriodId,
					programId: request.programId,
					commissionId: request.commissionId,
					outcomeId: request.outcomeId,
				}),
				this.loadBands(surveyTypeId, request.academicPeriodId, request.lang),
				this.repository.getProgramName(request.programId),
				this.repository.getCommissionName(request.commissionId),
				this.repository.getPeriodCode(request.academicPeriodId),
				this.repository.getConfiguredOutcomes(
					request.academicPeriodId,
					request.programId,
					request.commissionId,
				),
			]);

		// An outcome filter narrows the chart to that outcome, so the seed list must be narrowed
		// with it — otherwise the other outcomes come back as empty rows.
		const seededOutcomes = request.outcomeId
			? configuredOutcomes.filter((outcome) => outcome.outcomeId === request.outcomeId)
			: configuredOutcomes;

		if (rows.length === 0 && seededOutcomes.length === 0) return { reports: [], zip: null };

		const L = LABELS[request.lang];
		const header = {
			programLabel: localizeValue(programName, request.lang) || String(request.programId),
			commissionLabel: localizeValue(commissionName, request.lang) || String(request.commissionId),
			periodCode: periodCode ?? String(request.academicPeriodId),
			modalityLabel: request.modalityLabel?.trim() || L.all,
		};

		const sections = this.buildCampusSections(rows, request.lang, L);

		// Same reasoning as the perception reports: one request fans out to a PDF per sede, and
		// firing them all at once floods the shared render gate other callers share.
		const renderLimit = await createConcurrencyLimiter(3);

		const generated = await Promise.all(
			sections.map((section) =>
				renderLimit(async () => {
					const document = this.buildDocument({
						outcomes: this.aggregate(section.rows, seededOutcomes),
						bands,
						request,
						campusLabel: section.label,
						header,
						labels: L,
					});
					const filename = this.buildFilename(request.fileLabel, section.label);
					const { pdf } = await this.reportGenerator.generateDocument(document, filename);
					return { campusId: section.campusId, campusName: section.label, filename, pdf };
				}),
			),
		);

		const reports: GeneratedReportFile[] = generated.map((file) => ({
			campusId: file.campusId,
			campusName: file.campusName,
			filename: file.filename,
			base64: file.pdf.toString('base64'),
		}));

		let zip: PerceptionReportResult['zip'] = null;
		if (generated.length > 1) {
			const archive = await this.reportGenerator.archivePdfFiles(
				generated.map((file) => ({ filename: file.filename, pdf: file.pdf })),
				`${sanitizeReportFilename(
					`Reportes_${request.fileLabel}_Importancia_Por_Outcome_${dateStamp()}`,
				)}.zip`,
			);
			zip = { filename: archive.filename, base64: archive.zip.toString('base64') };
		}

		return { reports, zip };
	}

	/**
	 * One score row per student per outcome, so a row's `count` is a headcount: summing it gives
	 * the respondents, and weighting the score by it gives the mean. Seeded from the outcomes
	 * configured for the commission so one with no responses yet still gets a row.
	 */
	private aggregate(
		rows: PerceptionScoreRow[],
		configuredOutcomes: ConfiguredOutcomeRow[],
	): OutcomeImportance[] {
		const byOutcome = new Map<number, OutcomeImportance>();

		const seed = (outcomeId: number, code: string): OutcomeImportance => {
			let entry = byOutcome.get(outcomeId);
			if (!entry) {
				entry = {
					code,
					label: outcomeLabel(code),
					students: 0,
					minScore: null,
					maxScore: null,
					modeScore: null,
					average: null,
					scoreSum: 0,
					countByScore: new Map(),
				};
				byOutcome.set(outcomeId, entry);
			}
			return entry;
		};

		for (const outcome of configuredOutcomes) {
			seed(outcome.outcomeId, outcome.outcomeCode);
		}

		for (const row of rows) {
			const entry = seed(row.outcomeId, row.outcomeCode);
			const score = Number(row.score);
			if (!Number.isFinite(score)) continue;
			entry.students += row.count;
			entry.scoreSum += score * row.count;
			// A score can arrive on several rows for one outcome (one per sede) in the combined
			// section, so the counts add up rather than overwrite.
			entry.countByScore.set(score, (entry.countByScore.get(score) ?? 0) + row.count);
			entry.minScore = entry.minScore === null ? score : Math.min(entry.minScore, score);
			entry.maxScore = entry.maxScore === null ? score : Math.max(entry.maxScore, score);
		}

		return [...byOutcome.values()]
			.map((outcome) => ({
				...outcome,
				modeScore: modeOf(outcome.countByScore),
				average: outcome.students > 0 ? outcome.scoreSum / outcome.students : null,
			}))
			.sort((a, b) => a.code.localeCompare(b.code));
	}

	/** No sede filter on this report: a combined section first, then one per sede in the data. */
	private buildCampusSections(
		rows: PerceptionScoreRow[],
		lang: ReportLanguage,
		labels: (typeof LABELS)[ReportLanguage],
	): CampusSection[] {
		const sections: CampusSection[] = [{ campusId: null, label: labels.allCampuses, rows }];

		const campusIds = [
			...new Set(
				rows
					.map((row) => row.campusId)
					.filter((id): id is number => id !== null && id !== undefined),
			),
		];
		for (const campusId of campusIds) {
			const campusRows = rows.filter((row) => row.campusId === campusId);
			sections.push({
				campusId,
				label: localizeValue(campusRows[0]?.campusName, lang) || String(campusId),
				rows: campusRows,
			});
		}

		return sections;
	}

	private buildDocument(args: {
		outcomes: OutcomeImportance[];
		bands: AcceptanceBand[];
		request: OutcomeImportanceReportRequest;
		campusLabel: string;
		header: {
			programLabel: string;
			commissionLabel: string;
			periodCode: string;
			modalityLabel: string;
		};
		labels: (typeof LABELS)[ReportLanguage];
	}): ReportDocument {
		const { outcomes, bands, request, labels: L } = args;

		const bodyHtml = outcomes.length
			? `
				${this.buildChart(outcomes, bands, L)}
				${this.buildResultsTable(outcomes, L)}
			`
			: `<section><p class="report-empty">${escapeHtml(L.empty)}</p></section>`;

		return {
			language: request.lang,
			reportName: localizeValue(request.reportName, request.lang),
			programName: args.header.programLabel,
			metadata: [
				{ label: L.period, value: args.header.periodCode },
				{ label: L.commission, value: args.header.commissionLabel },
				{ label: L.campus, value: args.campusLabel },
				{ label: L.modality, value: args.header.modalityLabel },
			],
			bodyHtml,
			additionalStyles: REPORT_STYLES,
		};
	}

	/**
	 * One bar per outcome, carrying the colour of the band its average lands in — modelled as one
	 * series per band where only the matching band holds the value, which is what
	 * `singleBarPerCategory` renders. Keeping a series per band also keeps the band legend as the
	 * chart's colour key.
	 */
	private buildChart(
		outcomes: OutcomeImportance[],
		bands: AcceptanceBand[],
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		const bandIndexes = outcomes.map((outcome) =>
			outcome.average === null ? -1 : bandIndexForScore(outcome.average, bands),
		);

		const chart = this.reportChart.buildGroupedBarChart({
			title: labels.chartTitle,
			categories: outcomes.map((outcome) => outcome.label),
			series: bands.map((band, bandIndex) => ({
				label: `${band.name} (${bandRange(band, bandIndex, bands.length)})`,
				color: band.color,
				values: outcomes.map((outcome, outcomeIndex) =>
					bandIndexes[outcomeIndex] === bandIndex ? Number(outcome.average?.toFixed(2)) : 0,
				),
			})),
			yAxisLabel: labels.average,
			xAxisLabel: labels.outcome,
			singleBarPerCategory: true,
			// Two decimals, so a bar reads the same as its row in the results table.
			valueDecimals: 2,
			emptyLabel: labels.empty,
		});
		return `<section>${chart}</section>`;
	}

	private buildResultsTable(
		outcomes: OutcomeImportance[],
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		const body = outcomes
			.map(
				(outcome) =>
					`<tr>
						<td class="num">${escapeHtml(outcome.label)}</td>
						<td class="num">${escapeHtml(formatScore(outcome.minScore))}</td>
						<td class="num">${escapeHtml(formatScore(outcome.maxScore))}</td>
						<td class="num">${escapeHtml(formatScore(outcome.modeScore))}</td>
						<td class="num">${escapeHtml(formatAverage(outcome.average))}</td>
						<td class="num">${outcome.students}</td>
					</tr>`,
			)
			.join('');

		const totals = sumImportance(outcomes);
		const totalsRow = `
			<tr class="totals-row">
				<td class="num">${escapeHtml(labels.totals)}</td>
				<td class="num">${escapeHtml(formatScore(totals.minScore))}</td>
				<td class="num">${escapeHtml(formatScore(totals.maxScore))}</td>
				<td class="num">${escapeHtml(formatScore(totals.modeScore))}</td>
				<td class="num">${escapeHtml(formatAverage(totals.average))}</td>
				<td class="num">${totals.students}</td>
			</tr>`;

		return `
			<section>
				<table>
					<thead>
						<tr>
							<th class="num">${escapeHtml(labels.outcome)}</th>
							<th class="num">${escapeHtml(labels.minimum)}</th>
							<th class="num">${escapeHtml(labels.maximum)}</th>
							<th class="num">${escapeHtml(labels.mode)}</th>
							<th class="num">${escapeHtml(labels.average)}</th>
							<th class="num">${escapeHtml(labels.students)}</th>
						</tr>
					</thead>
					<tbody>${body}${totalsRow}</tbody>
				</table>
			</section>`;
	}

	private async loadBands(
		surveyTypeId: number,
		academicPeriodId: number,
		lang: ReportLanguage,
	): Promise<AcceptanceBand[]> {
		const levels = await this.repository.getAcceptanceLevels(surveyTypeId, academicPeriodId);

		if (!levels || levels.length === 0) {
			throw new BadRequestError(perceptionReportValidationStrings.error.acceptanceLevelsMissing);
		}

		return levels
			.map((level) => ({
				name: localizeValue(level.name, lang),
				minScore: Number(level.minScore),
				maxScore: Number(level.maxScore),
			}))
			.sort((a, b) => a.minScore - b.minScore)
			.map((band, index) => ({ ...band, color: BAND_COLORS[index % BAND_COLORS.length] }));
	}

	private buildFilename(fileLabel: string, campusLabel: string): string {
		return `${sanitizeReportFilename(
			['Reporte', fileLabel, 'Importancia_Por_Outcome', campusLabel, dateStamp()].join('_'),
		)}.pdf`;
	}
}

/** Names arrive either as an i18n object or as an already-flat string, depending on the query. */
function localizeValue(value: I18nText | string | null | undefined, lang: ReportLanguage): string {
	if (value == null) return '';
	if (typeof value === 'string') return value;
	return localize(value, lang);
}

/** The trailing number of an outcome code ("EAC-SI-3" → "3") — the chart's category tick. */
function outcomeLabel(code: string): string {
	const trailingNumber = /(\d+)\s*$/.exec(code ?? '');
	return trailingNumber ? trailingNumber[1] : (code ?? '');
}

/** Lowest band whose ceiling the score reaches — a score on a boundary belongs to the band below. */
function bandIndexForScore(score: number, bands: AcceptanceBand[]): number {
	for (let index = 0; index < bands.length; index++) {
		if (score <= bands[index].maxScore) return index;
	}
	return bands.length - 1;
}

/** Same interval notation the perception reports use: lowest open at the top, highest closed. */
function bandRange(band: AcceptanceBand, index: number, bandCount: number): string {
	const from = String(band.minScore);
	const to = String(band.maxScore);
	if (index === 0) return `[ ${from} - ${to} >`;
	if (index === bandCount - 1) return `< ${from} - ${to} ]`;
	return `[ ${from} - ${to} ]`;
}

/**
 * The TOTALES row: the extremes across every outcome, the mode over their pooled responses, and a
 * mean weighted by those responses rather than the mean of the per-outcome means.
 */
function sumImportance(outcomes: OutcomeImportance[]): {
	minScore: number | null;
	maxScore: number | null;
	modeScore: number | null;
	average: number | null;
	students: number;
} {
	const countByScore = new Map<number, number>();
	let students = 0;
	let scoreSum = 0;
	let minScore: number | null = null;
	let maxScore: number | null = null;

	for (const outcome of outcomes) {
		students += outcome.students;
		scoreSum += outcome.scoreSum;
		if (outcome.minScore !== null) {
			minScore = minScore === null ? outcome.minScore : Math.min(minScore, outcome.minScore);
		}
		if (outcome.maxScore !== null) {
			maxScore = maxScore === null ? outcome.maxScore : Math.max(maxScore, outcome.maxScore);
		}
		for (const [score, count] of outcome.countByScore) {
			countByScore.set(score, (countByScore.get(score) ?? 0) + count);
		}
	}

	return {
		minScore,
		maxScore,
		modeScore: modeOf(countByScore),
		average: students > 0 ? scoreSum / students : null,
		students,
	};
}

/** The most frequent score. A tie goes to the lower score, so the column is deterministic. */
function modeOf(countByScore: Map<number, number>): number | null {
	let mode: number | null = null;
	let best = 0;
	for (const [score, count] of [...countByScore].sort(([a], [b]) => a - b)) {
		if (count > best) {
			best = count;
			mode = score;
		}
	}
	return mode;
}

function formatScore(value: number | null): string {
	return value === null ? '—' : value.toFixed(2);
}

function formatAverage(value: number | null): string {
	return value === null ? '—' : value.toFixed(2);
}

function dateStamp(): string {
	const now = new Date();
	return `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
}
