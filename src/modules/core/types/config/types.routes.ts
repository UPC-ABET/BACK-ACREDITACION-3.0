export const typesRoutes = {
	types: {
		route: 'types',
		tag: 'Tipos',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar tipo' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar tipo' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar tipo' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar tipos' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener tipo' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar tipos' },
		},
	},
};
