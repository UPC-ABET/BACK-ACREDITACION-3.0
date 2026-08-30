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
	},
} as const;

export const SEMAPHORE_REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	/* A section that holds a table can be taller than the room left on the page: forcing the
	   whole section onto the next one (the default above) leaves the rest of the current page
	   blank. Letting the table itself break keeps rows flowing right after whatever fit, while
	   still never splitting a single row across pages. */
	section:has(table) { break-inside: auto; }
	table { break-inside: auto; }
	tr { break-inside: avoid; }
	thead { display: table-header-group; }
	section h3 { color: #e30613; font-size: 12pt; margin: 0 0 10px; }
	section h4 { font-size: 11pt; margin: 10px 0 6px; }
	/* Narrower than the header's default columns so every metadata item (campus, period,
	   modality, career, accreditor, commission, acceptance level) fits on one row. */
	.report-metadata { grid-template-columns: repeat(auto-fit, minmax(68px, 1fr)); gap: 6px; padding: 12px 16px; }
	.report-metadata__label { font-size: 7pt; }
	.report-metadata__value { font-size: 7.5pt; }
	thead th { background: #e30613; color: #fff; text-align: left; font-size: 9pt; }
	tbody tr:nth-child(even) td { background: #fafafa; }
	tbody tr.totals-row td { background: #e5e7eb; font-weight: bold; }
	.legend-line { margin: 8px 0 16px; font-size: 9pt; }
	.legend-item { display: inline-flex; align-items: center; margin-right: 18px; }
	.semaphore-dot {
		display: inline-block;
		width: 14px; height: 14px;
		border-radius: 50%;
		margin-right: 6px;
		vertical-align: middle;
	}

	/* Horizontal 0-20 score scale: one segment per performance level, widths proportional to
	   each level's span so the bar reads as the grading scale itself, not three equal thirds. */
	.indicator-scale {
		display: flex;
		width: 100%;
		border-radius: 4px;
		overflow: hidden;
	}
	.indicator-scale__segment {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		padding: 8px 6px;
		text-align: center;
		min-width: 0;
	}
	.indicator-scale__name { font-size: 9pt; font-weight: 700; }
	.indicator-scale__range { font-size: 8.5pt; }

	.consolidated td:nth-child(3),
	.consolidated td:nth-child(4),
	.consolidated td:nth-child(5),
	.consolidated td:last-child { text-align: center; white-space: nowrap; }
	/* Selector kept at the same specificity as the zebra-striping rule above and declared after
	   it, so a totals row landing on an even stripe still reads as a totals row. */
	tbody tr.consolidated__totals td { font-weight: 700; background: #f4f4f5; text-align: center; }
	tbody tr.consolidated__totals td:first-child { text-align: right; }
`;
