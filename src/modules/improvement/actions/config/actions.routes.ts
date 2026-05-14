export const actionsRoutes = {
	actions: {
		route: 'actions',
		tag: 'Acciones',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar acción' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar acción' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar acción' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar acciones' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener acción' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar acciones' },
		},
	},
};
