export const SEMAPHORE_PDF_LABELS = {
	es: {
		reportTitleRC: 'Reporte de Control (RC)',
		reportTitleRV: 'Reporte de Verificación (RV)',
		programName: 'Programa',
		career: 'Carrera',
		commission: 'Comisión',
		academicPeriod: 'Periodo Académico',
		accreditor: 'Acreditador',
		acceptanceLevel: 'Nivel de Aceptación',
		allLevels: 'Todos',
		allCampuses: 'TODAS',
		legendTitle: 'Niveles de Aceptación',
		indicatorScale: 'Interpretación de Indicadores',
		summary: 'Resumen por Outcome',
		colDescription: 'Descripción',
		colTotals: 'TOTALES',
		consolidatedDetail: 'Detalle de Cursos por Outcome',
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
	},
	en: {
		reportTitleRC: 'Control Report (RC)',
		reportTitleRV: 'Verification Report (RV)',
		programName: 'Program',
		career: 'Career',
		commission: 'Commission',
		academicPeriod: 'Academic Period',
		accreditor: 'Accreditor',
		acceptanceLevel: 'Acceptance Level',
		allLevels: 'All',
		allCampuses: 'ALL',
		legendTitle: 'Acceptance Levels',
		indicatorScale: 'Indicator Interpretation',
		summary: 'Summary by Outcome',
		colDescription: 'Description',
		colTotals: 'TOTALS',
		consolidatedDetail: 'Course Detail by Outcome',
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
	},
} as const;

export const SEMAPHORE_REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: #e30613; font-size: 12pt; margin: 0 0 10px; }
	section h4 { font-size: 11pt; margin: 10px 0 6px; }
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

	.consolidated td:nth-child(4),
	.consolidated td:nth-child(5),
	.consolidated td:nth-child(6),
	.consolidated td:last-child { text-align: center; white-space: nowrap; }
	/* Selector kept at the same specificity as the zebra-striping rule above and declared after
	   it, so a totals row landing on an even stripe still reads as a totals row. */
	tbody tr.consolidated__totals td { font-weight: 700; background: #f4f4f5; text-align: center; }
	tbody tr.consolidated__totals td:first-child { text-align: right; }
`;
