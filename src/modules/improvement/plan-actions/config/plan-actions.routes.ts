export const planActionsRoutes = {
	plan_actions: {
		route: 'plan-actions',
		tag: 'Acciones de plan',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar relación plan-acción' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar relación plan-acción' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar relación plan-acción' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar relaciones plan-acción' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener relación plan-acción' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar relaciones plan-acción' },
		},
	},
};
