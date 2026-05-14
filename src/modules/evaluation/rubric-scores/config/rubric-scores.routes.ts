export const rubricScoresRoutes = {
	rubric_scores: {
		route: 'rubric-scores',
		tag: 'Puntajes de rúbrica',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar puntaje de rúbrica' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar puntaje de rúbrica' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar puntaje de rúbrica' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar puntajes de rúbrica' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener puntaje de rúbrica' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar puntajes de rúbrica' },
		},
	},
};
