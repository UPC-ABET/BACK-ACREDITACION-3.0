export const studyPlansUploadRoutes = {
	study_plans_upload: {
		route: 'uploads/study-plans',
		tag: 'Uploads — Study Plans',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the study-plan Excel template',
			},
			upload: { method: 'POST', route: '/upload', summary: 'Bulk upload study plans from Excel' },
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back a study-plan upload by uploadLogId',
			},
		},
	},
};
