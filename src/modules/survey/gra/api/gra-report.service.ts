import { Injectable } from '@nestjs/common';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import type { ReportDocument, ReportLanguage } from 'src/libs/reporting/report.types';
import { escapeHtml, localize, sanitizeReportFilename } from 'src/libs/reporting/report.utils';
import type { I18nText } from 'src/shared/types/i18n';
import { GraNotificationService } from './gra-notification.service';

const GRA_REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: #e30613; font-size: 12pt; margin: 0 0 10px; }
	thead th { background: #e30613; color: #fff; text-align: left; }
	tbody tr:nth-child(even) td { background: #fafafa; }
	td.num, th.num { text-align: right; }
	tfoot td { font-weight: bold; background: #f1f1f1; }
`;

const LABELS = {
	es: {
		reportName: 'Reporte General GRA por Carrera',
		allPrograms: 'Todas las carreras',
		period: 'Periodo académico',
		career: 'Carrera',
		totalSurveys: 'Total Encuestas',
		completed: 'Completadas',
		pending: 'Pendientes',
		completionRate: 'Avance',
		totalRow: 'TOTAL',
		empty: 'Sin datos',
	},
	en: {
		reportName: 'GRA Overview Report by Program',
		allPrograms: 'All programs',
		period: 'Academic period',
		career: 'Program',
		totalSurveys: 'Total Surveys',
		completed: 'Completed',
		pending: 'Pending',
		completionRate: 'Progress',
		totalRow: 'TOTAL',
		empty: 'No data',
	},
} as const;

@Injectable()
export class GraReportService {
	constructor(
		private readonly notifService: GraNotificationService,
		private readonly reportGenerator: ReportGeneratorService,
	) {}

	/**
	 * Builds the "no filters" overview PDF: one row per career with total, completed, pending
	 * and completion %, plus a grand-total row — same format as the LCFC program summary.
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
								`<tr><td>${escapeHtml(localizeName(r.programName, lang))}</td><td class="num">${r.total}</td><td class="num">${this.formatCountWithPercent(r.completed, r.total)}</td><td class="num">${this.formatCountWithPercent(r.pending, r.total)}</td><td class="num">${this.rate(r.completed, r.total)}%</td></tr>`,
						)
						.join('')}</tbody>
					<tfoot><tr><td>${escapeHtml(L.totalRow)}</td><td class="num">${totals.total}</td><td class="num">${this.formatCountWithPercent(totals.completed, totals.total)}</td><td class="num">${this.formatCountWithPercent(totals.pending, totals.total)}</td><td class="num">${this.rate(totals.completed, totals.total)}%</td></tr></tfoot>
				</table>
			</section>`
			: `<section><p>${escapeHtml(L.empty)}</p></section>`;

		const document: ReportDocument = {
			language: lang,
			reportName: L.reportName,
			programName: L.allPrograms,
			metadata: [{ label: L.period, value: periodCode ?? String(academicPeriodId) }],
			bodyHtml,
			additionalStyles: GRA_REPORT_STYLES,
		};
		const filename = `${sanitizeReportFilename(
			`${L.reportName}_${periodCode ?? academicPeriodId}`,
		)}.pdf`;
		return this.reportGenerator.generateDocument(document, filename);
	}

	private rate(completed: number, total: number): number {
		return total > 0 ? Math.round((completed / total) * 100) : 0;
	}

	/** "count (12.50%)" — the share of this count out of the row's total. */
	private formatCountWithPercent(count: number, total: number): string {
		const percent = total > 0 ? (count / total) * 100 : 0;
		return `${count} (${percent.toFixed(2)}%)`;
	}
}

function localizeName(value: I18nText | string | undefined, lang: ReportLanguage): string {
	if (value == null) return '';
	if (typeof value === 'string') return value;
	return localize(value, lang);
}
