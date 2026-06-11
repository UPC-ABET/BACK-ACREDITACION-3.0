export const projectEvaluatorsRoutes = {
	projectEvaluators: {
		route: 'project-evaluators',
		tag: 'Evaluadores de proyecto',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar evaluador de proyecto' },
			update: {
				method: 'PATCH',
				route: '/update/:id',
				summary: 'Actualizar evaluador de proyecto',
			},
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar evaluador de proyecto' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar evaluadores de proyecto' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener evaluador de proyecto' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar evaluadores de proyecto',
			},
		},
	},
};
