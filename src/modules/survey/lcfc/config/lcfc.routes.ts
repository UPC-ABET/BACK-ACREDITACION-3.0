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
		getById: {
			method: 'GET',
			route: 'config/get-by-id/:id',
			summary: 'Get an LCFC course configuration by ID',
		},
		update: {
			method: 'PUT',
			route: 'config/update/:id',
			summary: 'Update an LCFC course configuration',
		},
		updateStatus: {
			method: 'POST',
			route: 'config/update-status',
			summary: 'Bulk update active/inactive status of LCFC courses',
		},
		clone: {
			method: 'POST',
			route: 'config/clone',
			summary:
				'Clone LCFC configuration: generate target period and copy course status from source',
		},
		delete: {
			method: 'DELETE',
			route: 'config/delete/:id',
			summary: 'Delete an LCFC course configuration',
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
