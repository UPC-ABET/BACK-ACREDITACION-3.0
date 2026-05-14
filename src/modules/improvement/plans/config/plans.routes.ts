export const plansRoutes = {
	plans: {
		route: 'plans',
		tag: 'Planes',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar plan' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar plan' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar plan' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar planes' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener plan' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar planes' },
		},
	},
};
