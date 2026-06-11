export const findingActionsRoutes = {
	findingActions: {
		route: 'finding-actions',
		tag: 'Acciones de hallazgo',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar relación hallazgo-acción' },
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Actualizar relación hallazgo-acción',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar relación hallazgo-acción',
			},
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar relaciones hallazgo-acción' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener relación hallazgo-acción',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar relaciones hallazgo-acción',
			},
		},
	},
};
