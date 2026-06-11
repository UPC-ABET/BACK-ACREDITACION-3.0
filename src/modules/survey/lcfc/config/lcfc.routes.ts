export const lcfcRoutes = {
	root: 'lcfc',
	tag: 'LCFC - End-of-Cycle Achievement Survey',
	config: {
		generate: {
			method: 'POST',
			route: 'config/generate',
			summary: 'Generate LCFC course configurations for a period and program',
		},
		getAll: {
			method: 'GET',
			route: 'config/get-all',
			summary: 'List all LCFC course configurations',
		},
		getByFilters: {
			method: 'POST',
			route: 'config/get-by-filters',
			summary: 'Filter LCFC course configurations',
		},
		updateStatus: {
			method: 'POST',
			route: 'config/update-status',
			summary: 'Bulk update active/inactive status of LCFC courses',
		},
	},
	notification: {
		send: {
			method: 'POST',
			route: 'notification/send',
			summary: 'Send LCFC surveys by email to students enrolled in active courses',
		},
	},
	token: {
		validate: {
			method: 'GET',
			route: 'token/validate/:token',
			summary: 'Validate LCFC survey token (no JWT authentication)',
		},
	},
	survey: {
		getByToken: {
			method: 'POST',
			route: 'survey/get-by-token',
			summary: 'Get LCFC survey form with course outcomes',
		},
		complete: {
			method: 'POST',
			route: 'survey/complete',
			summary: 'Submit completed LCFC survey with outcome scores',
		},
	},
	dashboard: {
		get: {
			method: 'POST',
			route: 'dashboard',
			summary: 'LCFC dashboard: completed vs pending survey progress',
		},
	},
};
