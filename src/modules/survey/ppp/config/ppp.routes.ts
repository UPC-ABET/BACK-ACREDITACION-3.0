export const pppRoutes = {
	root: 'ppp',
	tag: 'PPP - Pre-Professional Internship Survey',
	config: {
		create: {
			method: 'POST',
			route: 'config/create',
			summary: 'Create PPP outcome configuration',
		},
		getAll: {
			method: 'GET',
			route: 'config/get-all',
			summary: 'List all PPP configurations',
		},
		getByFilters: {
			method: 'POST',
			route: 'config/get-by-filters',
			summary: 'Filter PPP configurations',
		},
		getById: {
			method: 'GET',
			route: 'config/get-by-id/:id',
			summary: 'Get PPP configuration by ID',
		},
		update: { method: 'PUT', route: 'config/update/:id', summary: 'Update PPP configuration' },
		delete: { method: 'DELETE', route: 'config/delete/:id', summary: 'Delete PPP configuration' },
		replicate: {
			method: 'POST',
			route: 'config/replicate',
			summary: 'Replicate PPP configurations from previous period',
		},
	},
	survey: {
		create: {
			method: 'POST',
			route: 'survey/create',
			summary: 'Register individual PPP survey',
		},
		getAll: { method: 'GET', route: 'survey/get-all', summary: 'List PPP surveys' },
		getByFilters: {
			method: 'POST',
			route: 'survey/get-by-filters',
			summary: 'Filter PPP surveys',
		},
		getById: {
			method: 'GET',
			route: 'survey/get-by-id/:id',
			summary: 'Get PPP survey by ID',
		},
		uploadExcel: {
			method: 'POST',
			route: 'survey/upload-excel',
			summary: 'Bulk import PPP data from base64 Excel',
		},
		template: {
			method: 'GET',
			route: 'survey/template',
			summary: 'Download PPP Excel template (fixed columns + one per active competency)',
		},
		dashboard: {
			method: 'POST',
			route: 'survey/dashboard',
			summary: 'PPP results and scores dashboard',
		},
		generateFindings: {
			method: 'POST',
			route: 'survey/generate-findings',
			summary: 'Automatic PPP findings analysis (RED/YELLOW/GREEN)',
		},
	},
	report: {
		perception: {
			method: 'POST',
			route: 'report/perception',
			summary: 'Generate the PPP perception-by-outcome PDF report (all sedes + one per sede)',
		},
	},
};
