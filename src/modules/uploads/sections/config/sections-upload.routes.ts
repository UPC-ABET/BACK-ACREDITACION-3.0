export const sectionsUploadRoutes = {
	sections_upload: {
		route: 'uploads/sections',
		tag: 'Cargas — Secciones',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de secciones desde Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de secciones por upload_log_id' },
		},
	},
};
