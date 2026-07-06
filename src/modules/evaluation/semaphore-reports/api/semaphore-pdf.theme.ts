export const SEMAPHORE_PDF_LABELS = {
	es: {
		reportTitleRC: 'Reporte de Control (RC)',
		reportTitleRV: 'Reporte de Verificación (RV)',
		programName: 'Programa',
		commission: 'Comisión',
		academicPeriod: 'Ciclo',
		accreditor: 'Acreditador',
		legendTitle: 'Niveles de Aceptación',
		summary: 'Resumen por Outcome',
		redDetail: 'Listado de Cursos con Nivel Necesita Mejora',
		yellowDetail: 'Listado de Cursos con Nivel Esperado',
		greenDetail: 'Listado de Cursos con Nivel Sobresaliente',
		colCampus: 'Sede',
		colOutcome: 'Outcome',
		colCourse: 'Curso',
		colCode: 'Código',
		colTotalStudents: 'Total Alumnos',
		colQuantity: 'Cantidad',
		colTotalStudentsByOutcome: 'Total Alumnos por Outcome',
		colPercentage: '%',
		noTranslation: 'NO TIENE TRADUCCIÓN',
	},
	en: {
		reportTitleRC: 'Control Report (RC)',
		reportTitleRV: 'Verification Report (RV)',
		programName: 'Program',
		commission: 'Commission',
		academicPeriod: 'Term',
		accreditor: 'Accreditor',
		legendTitle: 'Acceptance Levels',
		summary: 'Summary by Outcome',
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
		noTranslation: 'NO TRANSLATION',
	},
} as const;

export const SEMAPHORE_REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: #e30613; font-size: 12pt; margin: 0 0 10px; }
	section h4 { font-size: 11pt; margin: 10px 0 6px; }
	thead th { background: #e30613; color: #fff; text-align: left; font-size: 9pt; }
	tbody tr:nth-child(even) td { background: #fafafa; }
	.legend-line { margin: 8px 0 16px; font-size: 9pt; }
	.legend-item { display: inline-flex; align-items: center; margin-right: 18px; }
	.semaphore-dot {
		display: inline-block;
		width: 14px; height: 14px;
		border-radius: 50%;
		margin-right: 6px;
		vertical-align: middle;
	}
`;
