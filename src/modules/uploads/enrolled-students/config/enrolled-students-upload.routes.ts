export const enrolledStudentsUploadRoutes = {
	enrolled_students_upload: {
		route: 'uploads/enrolled-students',
		tag: 'Cargas — Alumnos Matriculados',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga masiva de alumnos matriculados desde Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir una carga de alumnos matriculados por upload_log_id' },
		},
	},
};
