export const findingOutcomesRoutes = {
	findingOutcomes: {
		route: 'finding-outcomes',
		tag: 'Outcomes de hallazgo',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar relación hallazgo-outcome' },
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Actualizar relación hallazgo-outcome',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar relación hallazgo-outcome',
			},
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar relaciones hallazgo-outcome' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener relación hallazgo-outcome',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar relaciones hallazgo-outcome',
			},
		},
	},
};
