export const pppUploadRoutes = {
	ppp_upload: {
		route: 'uploads/ppp',
		tag: 'Cargas — Encuesta PPP',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de encuestas PPP desde Excel (encuesta + scores)' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga PPP por upload_log_id' },
		},
	},
};
