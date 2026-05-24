export const enrolledStudentsRoutes = {
	enrolled_students: {
		route: 'enrolled-students',
		tag: 'Estudiantes matriculados',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar matrícula de estudiante' },
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Actualizar matrícula de estudiante',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar matrícula de estudiante',
			},
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar estudiantes matriculados' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener matrícula de estudiante',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar estudiantes matriculados',
			},
		},
	},
};
