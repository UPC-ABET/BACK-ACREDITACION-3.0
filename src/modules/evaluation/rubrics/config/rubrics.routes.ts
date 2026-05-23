export const rubricsRoutes = {
	rubrics: {
		route: 'rubrics',
		tag: 'Rúbricas',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar rúbrica' },
			update: { method: 'PATCH', route: '/update/:id', summary: 'Actualizar rúbrica' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar rúbrica' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar rúbricas' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener rúbrica' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar rúbricas' },
		},
	},
};
