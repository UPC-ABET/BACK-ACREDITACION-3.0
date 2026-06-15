export const scraperRoutes = {
	scrape: {
		route: 'banner/scrape',
		tag: 'Banner Scrape',
		operation: {
			run: { method: 'POST', route: '', summary: 'Run a Banner scrape (period + departments)' },
			getRun: { method: 'GET', route: '/:runId', summary: 'Get scrape run status and stats' },
		},
	},
};
