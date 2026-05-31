export const outcomeConfigsRoutes = {
	outcomeConfigs: {
		route: 'outcome-configs',
		tag: 'Outcome Configurations',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Create outcome configuration' },
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Update outcome configuration',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Delete outcome configuration',
			},
			getAll: { method: 'GET', route: '/get-all', summary: 'List outcome configurations' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Get outcome configuration by ID',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Search outcome configurations',
			},
		},
	},
};
