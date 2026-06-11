export const studentSectionsUploadRoutes = {
	student_sections_upload: {
		route: 'uploads/student-sections',
		tag: 'Uploads — Student Section Enrollment',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the student-section Excel template',
			},
			upload: {
				method: 'POST',
				route: '/upload',
				summary: 'Bulk upload student section enrollments from Excel',
			},
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back a student-section upload by uploadLogId',
			},
		},
	},
};
