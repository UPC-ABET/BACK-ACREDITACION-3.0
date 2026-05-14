export const chartsRoutes = {
	charts: {
		route: 'charts',
		tag: 'Organigramas',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar organigrama' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar organigrama' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar organigrama' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar organigramas' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener organigrama' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar organigramas' },
		},
	},
};
