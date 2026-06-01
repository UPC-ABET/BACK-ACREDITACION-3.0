export const enrolledStudentsUploadRoutes = {
	enrolled_students_upload: {
		route: 'uploads/enrolled-students',
		tag: 'Uploads — Enrolled Students',
		operation: {
			template: { method: 'GET', route: '/template', summary: 'Download the enrolled-students Excel template' },
			upload: { method: 'POST', route: '/upload', summary: 'Bulk upload enrolled students from Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Roll back an enrolled-students upload by uploadLogId' },
		},
	},
};
