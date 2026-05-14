export const facultiesRoutes = {
	faculties: {
		route: 'faculties',
		tag: 'Facultades',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar facultad' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar facultad' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar facultad' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar facultades' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener facultad' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar facultades' },
		},
	},
};
