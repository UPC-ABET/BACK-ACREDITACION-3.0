export const scoresRoutes = {
	scores: {
		route: 'scores',
		tag: 'Puntajes',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar puntaje' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar puntaje' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar puntaje' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar puntajes' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener puntaje' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar puntajes' },
		},
	},
};
