export const accreditorsRoutes = {
	accreditors: {
		route: 'accreditors',
		tag: 'Acreditadoras',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar acreditadora' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar acreditadora' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar acreditadora' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar acreditadoras' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener acreditadora' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar acreditadoras' },
		},
	},
};
