export const studyPlanAcademicPeriodsRoutes = {
	studyPlanAcademicPeriods: {
		route: 'study-plan-academic-periods',
		tag: 'Planes de estudio por periodo académico',
		operation: {
			getAll: {
				method: 'GET',
				route: '/get-all',
				summary: 'Listar planes de estudio por periodo académico',
			},
			getById: {
				method: 'GET',
				route: '/get-by-id/:id',
				summary: 'Obtener plan de estudio por periodo académico',
			},
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Buscar planes de estudio por periodo académico',
			},
		},
	},
};
