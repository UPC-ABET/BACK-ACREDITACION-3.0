import { Injectable } from '@nestjs/common';
import { ReportGeneratorService } from 'src/libs/reporting/report-generator.service';
import type { ReportDocument, ReportLanguage } from 'src/libs/reporting/report.types';
import { escapeHtml, localize } from 'src/libs/reporting/report.utils';
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
	.section-title { color: #C8102E; font-weight: 700; font-size: 12pt; margin: 16px 0 6px; border-bottom: 1px solid #C8102E; padding-bottom: 2px; }
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
	.marker { vertical-align: middle; }
`;

@Injectable()
export class ArticulationReportService {
	constructor(
		private readonly mappingService: CourseOutcomeMappingService,
		private readonly reportGenerator: ReportGeneratorService,
	) {}

	async generatePdf(programCommissionId: number, lang: ReportLanguage) {
		const view = await this.mappingService.getMaintenanceView(programCommissionId);
		return this.reportGenerator.generateDocument(
			this.buildDocument(view, lang),
			this.buildFilename(view, lang),
		);
	}

	private buildFilename(view: MaintenanceView, lang: ReportLanguage): string {
		const { accreditorCode, commissionCode, academicPeriodCode } = view.header;
		return `${LABELS[lang].filePrefix}_${accreditorCode}-${commissionCode}_${academicPeriodCode}.pdf`;
	}

	private buildDocument(view: MaintenanceView, lang: ReportLanguage): ReportDocument {
		const L = LABELS[lang];
		const { header, outcomeTypes, outcomes, levels, electives } = view;

		const typeById = new Map(outcomeTypes.map((t) => [t.id, t]));
		const formationType = outcomeTypes.find((t) => t.code === FORMATION_TYPE_CODE) ?? null;
		const commissionLabel = `${header.accreditorCode}-${header.commissionCode}`;
		const colSpan = 3 + outcomes.length;

		const bodyHtml = `
				<div class="section-title">${escapeHtml(L.legend)}</div>
				${this.buildLegend(outcomeTypes, lang)}

				<div class="section-title">${escapeHtml(L.plan)}</div>
				<table>
					${this.buildMatrixHead(L, outcomes)}
					<tbody>
						${levels
							.map(
								(lvl) => `
							<tr class="level"><td colspan="${colSpan}">${escapeHtml(localize(lvl.levelName, lang))}</td></tr>
							${lvl.courses
								.map((c) => this.buildCourseRow(c, outcomes, typeById, formationType, lang))
								.join('')}`,
							)
							.join('')}
					</tbody>
				</table>

				<div class="section-title">${escapeHtml(L.electives)}</div>
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
		`;

		return {
			language: lang,
			reportName: L.reportTitle,
			programName: localize(header.programName, lang),
			metadata: [
				{ label: L.commission, value: commissionLabel },
				{ label: L.career, value: localize(header.programName, lang) },
				{ label: L.cycle, value: header.academicPeriodCode },
			],
			bodyHtml,
			orientation: 'landscape',
			additionalStyles: STYLES,
		};
	}

	private buildLegend(outcomeTypes: MaintenanceOutcomeType[], lang: ReportLanguage): string {
		const ordered = [...outcomeTypes].sort((a, b) => b.code.localeCompare(a.code));
		const rows = ordered
			.map(
				(t) =>
					`<tr><td class="legend-glyph">${glyphCell(t)}</td><td>${escapeHtml(localize(t.name, lang))}</td></tr>`,
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
					<th rowspan="2">${escapeHtml(L.colCode)}</th>
					<th rowspan="2">${escapeHtml(L.colCourse)}</th>
					<th rowspan="2">${escapeHtml(L.colCf)}</th>
					<th colspan="${outcomes.length}">${escapeHtml(L.outcomes)}</th>
				</tr>
				<tr>${outcomeCols}</tr>
			</thead>`;
	}

	private buildCourseRow(
		course: MaintenanceCourse,
		outcomes: MaintenanceOutcome[],
		typeById: Map<number, MaintenanceOutcomeType>,
		formationType: MaintenanceOutcomeType | null,
		lang: ReportLanguage,
	): string {
		const typeByOutcome = new Map(course.mappings.map((m) => [m.outcomeId, m.outcomeTypeId]));

		const cfCell = course.isTrainingCourse && formationType ? glyphCell(formationType) : '';

		const outcomeCells = outcomes
			.map((o) => {
				const typeId = typeByOutcome.get(o.outcomeId);
				const type = typeId !== undefined ? typeById.get(typeId) : undefined;
				return `<td class="mark">${type ? glyphCell(type) : ''}</td>`;
			})
			.join('');

		return `<tr>
			<td class="code">${escapeHtml(course.courseCode)}</td>
			<td class="course">${escapeHtml(localize(course.courseName, lang))}</td>
			<td class="mark">${cfCell}</td>
			${outcomeCells}
		</tr>`;
	}
}

function glyphCell(type: MaintenanceOutcomeType): string {
	if (!type.glyph) return '';
	const color = type.color ?? '#18181b';
	return markerSvg(type.glyph, color);
}

// Drawn as SVG because headless Chromium lacks fonts covering the unicode marker glyphs (◆, ✓).
function markerSvg(glyph: string, color: string): string {
	const fill = escapeHtml(color);
	if (glyph === '✓' || glyph === '✔') {
		return `<svg class="marker" viewBox="0 0 14 14" width="12" height="12"><path d="M2 7.5 L5.5 11 L12 3" stroke="${fill}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
	}
	if (glyph === '◆' || glyph === '◇' || glyph === '♦') {
		return `<svg class="marker" viewBox="0 0 14 14" width="12" height="12"><polygon points="7,1 13,7 7,13 1,7" fill="${fill}"/></svg>`;
	}
	return `<span class="glyph" style="color:${fill};">${escapeHtml(glyph)}</span>`;
}
