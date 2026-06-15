export const scraperRoutes = {
	scrape: {
		route: 'banner/scrape',
		tag: 'Banner Scrape',
		operation: {
			run: {
				method: 'POST',
				route: '',
				summary: 'Run a Banner scrape for the active academic period (header)',
			},
			list: {
				method: 'GET',
				route: '',
				summary: 'List scrape runs for the active academic period (header), newest first',
			},
			getRun: { method: 'GET', route: '/:runId', summary: 'Get scrape run status and stats' },
		},
	},
};
