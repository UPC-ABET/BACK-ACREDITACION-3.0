export const PDF_LABELS = {
	en: {
		university: 'UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS',
		reportTitle: 'END OF SEMESTER REPORT',
		semester: 'SEMESTER',
		course: 'COURSE',
		coordinator: 'COURSE COORDINATOR',
		s1Title: '1. GENERAL INFORMATION',
		s11Title: '1.1 RESULT ACHIEVED',
		s2Title: '2. PRIOR ACTIONS',
		s2Empty: 'No prior actions available for this report.',
		s2ColCode: 'CODE',
		s2ColDesc: 'DESCRIPTION',
		s2ColState: 'STATE',
		s3Title: '3. FINDINGS',
		s3ColCode: 'CODE',
		s3ColDesc: 'DESCRIPTION',
		s4Title: '4. IMPROVEMENT ACTIONS',
		s4ColCode: 'CODE',
		s4ColDesc: 'DESCRIPTION',
		s4ColFinding: 'FINDING CODE',
	},
	es: {
		university: 'UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS',
		reportTitle: 'INFORME DE FIN DE CICLO',
		semester: 'CICLO',
		course: 'CURSO',
		coordinator: 'COORDINADOR DE CURSO',
		s1Title: '1. INFORMACIÓN GENERAL',
		s11Title: '1.1 RESULTADO ALCANZADO',
		s2Title: '2. ACCIONES PREVIAS',
		s2Empty: 'No hay acciones previas disponibles para este informe.',
		s2ColCode: 'CÓDIGO',
		s2ColDesc: 'DESCRIPCIÓN',
		s2ColState: 'ESTADO',
		s3Title: '3. HALLAZGOS',
		s3ColCode: 'CÓDIGO',
		s3ColDesc: 'DESCRIPCIÓN',
		s4Title: '4. ACCIONES PROPUESTAS',
		s4ColCode: 'CÓDIGO',
		s4ColDesc: 'DESCRIPCIÓN',
		s4ColFinding: 'CÓDIGO HALLAZGO',
	},
} as const;

export const PDF_STYLES = `
	@page { size: A4; margin: 18mm 14mm; }
	body { font-family: -apple-system, system-ui, sans-serif; color: #18181b; font-size: 11pt; }
	header { text-align: center; }
	.logo { width: 50px; margin: 0 auto 8px; display: block; }
	.title, .subtitle { color: #C8102E; margin: 0; font-weight: 700; }
	.title { font-size: 13pt; }
	.subtitle { font-size: 12pt; margin-top: 4px; }
	.report-title { color: #C8102E; text-decoration: underline; font-size: 14pt; margin: 12px 0; }
	.rule { border: 0; border-top: 1px solid #C8102E; margin: 16px 0; }
	section h3 { color: #C8102E; text-decoration: underline; font-size: 12pt; margin-top: 12px; }
	section h4 { font-size: 11pt; margin-top: 8px; }
	table { width: 100%; border-collapse: collapse; margin-top: 8px; }
	th { background: #C8102E; color: #fff; padding: 6px 8px; text-align: left; font-size: 10.5pt; }
	td { padding: 6px 8px; border: 1px solid #d4d4d8; font-size: 10.5pt; vertical-align: top; }
	tbody tr:nth-child(even) td { background: #fafafa; }
	.empty { text-align: center; font-style: italic; color: #71717a; }
	ul { padding-left: 18px; }
	li { margin-bottom: 6px; }
`;
