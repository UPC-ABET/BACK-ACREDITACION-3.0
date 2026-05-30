export const chartsUploadRoutes = {
	charts_upload: {
		route: 'uploads/charts',
		tag: 'Cargas — Organigrama',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de organigrama desde Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de organigrama por upload_log_id' },
		},
	},
};
