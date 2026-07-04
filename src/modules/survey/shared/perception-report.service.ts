import { Injectable } from '@nestjs/common';
import { ReportChartService } from 'src/libs/reporting/report-chart.service';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import type { ReportDocument, ReportLanguage } from 'src/libs/reporting/report.types';
import { escapeHtml, localize, sanitizeReportFilename } from 'src/libs/reporting/report.utils';
import type { I18nText } from 'src/shared/types/i18n';
import {
	PerceptionReportRepository,
	type PerceptionScoreRow,
} from './core/perception-report.repository';

export interface PerceptionReportRequest {
	surveyTypeCode: string;
	fileLabel: string;
	reportName: I18nText;
	academicPeriodId: number;
	programId?: number;
	commissionId?: number;
	campusId?: number;
	surveyNumbers?: number[];
	modalityLabel?: string;
	lang: ReportLanguage;
}

export interface GeneratedReportFile {
	campusId: number | null;
	campusName: string;
	filename: string;
	base64: string;
}

export interface PerceptionReportResult {
	reports: GeneratedReportFile[];
	zip: { filename: string; base64: string } | null;
}

interface AcceptanceBand {
	order: number;
	name: string;
	minScore: number;
	maxScore: number;
	color: string;
}

const BAND_COLORS = ['#e30613', '#f4c20d', '#16a34a', '#2563eb', '#7c3aed'];

const FALLBACK_BANDS: Array<{ order: number; name: I18nText; minScore: number; maxScore: number }> =
	[
		{
			order: 1,
			name: { es: 'Necesita mejora', en: 'Needs improvement' },
			minScore: 0,
			maxScore: 3.25,
		},
		{ order: 2, name: { es: 'Esperado', en: 'Expected' }, minScore: 3.25, maxScore: 4.25 },
		{ order: 3, name: { es: 'Sobresaliente', en: 'Outstanding' }, minScore: 4.25, maxScore: 5 },
	];

const REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: #e30613; font-size: 12pt; margin: 0 0 10px; }
	thead th { background: #3a3a3c; color: #fff; text-align: center; }
	td.num, th.num { text-align: center; }
	.band-cell { color: #fff; font-weight: 700; }
`;

const LABELS = {
	es: {
		outcome: 'Outcome',
		total: 'Total',
		modality: 'Modalidad de Estudio',
		count: 'Cantidad',
		chartTitle: 'Percepción por Outcome',
		acceptanceTitle: 'Niveles de aceptación',
		acceptanceLevel: 'Nivel de Aceptación',
		values: 'Valores',
		resultsTitle: 'Resultados por Outcome',
		period: 'Periodo',
		campus: 'Sede',
		commission: 'Comisión',
		surveyNumber: 'N° de encuesta',
		allCampuses: 'TODAS',
		allCommissions: 'TODAS',
		allPrograms: 'TODAS LAS CARRERAS',
		all: 'TODOS',
		empty: 'Sin datos para los filtros seleccionados',
		point: 'Punto',
		points: 'Puntos',
	},
	en: {
		outcome: 'Outcome',
		total: 'Total',
		modality: 'Study modality',
		count: 'Count',
		chartTitle: 'Perception by outcome',
		acceptanceTitle: 'Acceptance levels',
		acceptanceLevel: 'Acceptance level',
		values: 'Values',
		resultsTitle: 'Results by outcome',
		period: 'Period',
		campus: 'Campus',
		commission: 'Commission',
		surveyNumber: 'Survey number',
		allCampuses: 'ALL',
		allCommissions: 'ALL',
		allPrograms: 'ALL CAREERS',
		all: 'ALL',
		empty: 'No data for the selected filters',
		point: 'Point',
		points: 'Points',
	},
} as const;

@Injectable()
export class PerceptionReportService {
	constructor(
		private readonly repository: PerceptionReportRepository,
		private readonly reportChart: ReportChartService,
		private readonly reportGenerator: ReportGeneratorService,
	) {}

	async generate(request: PerceptionReportRequest): Promise<PerceptionReportResult> {
		const surveyTypeId = await this.repository.getSurveyTypeId(request.surveyTypeCode);
		if (!surveyTypeId) return { reports: [], zip: null };

		const [rows, bands, programName, periodCode, commissionName] = await Promise.all([
			this.repository.getScoreRows({
				surveyTypeId,
				academicPeriodId: request.academicPeriodId,
				programId: request.programId,
				commissionId: request.commissionId,
				campusId: request.campusId,
				surveyNumbers: request.surveyNumbers,
			}),
			this.loadBands(surveyTypeId, request.academicPeriodId, request.lang),
			request.programId ? this.repository.getProgramName(request.programId) : Promise.resolve(null),
			this.repository.getPeriodCode(request.academicPeriodId),
			request.commissionId
				? this.repository.getCommissionName(request.commissionId)
				: Promise.resolve(null),
		]);

		if (rows.length === 0) return { reports: [], zip: null };

		const L = LABELS[request.lang];
		const localizedProgram = programName
			? this.localizeValue(programName, request.lang)
			: L.allPrograms;

		const headerCommission = commissionName
			? this.localizeValue(commissionName, request.lang)
			: L.allCommissions;

		// When a campus is selected but no commission AND the data spans multiple commissions:
		// split by commission + general. Otherwise fall back to the regular campus split.
		const distinctCommissions = new Set(
			rows.map((r) => r.commissionId).filter((id): id is number => id !== null && id !== undefined),
		);
		const useCommissionSplit =
			request.campusId !== undefined &&
			request.commissionId === undefined &&
			distinctCommissions.size > 1;

		const sections = useCommissionSplit
			? this.buildCommissionSections(rows, request, L)
			: this.buildCampusSections(rows, request, L);

		// In commission-split mode the campus is fixed; grab its localised name from the rows.
		const fixedCampusLabel = useCommissionSplit
			? rows.length > 0
				? this.localizeValue(rows[0].campusName, request.lang)
				: L.allCampuses
			: undefined;

		const documents = sections.map((section) => ({
			campusId: section.campusId,
			campusName: section.label,
			document: this.buildDocument({
				rows: section.rows,
				bands,
				request,
				reportName: this.localizeValue(request.reportName, request.lang),
				programLabel: localizedProgram,
				periodCode: periodCode ?? String(request.academicPeriodId),
				campusLabel: useCommissionSplit ? (fixedCampusLabel ?? L.allCampuses) : section.label,
				commissionLabel: useCommissionSplit ? section.label : headerCommission,
				labels: L,
			}),
			filename: this.buildFilename(request.fileLabel, section.label),
		}));

		const generated = await Promise.all(
			documents.map(async (entry) => {
				const { pdf } = await this.reportGenerator.generateDocument(entry.document, entry.filename);
				return {
					campusId: entry.campusId,
					campusName: entry.campusName,
					filename: entry.filename,
					base64: pdf.toString('base64'),
					pdf,
				};
			}),
		);

		const reports: GeneratedReportFile[] = generated.map((file) => ({
			campusId: file.campusId,
			campusName: file.campusName,
			filename: file.filename,
			base64: file.base64,
		}));

		let zip: PerceptionReportResult['zip'] = null;
		if (generated.length > 1) {
			const archive = await this.reportGenerator.archivePdfFiles(
				generated.map((g) => ({ filename: g.filename, pdf: g.pdf })),
				this.buildZipFilename(request.fileLabel),
			);
			zip = { filename: archive.filename, base64: archive.zip.toString('base64') };
		}

		return { reports, zip };
	}

	private async loadBands(
		surveyTypeId: number,
		academicPeriodId: number,
		lang: ReportLanguage,
	): Promise<AcceptanceBand[]> {
		const levels = await this.repository.getAcceptanceLevels(surveyTypeId, academicPeriodId);

		const bands: AcceptanceBand[] = (levels ?? [])
			.map((level, index) => ({
				order: Number(level.uniqueValue) || index + 1,
				name: this.localizeValue(level.name, lang),
				minScore: Number(level.minScore),
				maxScore: Number(level.maxScore),
			}))
			.sort((a, b) => a.minScore - b.minScore)
			.map((band, index) => ({ ...band, color: BAND_COLORS[index % BAND_COLORS.length] }));

		if (bands.length > 0) return bands;

		return FALLBACK_BANDS.map((band, index) => ({
			order: band.order,
			name: this.localizeValue(band.name, lang),
			minScore: band.minScore,
			maxScore: band.maxScore,
			color: BAND_COLORS[index % BAND_COLORS.length],
		}));
	}

	private buildCommissionSections(
		rows: PerceptionScoreRow[],
		request: PerceptionReportRequest,
		labels: (typeof LABELS)[ReportLanguage],
	): Array<{ campusId: number | null; label: string; rows: PerceptionScoreRow[] }> {
		const campusId = request.campusId ?? null;

		// General report (all commissions) comes first
		const sections: Array<{
			campusId: number | null;
			label: string;
			rows: PerceptionScoreRow[];
		}> = [{ campusId, label: labels.allCommissions, rows }];

		const commissionIds = [
			...new Set(
				rows
					.map((row) => row.commissionId)
					.filter((id): id is number => id !== null && id !== undefined),
			),
		];

		for (const commissionId of commissionIds) {
			const commRows = rows.filter((row) => row.commissionId === commissionId);
			if (commRows.length === 0) continue;
			const commName =
				this.localizeValue(commRows[0].commissionName, request.lang) || String(commissionId);
			sections.push({ campusId, label: commName, rows: commRows });
		}

		return sections;
	}

	private buildCampusSections(
		rows: PerceptionScoreRow[],
		request: PerceptionReportRequest,
		labels: (typeof LABELS)[ReportLanguage],
	): Array<{ campusId: number | null; label: string; rows: PerceptionScoreRow[] }> {
		if (request.campusId !== undefined) {
			const label = rows.length
				? this.localizeValue(rows[0].campusName, request.lang)
				: labels.campus;
			return [{ campusId: request.campusId, label, rows }];
		}

		const campusIds = [
			...new Set(
				rows.map((row) => row.campusId).filter((id): id is number => id !== null && id !== undefined),
			),
		];
		const sections: Array<{
			campusId: number | null;
			label: string;
			rows: PerceptionScoreRow[];
		}> = [{ campusId: null, label: labels.allCampuses, rows }];

		for (const campusId of campusIds) {
			const campusRows = rows.filter((row) => row.campusId === campusId);
			sections.push({
				campusId,
				label: this.localizeValue(campusRows[0]?.campusName, request.lang),
				rows: campusRows,
			});
		}

		return sections;
	}

	private buildDocument(args: {
		rows: PerceptionScoreRow[];
		bands: AcceptanceBand[];
		request: PerceptionReportRequest;
		reportName: string;
		programLabel: string;
		periodCode: string;
		campusLabel: string;
		commissionLabel: string;
		labels: (typeof LABELS)[ReportLanguage];
	}): ReportDocument {
		const { rows, bands, request, labels: L } = args;
		const modalityLabel = request.modalityLabel?.trim() || L.all;

		const outcomes = this.aggregateOutcomes(rows, bands, request.lang);

		const bodyHtml = outcomes.length
			? `
				${this.buildChart(outcomes, bands, L)}
				${this.buildResultsTable(outcomes, bands, modalityLabel, L)}
				${this.buildAcceptanceTable(bands, L)}
			`
			: `<section><p class="report-empty">${escapeHtml(L.empty)}</p></section>`;

		return {
			language: request.lang,
			reportName: args.reportName,
			programName: args.programLabel,
			metadata: [
				{ label: L.period, value: args.periodCode },
				{ label: L.commission, value: args.commissionLabel },
				{ label: L.campus, value: args.campusLabel },
				{ label: L.modality, value: modalityLabel },
			],
			bodyHtml,
			additionalStyles: REPORT_STYLES,
		};
	}

	private aggregateOutcomes(
		rows: PerceptionScoreRow[],
		bands: AcceptanceBand[],
		lang: ReportLanguage,
	): Array<{ code: string; name: string; counts: number[]; total: number }> {
		const byOutcome = new Map<
			number,
			{ code: string; name: string; counts: number[]; total: number }
		>();

		for (const row of rows) {
			let entry = byOutcome.get(row.outcomeId);
			if (!entry) {
				entry = {
					code: row.outcomeCode,
					name: this.localizeValue(row.outcomeName, lang),
					counts: bands.map(() => 0),
					total: 0,
				};
				byOutcome.set(row.outcomeId, entry);
			}
			const bandIndex = this.bandIndexForScore(Number(row.score), bands);
			entry.counts[bandIndex] += row.count;
			entry.total += row.count;
		}

		return [...byOutcome.values()].sort((a, b) =>
			a.code.localeCompare(b.code, undefined, { numeric: true }),
		);
	}

	private bandIndexForScore(score: number, bands: AcceptanceBand[]): number {
		for (let index = 0; index < bands.length; index++) {
			if (score <= bands[index].maxScore) return index;
		}
		return bands.length - 1;
	}

	private buildChart(
		outcomes: Array<{ code: string; counts: number[] }>,
		bands: AcceptanceBand[],
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		const chart = this.reportChart.buildGroupedBarChart({
			title: labels.chartTitle,
			categories: outcomes.map((outcome) => outcome.code),
			series: bands.map((band, bandIndex) => ({
				label: band.name,
				color: band.color,
				values: outcomes.map((outcome) => outcome.counts[bandIndex]),
			})),
			yAxisLabel: labels.count,
			emptyLabel: labels.empty,
		});
		return `<section>${chart}</section>`;
	}

	private buildResultsTable(
		outcomes: Array<{ code: string; name: string; counts: number[]; total: number }>,
		bands: AcceptanceBand[],
		modalityLabel: string,
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		const head = `
			<tr>
				<th>${escapeHtml(labels.outcome)}</th>
				${bands
					.map(
						(band) =>
							`<th class="num band-cell" style="background:${escapeHtml(band.color)}">${escapeHtml(
								this.bandPointsLabel(band, labels),
							)}</th>`,
					)
					.join('')}
				<th class="num">${escapeHtml(labels.total)}</th>
				<th>${escapeHtml(labels.modality)}</th>
			</tr>`;

		const body = outcomes
			.map(
				(outcome) =>
					`<tr>
						<td class="num">${escapeHtml(outcome.code)}</td>
						${outcome.counts.map((count) => `<td class="num">${count}</td>`).join('')}
						<td class="num">${outcome.total}</td>
						<td>${escapeHtml(modalityLabel)}</td>
					</tr>`,
			)
			.join('');

		return `
			<section>
				<h3>${escapeHtml(labels.resultsTitle)}</h3>
				<table><thead>${head}</thead><tbody>${body}</tbody></table>
			</section>`;
	}

	private buildAcceptanceTable(
		bands: AcceptanceBand[],
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		const rows = bands
			.map((band, index) => {
				const isFirst = index === 0;
				const isLast = index === bands.length - 1;
				const range = isFirst
					? `[ ${formatScore(band.minScore)} - ${formatScore(band.maxScore)} >`
					: isLast
						? `< ${formatScore(band.minScore)} - ${formatScore(band.maxScore)} ]`
						: `[ ${formatScore(band.minScore)} - ${formatScore(band.maxScore)} ]`;
				return `<tr><td><span class="band-cell" style="display:inline-block;padding:1px 8px;border-radius:3px;background:${escapeHtml(
					band.color,
				)}">${escapeHtml(band.name)}</span></td><td>${escapeHtml(range)}</td></tr>`;
			})
			.join('');

		return `
			<section>
				<h3>${escapeHtml(labels.acceptanceTitle)}</h3>
				<table>
					<thead><tr><th>${escapeHtml(labels.acceptanceLevel)}</th><th>${escapeHtml(labels.values)}</th></tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</section>`;
	}

	private bandPointsLabel(band: AcceptanceBand, labels: (typeof LABELS)[ReportLanguage]): string {
		const unit = band.order === 1 ? labels.point : labels.points;
		return `${band.order} ${unit}`;
	}

	private buildFilename(surveyTypeCode: string, campusLabel: string): string {
		const base = `Reporte_${surveyTypeCode}_Percepcion_Por_Outcome_${campusLabel}_${dateStamp()}`;
		return `${sanitizeReportFilename(base)}.pdf`;
	}

	private buildZipFilename(surveyTypeCode: string): string {
		const base = `Reportes_${surveyTypeCode}_Percepcion_Por_Outcome_${dateStamp()}`;
		return `${sanitizeReportFilename(base)}.zip`;
	}

	private localizeValue(value: I18nText | string | null | undefined, lang: ReportLanguage): string {
		if (value == null) return '';
		if (typeof value === 'string') return value;
		return localize(value, lang);
	}
}

function formatScore(value: number): string {
	return String(value);
}

function dateStamp(): string {
	const now = new Date();
	return `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
}
