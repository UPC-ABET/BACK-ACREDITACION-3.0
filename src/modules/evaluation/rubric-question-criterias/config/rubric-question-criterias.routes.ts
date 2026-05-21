export const rubricQuestionCriteriasRoutes = {
	rubric_question_criterias: {
		route: 'rubric-question-criterias',
		tag: 'Criterios de preguntas de rúbrica',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar criterio de pregunta de rúbrica' },
			update: { method: 'PATCH', route: '/update/:id', summary: 'Actualizar criterio de pregunta de rúbrica' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar criterio de pregunta de rúbrica' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar criterios de preguntas de rúbrica' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener criterio de pregunta de rúbrica' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar criterios de preguntas de rúbrica' },
		},
	},
};
