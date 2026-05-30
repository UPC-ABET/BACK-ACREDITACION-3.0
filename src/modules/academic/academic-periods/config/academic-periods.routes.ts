export const academicPeriodsRoutes = {
	academicPeriods: {
		route: 'academic-periods',
		tag: 'Periodos académicos',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar periodo académico' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar periodo académico' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar periodo académico' },
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
