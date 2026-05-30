// Mensajes de validación — claves i18n.
// Réplica funcional del scraping Banner (C1 + C2).
export const scrapingBannerUploadStrings = {
	error: {
		studentCodeEmpty: 'uploads.scrapingBanner.error.studentCodeEmpty',
		programNotFound: 'uploads.scrapingBanner.error.programNotFound',
		academicPeriodNotFound: 'uploads.scrapingBanner.error.academicPeriodNotFound',
		campusNotFound: 'uploads.scrapingBanner.error.campusNotFound',
		courseNotFound: 'uploads.scrapingBanner.error.courseNotFound',
		professorNotFound: 'uploads.scrapingBanner.error.professorNotFound',
		graduationModalityInvalid: 'uploads.scrapingBanner.error.graduationModalityInvalid',
		enrollmentModalityInvalid: 'uploads.scrapingBanner.error.enrollmentModalityInvalid',
		sectionCodeEmpty: 'uploads.scrapingBanner.error.sectionCodeEmpty',
	},
	result: {
		uploadFailed: 'uploads.scrapingBanner.result.uploadFailed',
		uploadSuccess: 'uploads.scrapingBanner.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresScrapingBanner.xlsx',
	},
} as const;
