export const commissionsRoutes = {
	commissions: {
		route: 'commissions',
		tag: 'Comisiones',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar comisión' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar comisión' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar comisión' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar comisiones' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener comisión' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar comisiones' },
		},
	},
};
