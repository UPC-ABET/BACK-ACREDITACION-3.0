export const academicPeriodsRoutes = {
	academicPeriods: {
		route: 'academic-periods',
		tag: 'Periodos académicos',
		operation: {
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar periodos académicos' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener periodo académico' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar periodos académicos',
			},
		},
	},
};
