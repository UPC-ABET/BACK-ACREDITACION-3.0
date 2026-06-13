import { Injectable } from '@nestjs/common';
import { PdfRendererService, UPC_LOGO_DATA_URI } from 'src/libs/pdf-renderer.service';
import type { I18nText } from 'src/shared/types/i18n';
import { CourseOutcomeMappingService } from './course-outcome-mappings.service';
import type {
	MaintenanceCourse,
	MaintenanceOutcome,
	MaintenanceOutcomeType,
	MaintenanceView,
} from '../core/course-outcome-mappings.repository';

const FORMATION_TYPE_CODE = 'TG302-T003';

const LABELS = {
	es: {
		university: 'UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS',
		reportTitle: 'ARTICULACIÓN',
		commission: 'COMISIÓN',
		career: 'CARRERA',
		cycle: 'CICLO',
		legend: 'LEYENDA',
		plan: 'PLAN CURRICULAR',
		electives: 'CURSOS ELECTIVOS',
		colCode: 'CÓD.',
		colCourse: 'ASIGNATURA',
		colCf: 'CF',
		outcomes: 'STUDENT OUTCOMES',
		filePrefix: 'Articulacion',
	},
	en: {
		university: 'UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS',
		reportTitle: 'ARTICULATION',
		commission: 'COMMISSION',
		career: 'PROGRAM',
		cycle: 'TERM',
		legend: 'LEGEND',
		plan: 'CURRICULUM',
		electives: 'ELECTIVE COURSES',
		colCode: 'CODE',
		colCourse: 'COURSE',
		colCf: 'CF',
		outcomes: 'STUDENT OUTCOMES',
		filePrefix: 'Articulation',
	},
} as const;

const STYLES = `
	@page { size: A4 landscape; margin: 14mm; }
	body { font-family: -apple-system, system-ui, sans-serif; color: #18181b; font-size: 10pt; }
	header { text-align: center; }
	.logo { width: 50px; margin: 0 auto 8px; display: block; }
	.title { color: #C8102E; margin: 0; font-weight: 700; font-size: 13pt; }
	.subtitle { color: #C8102E; margin: 4px 0 0; font-weight: 700; font-size: 12pt; }
	.report-title { color: #C8102E; text-decoration: underline; font-size: 14pt; margin: 12px 0; }
	.rule { border: 0; border-top: 1px solid #C8102E; margin: 12px 0; }
	.info { margin: 6px 0; }
	.info p { margin: 2px 0; }
	.info .label { color: #C8102E; font-weight: 700; display: inline-block; min-width: 90px; }
	.section-title { color: #C8102E; font-weight: 700; font-size: 12pt; margin: 16px 0 6px; border-bottom: 1px solid #C8102E; padding-bottom: 2px; }
	table { width: 100%; border-collapse: collapse; margin-top: 4px; }
	th, td { border: 1px solid #94a3b8; padding: 3px 5px; font-size: 9pt; }
	thead th { background: #dbeafe; color: #18181b; text-align: center; font-weight: 700; }
	td.code { white-space: nowrap; font-weight: 600; }
	td.course { text-align: left; }
	td.mark { text-align: center; width: 24px; }
	tr.level td { background: #e2e8f0; font-weight: 700; text-transform: uppercase; }
	.legend-table { width: auto; }
	.legend-table td { border: 1px solid #94a3b8; }
	.legend-glyph { text-align: center; font-size: 12pt; width: 28px; }
	.glyph { font-size: 11pt; }
`;

@Injectable()
export class ArticulationReportService {
	constructor(
		private readonly mappingService: CourseOutcomeMappingService,
		private readonly pdfRenderer: PdfRendererService,
	) {}

	async generatePdf(programCommissionId: number, lang: 'es' | 'en') {
		const view = await this.mappingService.getMaintenanceView(programCommissionId);
		const html = this.buildHtml(view, lang);
		const pdf = await this.pdfRenderer.htmlToPdf(html);
		const filename = this.buildFilename(view, lang);
		return { pdf, filename };
	}

	private buildFilename(view: MaintenanceView, lang: 'es' | 'en'): string {
		const { accreditorCode, commissionCode, academicPeriodCode } = view.header;
		return `${LABELS[lang].filePrefix}_${accreditorCode}-${commissionCode}_${academicPeriodCode}.pdf`;
	}

