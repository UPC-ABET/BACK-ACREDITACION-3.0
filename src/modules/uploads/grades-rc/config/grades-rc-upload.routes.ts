export const gradesRcUploadRoutes = {
	grades_rc_upload: {
		route: 'uploads/grades-rc',
		tag: 'Uploads — RC Grades',
		operation: {
			template: { method: 'GET', route: '/template', summary: 'Download the RC grades Excel template' },
			upload: { method: 'POST', route: '/upload', summary: 'Bulk upload RC grades from Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Roll back an RC grades upload by uploadLogId' },
		},
	},
};
