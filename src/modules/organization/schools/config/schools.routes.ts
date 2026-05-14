export const schoolsRoutes = {
	schools: {
		route: 'schools',
		tag: 'Escuelas',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar escuela' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar escuela' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar escuela' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar escuelas' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener escuela' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar escuelas' },
		},
	},
};
