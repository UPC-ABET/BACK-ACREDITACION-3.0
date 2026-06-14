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
			commissionOptions: {
				method: 'GET',
				route: '/commission-options',
				summary: 'Listar comisiones con comision de programa en el periodo academico (header)',
			},
			programOptions: {
				method: 'GET',
				route: '/program-options',
				summary: 'Listar carreras con comision de programa en el periodo academico (header)',
			},
			getDetailedByFilters: {
				method: 'POST',
				route: '/get-detailed-by-filters',
				summary: 'Listar comisiones de programa enriquecidas del periodo academico (header)',
			},
		},
	},
};
