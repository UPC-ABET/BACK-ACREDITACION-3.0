export const programCommissionsRoutes = {
	programCommissions: {
		route: 'program-commissions',
		tag: 'Comisiones de programa',
		operation: {
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar comisiones de programa' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener comisión de programa' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar comisiones de programa',
			},
		},
	},
};
