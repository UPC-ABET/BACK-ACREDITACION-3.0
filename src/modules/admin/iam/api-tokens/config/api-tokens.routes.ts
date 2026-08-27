export const apiTokensRoutes = {
	route: 'admin-api-tokens',
	tag: 'IAM - API Tokens',
	operation: {
		create: { method: 'POST', route: '/create', summary: 'Emitir token de API' },
		update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar token de API' },
		delete: { method: 'DELETE', route: '/delete/:id', summary: 'Revocar token de API' },
		getAll: { method: 'GET', route: '/get-all', summary: 'Listar tokens de API' },
		getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener token de API' },
		getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar tokens de API' },
	},
};
