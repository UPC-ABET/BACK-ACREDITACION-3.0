export const articulationUploadRoutes = {
	articulation_upload: {
		route: 'uploads/articulation',
		tag: 'Uploads — Articulation',
		operation: {
			template: { method: 'GET', route: '/template', summary: 'Download the articulation Excel template' },
			upload: { method: 'POST', route: '/upload', summary: 'Bulk upload the outcome↔course articulation matrix from Excel' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Roll back an articulation upload by uploadLogId' },
		},
	},
};
