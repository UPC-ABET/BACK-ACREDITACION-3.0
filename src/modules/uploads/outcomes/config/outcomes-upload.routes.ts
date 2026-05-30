export const outcomesUploadRoutes = {
	outcomes_upload: {
		route: 'uploads/outcomes',
		tag: 'Cargas — Malla COCOs / Outcomes',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de outcomes (malla COCOs) desde Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de outcomes por upload_log_id' },
		},
	},
};
