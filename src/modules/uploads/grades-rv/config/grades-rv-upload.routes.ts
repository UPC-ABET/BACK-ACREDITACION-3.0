export const gradesRvUploadRoutes = {
	grades_rv_upload: {
		route: 'uploads/grades-rv',
		tag: 'Uploads — RV Grades',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the RV grades Excel template',
			},
			upload: { method: 'POST', route: '/upload', summary: 'Bulk upload RV grades from Excel' },
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back an RV grades upload by uploadLogId',
			},
		},
	},
};
