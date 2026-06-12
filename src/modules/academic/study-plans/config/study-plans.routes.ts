export const studyPlansRoutes = {
	studyPlans: {
		route: 'study-plans',
		tag: 'Planes de estudio',
		operation: {
			create: { method: 'POST', route: '/create', summary: 'Registrar plan de estudio' },
			update: { method: 'PUT', route: '/update/:id', summary: 'Actualizar plan de estudio' },
			delete: { method: 'DELETE', route: '/delete/:id', summary: 'Eliminar plan de estudio' },
			getAll: { method: 'GET', route: '/get-all', summary: 'Listar planes de estudio' },
			getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Obtener plan de estudio' },
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar planes de estudio',
			},
			maintenanceList: {
				method: 'GET',
				route: '/maintenance',
				summary: 'Listar planes de estudio (mantenimiento) con paginación',
			},
			maintenanceUpdate: {
				method: 'PUT',
				route: '/maintenance/:id',
				summary: 'Actualizar plan de estudio (mantenimiento)',
				params: [{ name: 'id', description: 'ID del plan de estudio', type: Number }],
			},
			maintenanceDelete: {
				method: 'DELETE',
				route: '/maintenance/:id',
				summary: 'Eliminar plan de estudio (mantenimiento)',
				params: [{ name: 'id', description: 'ID del plan de estudio', type: Number }],
			},
			coursesView: {
				method: 'GET',
				route: '/maintenance/:id/courses',
				summary: 'Ver cursos del plan de estudio por nivel y electivos (período del header)',
				params: [{ name: 'id', description: 'ID del plan de estudio', type: Number }],
			},
		},
	},
};
