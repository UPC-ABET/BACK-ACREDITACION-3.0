export const surveysRoutes = {
	surveys: {
		route: 'surveys',
		tag: 'Encuestas',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar encuesta' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar encuesta' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar encuesta' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar encuestas' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener encuesta' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar encuestas' },
		},
	},
};
