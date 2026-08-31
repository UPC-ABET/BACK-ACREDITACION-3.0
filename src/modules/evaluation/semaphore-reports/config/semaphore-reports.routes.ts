export const semaphoreReportsRoutes = {
	reports: {
		route: 'evaluation/semaphore-reports',
		tag: 'Semaphore Reports',
		operation: {
			rc: {
				method: 'POST',
				route: '/rc',
				summary: 'Get RC semaphore report data (JSON)',
			},
			rcPerformanceLevels: {
				method: 'GET',
				route: '/rc/performance-levels',
				summary:
					'List the RC performance levels (Nivel de Desempeño) configured for the active ' +
					'academic period, for the "Nivel de Desempeño" filter',
			},
			rcPdf: {
				method: 'POST',
				route: '/rc/pdf',
				summary: 'Generate and download RC semaphore report PDF',
			},
			rcExcel: {
				method: 'POST',
				route: '/rc/excel',
				summary: 'Generate and download RC semaphore report Excel',
			},
			rv: {
				method: 'POST',
				route: '/rv',
				summary: 'Get RV semaphore report data (JSON)',
			},
			rvPdf: {
				method: 'POST',
				route: '/rv/pdf',
				summary: 'Generate and download RV semaphore report PDF',
			},
			rvExcel: {
				method: 'POST',
				route: '/rv/excel',
				summary: 'Generate and download RV semaphore report Excel',
			},
		},
	},
};
