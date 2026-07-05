export const scrapingExportsRoutes = {
	exports: {
		route: 'scraping/exports',
		tag: 'Scraping — Exports',
		operation: {
			docentes: {
				method: 'GET',
				route: '/docentes',
				summary: 'Generate the docentes (staff) Excel from the latest Planner scrape',
			},
			secciones: {
				method: 'GET',
				route: '/secciones',
				summary: 'Generate the secciones (sections) Excel from the latest Planner scrape',
			},
			alumnosMatriculados: {
				method: 'GET',
				route: '/alumnos-matriculados',
				summary:
					'Generate the alumnos matriculados (enrolled students) Excel from the latest Banner scrape',
			},
			alumnosSecciones: {
				method: 'GET',
				route: '/alumnos-secciones',
				summary:
					'Generate the alumnos x sección (student-sections) Excel from the latest Banner scrape',
			},
			notasRc: {
				method: 'GET',
				route: '/notas-rc',
				summary:
					'Generate the grades RC (course grades) Excel, ready to re-upload via the RC bulk grade upload, from the latest Banner scrape',
			},
		},
	},
};
