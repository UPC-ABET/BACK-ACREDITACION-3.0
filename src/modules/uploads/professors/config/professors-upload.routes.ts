export const professorsUploadRoutes = {
	professors_upload: {
		route: 'uploads/professors',
		tag: 'Cargas — Docentes',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de docentes desde Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de docentes por upload_log_id' },
		},
	},
};
