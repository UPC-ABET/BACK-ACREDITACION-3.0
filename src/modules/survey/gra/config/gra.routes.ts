export const graRoutes = {
	root: 'gra',
	tag: 'GRA - Graduate Survey',
	config: {
		create: {
			method: 'POST',
			route: 'config/create',
			summary: 'Create GRA outcome configuration',
		},
		getAll: {
			method: 'GET',
			route: 'config/get-all',
			summary: 'List all GRA configurations',
		},
		getByFilters: {
			method: 'POST',
			route: 'config/get-by-filters',
			summary: 'Filter GRA configurations',
		},
		getById: {
			method: 'GET',
			route: 'config/get-by-id/:id',
			summary: 'Get GRA configuration by ID',
		},
		update: { method: 'PUT', route: 'config/update/:id', summary: 'Update GRA configuration' },
		delete: { method: 'DELETE', route: 'config/delete/:id', summary: 'Delete GRA configuration' },
		replicate: {
			method: 'POST',
			route: 'config/replicate',
			summary: 'Replicate GRA configurations from previous period (includes performance levels)',
		},
	},
	notification: {
		save: {
			method: 'POST',
			route: 'notification/save',
			summary: 'Add student to GRA survey list',
		},
		listStudents: {
			method: 'POST',
			route: 'notification/list-students',
			summary: 'List students with GRA notification status',
		},
		delete: {
			method: 'DELETE',
			route: 'notification/delete/:id',
			summary: 'Remove student from GRA list',
		},
	},
	email: {
		send: {
			method: 'POST',
			route: 'email/send',
			summary: 'Send GRA surveys by email to pending students',
		},
	},
	token: {
		validate: {
			method: 'GET',
			route: 'token/validate/:token',
			summary: 'Validate GRA survey token (no authentication)',
		},
	},
	survey: {
		getByToken: {
			method: 'POST',
			route: 'survey/get-by-token',
			summary: 'Get GRA survey form by token',
		},
		complete: {
			method: 'POST',
			route: 'survey/complete',
			summary: 'Submit completed GRA survey',
		},
	},
	outcomes: {
		list: {
			method: 'POST',
			route: 'outcomes/list',
			summary: 'List available outcomes grouped by commission (for GRA outcome selector)',
		},
	},
	dashboard: {
		get: { method: 'POST', route: 'dashboard', summary: 'GRA survey progress dashboard' },
	},
};
