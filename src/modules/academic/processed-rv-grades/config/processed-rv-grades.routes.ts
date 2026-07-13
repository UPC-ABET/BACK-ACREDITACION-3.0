export const processedRvGradesRoutes = {
	processedRvGrades: {
		route: 'academic/processed-rv-grades',
		tag: 'Processed RV Grades',
		operation: {
			getByFilters: {
				method: 'POST',
				route: '/get-by-filters',
				summary: 'Listar notas RV procesadas (calificadas y convertidas) del periodo',
			},
			rebuild: {
				method: 'POST',
				route: '/rebuild',
				summary:
					'Reprocesar las notas RV del periodo academico (backfill tras cambiar conversiones)',
			},
		},
	},
};
