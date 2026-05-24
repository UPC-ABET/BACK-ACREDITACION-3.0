export const projectStudentsRoutes = {
	project_students: {
		route: 'project-students',
		tag: 'Estudiantes de proyecto',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar estudiante de proyecto' },
			update: {
				method: 'PATCH',
				route: '/update/:id',
				summary: 'Actualizar estudiante de proyecto',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar estudiante de proyecto',
			},
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar estudiantes de proyecto' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener estudiante de proyecto',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar estudiantes de proyecto',
			},
		},
	},
};
