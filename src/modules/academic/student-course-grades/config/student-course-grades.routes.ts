export const studentCourseGradesRoutes = {
	student_course_grades: {
		route: 'student-course-grades',
		tag: 'Notas de curso por estudiante',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar nota de curso' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar nota de curso' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar nota de curso' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar notas de curso' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener nota de curso' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar notas de curso' },
		},
	},
};
