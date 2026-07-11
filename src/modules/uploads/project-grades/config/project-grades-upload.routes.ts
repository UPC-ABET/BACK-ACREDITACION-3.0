export const projectGradesUploadRoutes = {
	project_grades_upload: {
		route: 'uploads/project-grades',
		tag: 'Uploads — Academic Project Grades',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the academic project grades Excel template',
			},
			upload: {
				method: 'POST',
				route: '/upload',
				summary:
					'Bulk grade academic projects from Excel (both Capstone+Multiple and other rubric modes)',
			},
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back a project-grades upload by uploadLogId',
			},
		},
	},
};
