export const programsRoutes = {
	programs: {
		route: 'programs',
		tag: 'Programas',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar programa' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar programa' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar programa' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar programas' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener programa' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar programas' },
		},
	},
};
