export const studyPlanPeriodsRoutes = {
	study_plan_periods: {
		route: 'configuration/periods/:periodId/study-plans',
		tag: 'Configuración — Asociación Malla × Período',
		operation: {
			associate: {
				method: 'POST',
				route: ':studyPlanId',
				summary: 'Asociar malla curricular a un período (Fase 0) — clona los cursos del período previo',
			},
			unassociate: {
				method: 'DELETE',
				route: ':studyPlanId',
				summary: 'Desasociar malla de un período (rollback limpio)',
			},
			list: { method: 'GET', route: '', summary: 'Listar mallas asociadas a un período' },
		},
	},
};
