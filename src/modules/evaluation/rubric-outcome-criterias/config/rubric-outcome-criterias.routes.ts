export const rubricOutcomeCriteriasRoutes = {
	rubric_outcome_criterias: {
		route: 'rubric-outcome-criterias',
		tag: 'Criterios de outcome de rúbrica',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar criterio de outcome de rúbrica' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar criterio de outcome de rúbrica' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar criterio de outcome de rúbrica' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar criterios de outcome de rúbrica' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener criterio de outcome de rúbrica' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar criterios de outcome de rúbrica' },
		},
	},
};
