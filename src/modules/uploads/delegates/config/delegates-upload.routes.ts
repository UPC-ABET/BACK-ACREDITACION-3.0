export const delegatesUploadRoutes = {
	delegates_upload: {
		route: 'uploads/delegates',
		tag: 'Cargas — Delegados',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de delegados desde Excel (UPDATE flag is_delegate)' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de delegados por upload_log_id' },
		},
	},
};
