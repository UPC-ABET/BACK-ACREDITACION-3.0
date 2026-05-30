export const performanceLevelsRoutes = {
	performanceLevels: {
		route: 'performance-levels',
		tag: 'Niveles de desempeño',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar nivel de desempeño' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar nivel de desempeño' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar nivel de desempeño' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar niveles de desempeño' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener nivel de desempeño' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar niveles de desempeño',
			},
		},
	},
};
