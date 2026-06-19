import { Injectable } from '@nestjs/common';
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
		byProgram: 'Encuestas por programa',
		byCourse: 'Encuestas por curso',
		program: 'Programa',
		course: 'Curso',
		section: 'Sección',
		empty: 'Sin datos',
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
		byProgram: 'Surveys by program',
		byCourse: 'Surveys by course',
		program: 'Program',
		course: 'Course',
		section: 'Section',
		empty: 'No data',
	},
} as const;

@Injectable()
export class LcfcReportService {
	constructor(
		private readonly notifService: LcfcNotificationService,
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
}

function localizeName(value: I18nText | string | undefined, lang: ReportLanguage): string {
	if (value == null) return '';
	if (typeof value === 'string') return value;
	return localize(value, lang);
}
