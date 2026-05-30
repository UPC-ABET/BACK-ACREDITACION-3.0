export const studentSectionsUploadRoutes = {
	student_sections_upload: {
		route: 'uploads/student-sections',
		tag: 'Cargas — Alumno×Sección',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de alumnos por sección desde Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de alumno×sección por upload_log_id' },
		},
	},
};
