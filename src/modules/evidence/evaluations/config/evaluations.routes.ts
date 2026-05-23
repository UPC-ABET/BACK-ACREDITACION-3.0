export const evaluationsRoutes = {
	evaluations: {
		route: 'evaluations',
		tag: 'Evaluaciones',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar evaluación' },
			update: { method: 'PATCH', route: '/update/:id', summary: 'Actualizar evaluación' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar evaluación' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar evaluaciones' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener evaluación' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar evaluaciones' },
		},
	},
};
