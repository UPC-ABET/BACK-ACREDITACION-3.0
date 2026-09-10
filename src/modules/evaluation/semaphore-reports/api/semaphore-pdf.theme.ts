import { REPORT_FONT_SIZE, REPORT_THEME } from 'src/libs/reporting/report.theme';

export const SEMAPHORE_PDF_LABELS = {
	es: {
		reportTitleRC: 'Reporte de Control por Outcome',
		reportTitleRV: 'Reporte de Verificación Consolidado',
		programName: 'Programa',
		career: 'Carrera',
		commission: 'Comisión',
		academicPeriod: 'Periodo Académico',
		modality: 'Modalidad',
		accreditor: 'Acreditador',
		acceptanceLevel: 'Nivel de Aceptación',
		performanceLevel: 'Nivel de Desempeño',
		allLevels: 'Todos',
		allCampuses: 'TODAS',
		legendTitle: 'Niveles de Aceptación',
		indicatorScale: 'Interpretación de Indicadores',
		colDescription: 'Descripción',
		colTotals: 'TOTALES',
		redDetail: 'Listado de Cursos con Nivel Necesita Mejora',
		yellowDetail: 'Listado de Cursos con Nivel Esperado',
		greenDetail: 'Listado de Cursos con Nivel Sobresaliente',
		colCampus: 'Sede',
		colOutcome: 'Outcome',
		colCourse: 'Curso',
		colCode: 'Código',
		colTotalStudents: 'Total de Alumnos',
		colQuantity: 'Cantidad',
		colTotalStudentsByOutcome: 'Total Alumnos por Outcome',
		colPercentage: '%',
		totals: 'TOTALES',
		noTranslation: 'NO TIENE TRADUCCIÓN',
		axisStudentCount: 'N° de Alumnos',
		axisOutcomes: 'Outcomes',
		axisCourses: 'Cursos',
		chartTitleRC: 'Resultados por Curso',
		chartTitleRV: 'Resultados por Outcome',
	},
	en: {
		reportTitleRC: 'Control Report by Outcome',
		reportTitleRV: 'Consolidated Verification Report',
		programName: 'Program',
		career: 'Career',
		commission: 'Commission',
		academicPeriod: 'Academic Period',
		modality: 'Modality',
		accreditor: 'Accreditor',
		acceptanceLevel: 'Acceptance Level',
		performanceLevel: 'Performance Level',
		allLevels: 'All',
		allCampuses: 'ALL',
		legendTitle: 'Acceptance Levels',
		indicatorScale: 'Indicator Interpretation',
		colDescription: 'Description',
		colTotals: 'TOTALS',
		redDetail: 'List of Courses with Level Needs Improvement',
		yellowDetail: 'List of Courses with Expected Level',
		greenDetail: 'List of Courses with Outstanding Level',
		colCampus: 'Campus',
		colOutcome: 'Outcome',
		colCourse: 'Course',
		colCode: 'Code',
		colTotalStudents: 'Total Students',
		colQuantity: 'Quantity',
		colTotalStudentsByOutcome: 'Total Students by Outcome',
		colPercentage: '%',
		totals: 'TOTALS',
		noTranslation: 'NO TRANSLATION',
		axisStudentCount: 'Number of Students',
		axisOutcomes: 'Outcomes',
		axisCourses: 'Courses',
		chartTitleRC: 'Results by Course',
		chartTitleRV: 'Results by Outcome',
	},
} as const;

export const SEMAPHORE_REPORT_STYLES = `
	/* A section that holds a table can be taller than the room left on the page: forcing the
	   whole section onto the next one (the shared base rule's default) leaves the rest of the
	   current page blank. Letting the table itself break keeps rows flowing right after whatever
	   fit, while still never splitting a single row across pages. */
	section:has(table) { break-inside: auto; }
	table { break-inside: auto; }
	tr { break-inside: avoid; }
	thead { display: table-header-group; }
	/* Narrower than the header's default columns so every metadata item (campus, period,
	   modality, career, accreditor, commission, acceptance level) fits on one row. */
	.report-metadata { grid-template-columns: repeat(auto-fit, minmax(68px, 1fr)); gap: 6px; padding: 12px 16px; }
	thead th { background: ${REPORT_THEME.brandDark}; color: #fff; text-align: center; vertical-align: middle; }
	table { font-size: ${REPORT_FONT_SIZE.dense}; }
	th, td { padding: 4px 6px; }
	tbody tr.totals-row td { background: #f1f1f1; font-weight: bold; }
	.legend-line { margin: 8px 0 16px; font-size: ${REPORT_FONT_SIZE.compact}; }
	.legend-item { display: inline-flex; align-items: center; margin-right: 18px; }
	.semaphore-dot {
		display: inline-block;
		width: 14px; height: 14px;
		border-radius: 50%;
		margin-right: 6px;
		vertical-align: middle;
	}

	.indicator-scale {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		width: 100%;
		gap: 8px 24px;
	}
	.indicator-scale__item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.indicator-scale__swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		flex-shrink: 0;
	}
	.indicator-scale__name { font-size: ${REPORT_FONT_SIZE.micro}; font-weight: 400; color: #18181b; }
	.indicator-scale__range { font-size: ${REPORT_FONT_SIZE.micro}; font-weight: 400; color: #18181b; }

	td, th { text-align: left; }
	.cell-percentage { font-size: inherit; color: #52525b; white-space: nowrap; }
	.consolidated td:nth-child(3),
	.consolidated td:nth-child(4),
	.consolidated td:nth-child(5),
	.consolidated td:last-child { text-align: center; white-space: nowrap; }
	.rv-pivot td:first-child,
	.rv-pivot td:nth-child(n+3) { text-align: center; white-space: nowrap; }
	.rv-pivot tr.totals-row td:not(:first-child) { text-align: center; white-space: nowrap; }
	tbody tr.consolidated__totals td { font-weight: 700; background: #f1f1f1; text-align: center; }
`;
