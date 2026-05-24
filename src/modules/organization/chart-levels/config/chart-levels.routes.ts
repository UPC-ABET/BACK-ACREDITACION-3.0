export const chartLevelsRoutes = {
	chart_levels: {
		route: 'chart-levels',
		tag: 'Niveles de organigrama',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar nivel de organigrama' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar nivel de organigrama' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar nivel de organigrama' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar niveles de organigrama' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener nivel de organigrama' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar niveles de organigrama',
			},
		},
	},
};
