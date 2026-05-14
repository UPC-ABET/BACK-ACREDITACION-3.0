export const rubricScalesRoutes = {
	rubric_scales: {
		route: 'rubric-scales',
		tag: 'Escalas de rúbrica',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar escala de rúbrica' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar escala de rúbrica' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar escala de rúbrica' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar escalas de rúbrica' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener escala de rúbrica' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar escalas de rúbrica' },
		},
	},
};
