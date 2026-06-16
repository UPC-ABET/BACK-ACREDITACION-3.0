export const rubricsUploadRoutes = {
	rubrics_upload: {
		route: 'uploads/rubrics',
		tag: 'Uploads — Rubrics',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the rubrics Excel template',
			},
			upload: { method: 'POST', route: '/upload', summary: 'Bulk upload rubrics from Excel' },
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back a rubrics upload by uploadLogId',
			},
		},
	},
};
