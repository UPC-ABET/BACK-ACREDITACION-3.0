export const studentCourseOutcomeGradesRoutes = {
	student_course_outcome_grades: {
		route: 'student-course-outcome-grades',
		tag: 'Notas de outcomes por curso',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar nota de outcome' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar nota de outcome' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar nota de outcome' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar notas de outcomes' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener nota de outcome' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar notas de outcomes',
			},
		},
	},
};
