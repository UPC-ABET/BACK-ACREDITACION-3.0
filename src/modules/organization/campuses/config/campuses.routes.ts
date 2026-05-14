export const campusesRoutes = {
	campuses: {
		route: 'campuses',
		tag: 'Campus',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar campus' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar campus' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar campus' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar campus' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener campus' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar campus' },
		},
	},
};
