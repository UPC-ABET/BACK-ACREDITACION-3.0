export const SEMAPHORE_PDF_LABELS = {
	es: {
		reportTitleRC: 'Reporte Semáforo — Control (RC)',
		reportTitleRV: 'Reporte Semáforo — Verificación (RV)',
		programName: 'Programa',
		commission: 'Comisión',
		academicPeriod: 'Ciclo',
		accreditor: 'Acreditador',
		summary: 'Resumen por Curso / Outcome',
		green: 'Verde',
		yellow: 'Amarillo',
		red: 'Rojo',
		redDetail: 'Cursos en Rojo',
		yellowDetail: 'Cursos en Amarillo',
		greenDetail: 'Cursos en Verde',
		colCourse: 'Curso',
		colOutcome: 'Outcome',
		colTotal: 'Total',
		colAchieved: 'Logrados',
		colPercentage: '%',
		colSede: 'Sede',
		colColor: 'Semáforo',
	},
	en: {
		reportTitleRC: 'Semaphore Report — Control (RC)',
		reportTitleRV: 'Semaphore Report — Verification (RV)',
		programName: 'Program',
		commission: 'Commission',
		academicPeriod: 'Term',
		accreditor: 'Accreditor',
		summary: 'Summary by Course / Outcome',
		green: 'Green',
		yellow: 'Yellow',
		red: 'Red',
		redDetail: 'Courses in Red',
		yellowDetail: 'Courses in Yellow',
		greenDetail: 'Courses in Green',
		colCourse: 'Course',
		colOutcome: 'Outcome',
		colTotal: 'Total',
		colAchieved: 'Achieved',
		colPercentage: '%',
		colSede: 'Campus',
		colColor: 'Status',
	},
} as const;

export const SEMAPHORE_REPORT_STYLES = `
	section { break-inside: avoid; margin-top: 18px; }
	section h3 { color: #e30613; font-size: 12pt; margin: 0 0 10px; }
	section h4 { font-size: 11pt; margin: 10px 0 6px; }
	thead th { background: #e30613; color: #fff; text-align: left; font-size: 9pt; }
	tbody tr:nth-child(even) td { background: #fafafa; }
	.color-rojo { background-color: #fecaca; }
	.color-amarillo { background-color: #fef08a; }
	.color-verde { background-color: #bbf7d0; }
	.semaphore-dot {
		display: inline-block;
		width: 14px; height: 14px;
		border-radius: 50%;
		margin-right: 6px;
		vertical-align: middle;
	}
	.semaphore-dot.rojo { background-color: #dc2626; }
	.semaphore-dot.amarillo { background-color: #eab308; }
	.semaphore-dot.verde { background-color: #16a34a; }
	.summary-stats { display: flex; gap: 16px; margin: 12px 0; }
	.summary-stat {
		flex: 1;
		padding: 12px;
		border-radius: 6px;
		text-align: center;
		font-weight: 700;
		font-size: 11pt;
	}
	.summary-stat.rojo { background-color: #fecaca; color: #991b1b; }
	.summary-stat.amarillo { background-color: #fef08a; color: #854d0e; }
	.summary-stat.verde { background-color: #bbf7d0; color: #166534; }
	.summary-stat .count { font-size: 18pt; display: block; }
`;
