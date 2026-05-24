export const programCommissionsRoutes = {
	program_commissions: {
		route: 'program-commissions',
		tag: 'Comisiones de programa',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar comisión de programa' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar comisión de programa' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar comisión de programa' },
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
