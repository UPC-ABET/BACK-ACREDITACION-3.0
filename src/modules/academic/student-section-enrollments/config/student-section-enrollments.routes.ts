export const studentSectionEnrollmentsRoutes = {
	student_section_enrollments: {
		route: 'student-section-enrollments',
		tag: 'Matrículas de estudiantes por sección',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar matrícula de estudiante en sección' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar matrícula de estudiante en sección' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar matrícula de estudiante en sección' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar matrículas de estudiantes por sección' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener matrícula de estudiante en sección' },
			getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Buscar matrículas de estudiantes por sección' },
		},
	},
};
