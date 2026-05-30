export const studyPlansUploadRoutes = {
	study_plans_upload: {
		route: 'uploads/study-plans',
		tag: 'Cargas — Malla Curricular',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de malla curricular desde Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de malla por upload_log_id' },
		},
	},
};
