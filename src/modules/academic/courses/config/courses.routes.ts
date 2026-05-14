export const coursesRoutes = {
	courses: {
		route: 'courses',
		tag: 'Cursos',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar curso' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar curso' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar curso' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar cursos' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener curso' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar cursos' },
		},
	},
};
