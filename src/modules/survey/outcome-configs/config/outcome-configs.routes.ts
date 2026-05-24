export const outcomeConfigsRoutes = {
	outcome_configs: {
		route: 'outcome-configs',
		tag: 'Configuraciones de outcomes',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar configuración de outcome' },
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Actualizar configuración de outcome',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar configuración de outcome',
			},
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar configuraciones de outcomes' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener configuración de outcome',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar configuraciones de outcomes',
			},
		},
	},
};
