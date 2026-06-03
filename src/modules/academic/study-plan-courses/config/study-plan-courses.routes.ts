export const studyPlanCoursesRoutes = {
	studyPlanCourses: {
		route: 'study-plan-courses',
		tag: 'Cursos de plan de estudio',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar curso de plan de estudio' },
			update: {
				method: 'PUT',
				route: '/update/:id',
				summary: 'Actualizar curso de plan de estudio',
			},
			delete: {
				method: 'DELETE',
				route: '/delete/:id',
				summary: 'Eliminar curso de plan de estudio',
			},
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar cursos de plan de estudio' },
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener curso de plan de estudio',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar cursos de plan de estudio',
			},
			enableEvaluation: {
				method: 'PATCH',
				route: '/enable-evaluation/:id',
				summary: 'Habilitar o deshabilitar evaluacion de un curso de plan de estudio',
			},
		},
	},
};
