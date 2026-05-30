export const gradesBannerUploadRoutes = {
	grades_banner_upload: {
		route: 'uploads/grades-banner',
		tag: 'Cargas — Notas Banner Scraping',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga del scraping de notas Banner (1 fila = 1 nota tipada)' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir notas Banner por upload_log_id' },
		},
	},
};
