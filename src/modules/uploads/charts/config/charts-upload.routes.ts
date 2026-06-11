export const chartsUploadRoutes = {
	charts_upload: {
		route: 'uploads/charts',
		tag: 'Uploads — Organization Chart',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the organization-chart Excel template',
			},
			upload: {
				method: 'POST',
				route: '/upload',
				summary: 'Bulk upload an organization chart from Excel',
			},
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back an organization-chart upload by uploadLogId',
			},
		},
	},
};
