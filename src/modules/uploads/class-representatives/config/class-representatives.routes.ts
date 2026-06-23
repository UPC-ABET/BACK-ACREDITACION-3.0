export const classRepresentativesRoutes = {
	class_representatives_upload: {
		route: 'uploads/class-representatives',
		tag: 'Uploads — Class Representatives',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the class-representatives Excel template',
			},
			upload: {
				method: 'POST',
				route: '/upload',
				summary: 'Bulk upload class representatives from Excel',
			},
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back a class representatives upload by uploadLogId',
			},
		},
	},
};
