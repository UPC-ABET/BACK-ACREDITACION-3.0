export const gradesRcUploadRoutes = {
	grades_rc_upload: {
		route: 'uploads/grades-rc',
		tag: 'Cargas — Notas RC',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de notas RC desde Excel (unpivot 4 notas/fila)' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de notas RC por upload_log_id' },
		},
	},
};
