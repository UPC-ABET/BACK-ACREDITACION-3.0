export const projectsUploadRoutes = {
	projects_upload: {
		route: 'uploads/projects',
		tag: 'Uploads — Academic Projects',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the academic-projects Excel template',
			},
			upload: {
				method: 'POST',
				route: '/upload',
				summary: 'Bulk upload academic projects from Excel',
			},
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back an academic-projects upload by uploadLogId',
			},
		},
	},
};
