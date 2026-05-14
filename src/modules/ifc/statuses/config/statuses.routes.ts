export const statusesRoutes = {
	statuses: {
		route: 'statuses',
		tag: 'Estados',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar estado' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar estado' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar estado' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar estados' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener estado' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar estados' },
		},
	},
};
