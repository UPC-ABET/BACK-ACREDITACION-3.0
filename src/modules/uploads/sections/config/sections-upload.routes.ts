export const sectionsUploadRoutes = {
	sections_upload: {
		route: 'uploads/sections',
		tag: 'Uploads — Sections',
		operation: {
			template: {
				method: 'GET',
				route: '/template',
				summary: 'Download the sections Excel template',
			},
			upload: {
				method: 'POST',
				route: '/upload',
				summary: 'Bulk upload course sections from Excel',
			},
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back a sections upload by uploadLogId',
			},
		},
	},
};
