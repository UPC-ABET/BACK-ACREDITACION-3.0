export const outcomesRoutes = {
	outcomes: {
		route: 'outcomes',
		tag: 'Outcomes',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar outcome' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar outcome' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar outcome' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar outcomes' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener outcome' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar outcomes' },
		},
	},
};
