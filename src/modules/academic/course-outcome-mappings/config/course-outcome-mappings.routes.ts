export const courseOutcomeMappingsRoutes = {
	courseOutcomeMappings: {
		route: 'course-outcome-mappings',
		tag: 'Mapeos de outcomes por curso',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar mapeo de outcome' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar mapeo de outcome' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar mapeo de outcome' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar mapeos de outcomes' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener mapeo de outcome' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar mapeos de outcomes',
			},
		},
	},
};
