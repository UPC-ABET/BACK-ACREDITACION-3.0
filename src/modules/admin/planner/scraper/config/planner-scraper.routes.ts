export const plannerScraperRoutes = {
	scrape: {
		route: 'planner/scrape',
		tag: 'Planner Scrape',
		operation: {
			run: {
				method: 'POST',
				route: '',
				summary: 'Run a Planner scrape for the active academic period (header)',
			},
			list: {
				method: 'GET',
				route: '',
				summary: 'List Planner scrape runs for the active academic period (header), newest first',
			},
			getRun: {
				method: 'GET',
				route: '/:runId',
				summary: 'Get Planner scrape run status and stats',
			},
		},
	},
};
