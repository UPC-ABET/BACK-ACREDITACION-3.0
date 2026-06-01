export const outcomesUploadRoutes = {
	outcomes_upload: {
		route: 'uploads/outcomes',
		tag: 'Uploads — Outcomes',
		operation: {
			template: { method: 'GET', route: '/template', summary: 'Download the outcomes Excel template' },
			upload: { method: 'POST', route: '/upload', summary: 'Bulk upload outcomes from Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Roll back an outcomes upload by uploadLogId' },
		},
	},
};