	private buildHtml(view: MaintenanceView, lang: 'es' | 'en'): string {
		const L = LABELS[lang];
		const { header, outcomeTypes, outcomes, levels, electives } = view;

		const typeById = new Map(outcomeTypes.map((t) => [t.id, t]));
		const formationType = outcomeTypes.find((t) => t.code === FORMATION_TYPE_CODE) ?? null;

		const logoTag = UPC_LOGO_DATA_URI
			? `<img class="logo" src="${UPC_LOGO_DATA_URI}" alt="UPC" />`
			: '';

		const commissionLabel = `${esc(header.accreditorCode)}-${esc(header.commissionCode)}`;
		const colSpan = 3 + outcomes.length;

		return `
			<!doctype html>
			<html lang="${lang}">
			<head>
				<meta charset="utf-8" />
				<title>${esc(L.reportTitle)}</title>
				<style>${STYLES}</style>
			</head>
			<body>
				<header>
					${logoTag}
					<h1 class="title">${esc(L.university)}</h1>
					<h2 class="subtitle">${esc(i18n(header.programName, lang))}</h2>
				</header>

				<h2 class="report-title" style="text-align:center;">${esc(L.reportTitle)}</h2>

				<div class="info">
					<p><span class="label">${esc(L.commission)}:</span> ${commissionLabel}</p>
					<p><span class="label">${esc(L.career)}:</span> ${esc(i18n(header.programName, lang))}</p>
					<p><span class="label">${esc(L.cycle)}:</span> ${esc(header.academicPeriodCode)}</p>
				</div>

				<div class="section-title">${esc(L.legend)}</div>
				${this.buildLegend(outcomeTypes, lang)}

				<div class="section-title">${esc(L.plan)}</div>
				<table>
					${this.buildMatrixHead(L, outcomes)}
					<tbody>
						${levels
							.map(
								(lvl) => `
							<tr class="level"><td colspan="${colSpan}">${esc(i18n(lvl.levelName, lang))}</td></tr>
							${lvl.courses
								.map((c) => this.buildCourseRow(c, outcomes, typeById, formationType, lang))
								.join('')}`,
							)
							.join('')}
					</tbody>
				</table>

				<div class="section-title">${esc(L.electives)}</div>
				<table>
					${this.buildMatrixHead(L, outcomes)}
					<tbody>
						${
							electives.length > 0
								? electives
										.map((c) => this.buildCourseRow(c, outcomes, typeById, formationType, lang))
										.join('')
								: `<tr><td colspan="${colSpan}" style="text-align:center;">—</td></tr>`
						}
					</tbody>
				</table>
			</body>
			</html>
		`;
	}

	private buildLegend(outcomeTypes: MaintenanceOutcomeType[], lang: 'es' | 'en'): string {
		const ordered = [...outcomeTypes].sort((a, b) => b.code.localeCompare(a.code));
		const rows = ordered
			.map(
				(t) =>
					`<tr><td class="legend-glyph">${glyphCell(t)}</td><td>${esc(i18n(t.name, lang))}</td></tr>`,
			)
			.join('');
		return `<table class="legend-table"><tbody>${rows}</tbody></table>`;
	}

	private buildMatrixHead(
		L: (typeof LABELS)[keyof typeof LABELS],
		outcomes: MaintenanceOutcome[],
	): string {
		const outcomeCols = outcomes.map((_, index) => `<th>${index + 1}</th>`).join('');
		return `
			<thead>
				<tr>
					<th rowspan="2">${esc(L.colCode)}</th>
					<th rowspan="2">${esc(L.colCourse)}</th>
					<th rowspan="2">${esc(L.colCf)}</th>
					<th colspan="${outcomes.length}">${esc(L.outcomes)}</th>
				</tr>
				<tr>${outcomeCols}</tr>
			</thead>`;
	}

	private buildCourseRow(
		course: MaintenanceCourse,
		outcomes: MaintenanceOutcome[],
		typeById: Map<number, MaintenanceOutcomeType>,
		formationType: MaintenanceOutcomeType | null,
		lang: 'es' | 'en',
	): string {
		const typeByOutcome = new Map(course.mappings.map((m) => [m.outcomeId, m.outcomeTypeId]));

		const cfCell =
			course.isTrainingCourse && formationType ? glyphCell(formationType) : '';

		const outcomeCells = outcomes
			.map((o) => {
				const typeId = typeByOutcome.get(o.outcomeId);
				const type = typeId !== undefined ? typeById.get(typeId) : undefined;
				return `<td class="mark">${type ? glyphCell(type) : ''}</td>`;
			})
			.join('');

		return `<tr>
			<td class="code">${esc(course.courseCode)}</td>
			<td class="course">${esc(i18n(course.courseName, lang))}</td>
			<td class="mark">${cfCell}</td>
			${outcomeCells}
		</tr>`;
	}
}

function glyphCell(type: MaintenanceOutcomeType): string {
	if (!type.glyph) return '';
	const color = type.color ?? '#18181b';
	return `<span class="glyph" style="color:${esc(color)};">${esc(type.glyph)}</span>`;
}

function i18n(value: I18nText, lang: 'es' | 'en'): string {
	return value?.[lang] ?? value?.es ?? '';
}

function esc(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value).replace(/[<>&"']/g, (ch) => {
		switch (ch) {
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
			case '"':
				return '&quot;';
			case "'":
				return '&#39;';
			default:
				return ch;
		}
	});
}
