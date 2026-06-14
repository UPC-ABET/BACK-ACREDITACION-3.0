export const enrolledStudentsRoutes = {
	enrolledStudents: {
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
			maintenanceCreate: {
				method: 'POST',
				route: '/maintenance',
				summary: 'Registrar matrícula (mantenimiento)',
			},
			maintenanceList: {
				method: 'GET',
				route: '/maintenance',
				summary: 'Listar matrículas (mantenimiento) por período académico',
			},
			maintenanceUpdate: {
				method: 'PUT',
				route: '/maintenance/:id',
				summary: 'Actualizar matrícula (mantenimiento)',
				params: [{ name: 'id', description: 'ID de la matrícula', type: Number }],
			},
			maintenanceDelete: {
				method: 'DELETE',
				route: '/maintenance/:id',
				summary: 'Eliminar matrícula (mantenimiento)',
				params: [{ name: 'id', description: 'ID de la matrícula', type: Number }],
			},
		},
	},
};
