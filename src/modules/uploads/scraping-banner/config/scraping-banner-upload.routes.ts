export const scrapingBannerUploadRoutes = {
	scraping_banner_upload: {
		route: 'uploads/scraping-banner',
		tag: 'Cargas — Scraping Banner (C1 + C2)',
		operation: {
			upload: { method: 'POST', route: '/upload', summary: 'Carga del scraping de Banner (AlumnoSeccion + AlumnoPersonal)' },
			rollback: { method: 'POST', route: '/rollback', summary: 'Revertir scraping Banner por upload_log_id' },
		},
	},
};
