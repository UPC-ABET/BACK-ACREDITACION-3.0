export const staffUploadRoutes = {
	staff_upload: {
		route: 'uploads/staff',
		tag: 'Uploads — Staff',
		operation: {
			template: { method: 'GET', route: '/template', summary: 'Download the staff Excel template' },
			upload: {
				method: 'POST',
				route: '/upload',
				summary: 'Bulk upload staff (and professors) from Excel',
			},
			rollback: {
				method: 'POST',
				route: '/rollback',
				summary: 'Roll back a staff upload by uploadLogId',
			},
		},
	},
};
