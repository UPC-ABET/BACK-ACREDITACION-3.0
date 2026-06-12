export const staffRoutes = {
	staff: {
		route: 'staff',
		tag: 'Personal',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar personal' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar personal' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar personal' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar personal' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener personal' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar personal' },
			lookup: {
				method: 'GET',
				route: '/lookup',
				summary: 'Buscar personal para select (paginado, codigo de profesor o nombre)',
			},
		},
	},
};
