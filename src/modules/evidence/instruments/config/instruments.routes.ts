export const instrumentsRoutes = {
	instruments: {
		route: 'instruments',
		tag: 'Instrumentos',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar instrumento' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar instrumento' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar instrumento' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar instrumentos' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener instrumento' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar instrumentos' },
		},
	},
};
