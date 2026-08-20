export const scrapingExportsRoutes = {
	exports: {
		route: 'scraping/exports',
		tag: 'Scraping — Exports',
		operation: {
			status: {
				method: 'GET',
				route: '/:exportType/status',
				summary: 'Poll the generation status of a scraping export',
			},
			download: {
				method: 'GET',
				route: '/:exportType/download',
				summary: 'Download the last successfully generated scraping export',
			},
			regenerate: {
				method: 'POST',
				route: '/:exportType/regenerate',
				summary: 'Trigger a new background generation of a scraping export',
			},
		},
	},
};
