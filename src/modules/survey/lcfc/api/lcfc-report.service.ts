import { Injectable } from '@nestjs/common';
import { ReportChartService } from 'src/libs/reporting/report-chart.service';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import type { ReportDocument, ReportLanguage } from 'src/libs/reporting/report.types';
import { escapeHtml, localize, sanitizeReportFilename } from 'src/libs/reporting/report.utils';
import type { I18nText } from 'src/shared/types/i18n';
import { LcfcNotificationService } from './lcfc-notification.service';

const LCFC_REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: #e30613; font-size: 12pt; margin: 0 0 10px; }
	.summary-grid { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 6px; }
	.summary-grid .item { min-width: 110px; }
	.summary-grid .label { font-size: 9pt; color: #666; display: block; }
	.summary-grid .value { font-size: 14pt; font-weight: bold; }
	thead th { background: #e30613; color: #fff; text-align: left; }
	tbody tr:nth-child(even) td { background: #fafafa; }
	td.num, th.num { text-align: right; }
	.report-chart + table { margin-top: 8px; }
	tfoot td { font-weight: bold; background: #f1f1f1; }
`;

interface CountRow {
	programName?: I18nText | string;
	courseName?: I18nText | string;
	sectionCode?: string;
	completed: number;
	pending: number;
	total: number;
}

const LABELS = {
	es: {
		reportName: 'Reporte de Resultados LCFC',
		allPrograms: 'Todos los programas',
		period: 'Periodo académico',
		summary: 'Resumen',
		total: 'Total',
		completed: 'Completadas',
		pending: 'Pendientes',
		completionRate: 'Avance',
		surveyCount: 'Cantidad de encuestas',
		byProgram: 'Encuestas por programa',
		byCourse: 'Encuestas por curso',
		program: 'Programa',
		course: 'Curso',
		section: 'Sección',
		empty: 'Sin datos',
		summaryReportName: 'Reporte General LCFC por Carrera',
		career: 'Carrera',
		totalSurveys: 'Total Encuestas',
		totalRow: 'TOTAL',
	},
	en: {
		reportName: 'LCFC Results Report',
		allPrograms: 'All programs',
		period: 'Academic period',
		summary: 'Summary',
		total: 'Total',
		completed: 'Completed',
		pending: 'Pending',
		completionRate: 'Progress',
		surveyCount: 'Survey count',
		byProgram: 'Surveys by program',
		byCourse: 'Surveys by course',
		program: 'Program',
		course: 'Course',
		section: 'Section',
		empty: 'No data',
		summaryReportName: 'LCFC Overview Report by Program',
		career: 'Program',
		totalSurveys: 'Total Surveys',
		totalRow: 'TOTAL',
	},
} as const;

@Injectable()
export class LcfcReportService {
	constructor(
		private readonly notifService: LcfcNotificationService,
		private readonly reportChart: ReportChartService,
		private readonly reportGenerator: ReportGeneratorService,
	) {}

	/** Builds the LCFC results PDF (completion summary by program and course) for a period. */
	async generateResultsPdf(
		academicPeriodId: number,
		programId: number | undefined,
		lang: ReportLanguage,
	) {
		const dashboard = await this.notifService.getDashboard({ academicPeriodId, programId });
		const document = this.buildDocument(dashboard, academicPeriodId, programId, lang);
		const filename = this.buildFilename(dashboard, academicPeriodId, programId, lang);
		return this.reportGenerator.generateDocument(document, filename);
	}

	/**
	 * Builds the "no filters" overview PDF: one row per program (career) with total,
	 * completed, pending and completion %, plus a grand-total row. Each program counts
	 * surveys from the period matching its own modality (Regular vs EPE).
	 */
	async generateProgramSummaryPdf(academicPeriodId: number, lang: ReportLanguage) {
		const { rows, periodCode } = await this.notifService.getProgramSummary(academicPeriodId);
		const L = LABELS[lang];

		const sorted = [...rows].sort((a, b) =>
			localizeName(a.programName, lang).localeCompare(localizeName(b.programName, lang), lang),
		);
		const totals = sorted.reduce(
			(acc, row) => ({
				completed: acc.completed + row.completed,
				pending: acc.pending + row.pending,
				total: acc.total + row.total,
			}),
			{ completed: 0, pending: 0, total: 0 },
		);

		const bodyHtml = sorted.length
			? `
			<section>
				<table>
					<thead><tr>
						<th>${escapeHtml(L.career)}</th>
						<th class="num">${escapeHtml(L.totalSurveys)}</th>
						<th class="num">${escapeHtml(L.completed)}</th>
						<th class="num">${escapeHtml(L.pending)}</th>
						<th class="num">${escapeHtml(L.completionRate)}</th>
					</tr></thead>
					<tbody>${sorted
						.map(
							(r) =>
								`<tr><td>${escapeHtml(localizeName(r.programName, lang))}</td><td class="num">${r.total}</td><td class="num">${r.completed}</td><td class="num">${r.pending}</td><td class="num">${this.rate(r.completed, r.total)}%</td></tr>`,
						)
						.join('')}</tbody>
					<tfoot><tr><td>${escapeHtml(L.totalRow)}</td><td class="num">${totals.total}</td><td class="num">${totals.completed}</td><td class="num">${totals.pending}</td><td class="num">${this.rate(totals.completed, totals.total)}%</td></tr></tfoot>
				</table>
			</section>`
			: `<section><p>${escapeHtml(L.empty)}</p></section>`;

		const document: ReportDocument = {
			language: lang,
			reportName: L.summaryReportName,
			programName: L.allPrograms,
			metadata: [{ label: L.period, value: periodCode ?? String(academicPeriodId) }],
			bodyHtml,
			additionalStyles: LCFC_REPORT_STYLES,
		};
		const filename = `${sanitizeReportFilename(
			`${L.summaryReportName}_${periodCode ?? academicPeriodId}`,
		)}.pdf`;
		return this.reportGenerator.generateDocument(document, filename);
	}

	private rate(completed: number, total: number): number {
		return total > 0 ? Math.round((completed / total) * 100) : 0;
	}

	private buildFilename(
		dashboard: { byProgram?: CountRow[] },
		academicPeriodId: number,
		programId: number | undefined,
		lang: ReportLanguage,
	): string {
		const programName =
			programId && dashboard.byProgram?.length === 1
				? localizeName(dashboard.byProgram[0].programName, lang)
				: LABELS[lang].allPrograms;
		const base = `${LABELS[lang].reportName}_${academicPeriodId}_${programName}`;
		return `${sanitizeReportFilename(base)}.pdf`;
	}

	private buildDocument(
		dashboard: {
			summary?: {
				completed?: number;
				pending?: number;
				total?: number;
				completionRatePct?: number;
			};
			byProgram?: CountRow[];
			byCourse?: CountRow[];
		},
		academicPeriodId: number,
		programId: number | undefined,
		lang: ReportLanguage,
	): ReportDocument {
		const L = LABELS[lang];
		const summary = dashboard.summary ?? {};
		const byProgram = dashboard.byProgram ?? [];
		const byCourse = dashboard.byCourse ?? [];

		const programName =
			programId && byProgram.length === 1
				? localizeName(byProgram[0].programName, lang)
				: L.allPrograms;

		const summaryHtml = `
			<section>
				<h3>${escapeHtml(L.summary)}</h3>
				<div class="summary-grid">
					<div class="item"><span class="label">${escapeHtml(L.total)}</span><span class="value">${summary.total ?? 0}</span></div>
					<div class="item"><span class="label">${escapeHtml(L.completed)}</span><span class="value">${summary.completed ?? 0}</span></div>
					<div class="item"><span class="label">${escapeHtml(L.pending)}</span><span class="value">${summary.pending ?? 0}</span></div>
					<div class="item"><span class="label">${escapeHtml(L.completionRate)}</span><span class="value">${summary.completionRatePct ?? 0}%</span></div>
				</div>
			</section>`;

		const byProgramHtml = byProgram.length
			? `
			<section>
				<h3>${escapeHtml(L.byProgram)}</h3>
				${this.buildCharts(
					byProgram,
					(row) => localizeName(row.programName, lang),
					L.byProgram,
					L.surveyCount,
					L,
				)}
				<table>
					<thead><tr>
						<th>${escapeHtml(L.program)}</th>
						<th class="num">${escapeHtml(L.completed)}</th>
						<th class="num">${escapeHtml(L.pending)}</th>
						<th class="num">${escapeHtml(L.total)}</th>
						<th class="num">${escapeHtml(L.completionRate)}</th>
					</tr></thead>
					<tbody>${byProgram
						.map(
							(r) =>
								`<tr><td>${escapeHtml(localizeName(r.programName, lang))}</td><td class="num">${r.completed}</td><td class="num">${r.pending}</td><td class="num">${r.total}</td><td class="num">${this.rate(r.completed, r.total)}%</td></tr>`,
						)
						.join('')}</tbody>
				</table>
			</section>`
			: '';

		const byCourseHtml = byCourse.length
			? `
			<section>
				<h3>${escapeHtml(L.byCourse)}</h3>
				${this.buildCharts(
					byCourse,
					(row) =>
						[row.sectionCode, localizeName(row.courseName, lang)].filter(Boolean).join(' - '),
					L.byCourse,
					L.surveyCount,
					L,
				)}
				<table>
					<thead><tr>
						<th>${escapeHtml(L.course)}</th>
						<th>${escapeHtml(L.section)}</th>
						<th class="num">${escapeHtml(L.completed)}</th>
						<th class="num">${escapeHtml(L.pending)}</th>
						<th class="num">${escapeHtml(L.total)}</th>
						<th class="num">${escapeHtml(L.completionRate)}</th>
					</tr></thead>
					<tbody>${byCourse
						.map(
							(r) =>
								`<tr><td>${escapeHtml(localizeName(r.courseName, lang))}</td><td>${escapeHtml(r.sectionCode ?? '')}</td><td class="num">${r.completed}</td><td class="num">${r.pending}</td><td class="num">${r.total}</td><td class="num">${this.rate(r.completed, r.total)}%</td></tr>`,
						)
						.join('')}</tbody>
				</table>
			</section>`
			: `<section><p>${escapeHtml(L.empty)}</p></section>`;

		return {
			language: lang,
			reportName: L.reportName,
			programName,
			metadata: [{ label: L.period, value: String(academicPeriodId) }],
			bodyHtml: `${summaryHtml}${byProgramHtml}${byCourseHtml}`,
			additionalStyles: LCFC_REPORT_STYLES,
		};
	}

	private buildCharts(
		rows: CountRow[],
		category: (row: CountRow) => string,
		title: string,
		yAxisLabel: string,
		labels: (typeof LABELS)[ReportLanguage],
	): string {
		return chunk(rows, 6)
			.map((group, index, groups) =>
				this.reportChart.buildGroupedBarChart({
					title: groups.length > 1 ? `${title} (${index + 1}/${groups.length})` : title,
					categories: group.map(category),
					series: [
						{
							label: labels.completed,
							color: '#16a34a',
							values: group.map((row) => row.completed),
						},
						{
							label: labels.pending,
							color: '#e30613',
							values: group.map((row) => row.pending),
						},
					],
					yAxisLabel,
					emptyLabel: labels.empty,
				}),
			)
			.join('');
	}
}

function localizeName(value: I18nText | string | undefined, lang: ReportLanguage): string {
	if (value == null) return '';
	if (typeof value === 'string') return value;
	return localize(value, lang);
}

function chunk<T>(values: T[], size: number): T[][] {
	const groups: T[][] = [];
	for (let index = 0; index < values.length; index += size) {
		groups.push(values.slice(index, index + size));
	}
	return groups;
}
