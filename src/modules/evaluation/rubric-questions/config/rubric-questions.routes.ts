export const rubricQuestionsRoutes = {
	rubric_questions: {
		route: 'rubric-questions',
		tag: 'Preguntas de rúbrica',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar pregunta de rúbrica' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar pregunta de rúbrica' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar pregunta de rúbrica' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar preguntas de rúbrica' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener pregunta de rúbrica' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar preguntas de rúbrica' },
		},
	},
};
