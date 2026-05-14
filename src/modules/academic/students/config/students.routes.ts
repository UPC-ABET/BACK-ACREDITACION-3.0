export const studentsRoutes = {
	students: {
		route: 'students',
		tag: 'Estudiantes',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar estudiante' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar estudiante' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar estudiante' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar estudiantes' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener estudiante' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar estudiantes' },
		},
	},
};
