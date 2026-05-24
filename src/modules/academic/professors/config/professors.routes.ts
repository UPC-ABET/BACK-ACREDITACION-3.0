export const professorsRoutes = {
	professors: {
		route: 'professors',
		tag: 'Profesores',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar profesor' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar profesor' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar profesor' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar profesores' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener profesor' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar profesores' },
			getByUserId: {
				method: 'GET',
				route: '/get-by-user-id/:id',
				summary: 'Obtener profesor por ID de usuario',
				params: [{ name: 'id', description: 'ID del usuario', type: Number }],
			},
		},
	},
};
