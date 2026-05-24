export const studyPlansRoutes = {
	study_plans: {
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
		},
	},
};
