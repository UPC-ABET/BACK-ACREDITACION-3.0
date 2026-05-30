// Mensajes de validación — claves i18n.
// Réplica funcional de usp_InsertarAlumnoNotasRCBannerScraping (ABET 2.0).
export const gradesBannerUploadStrings = {
	error: {
		studentCodeEmpty: 'uploads.gradesBanner.error.studentCodeEmpty',
		courseCodeEmpty: 'uploads.gradesBanner.error.courseCodeEmpty',
		sectionCodeEmpty: 'uploads.gradesBanner.error.sectionCodeEmpty',
		enrollmentNotFound: 'uploads.gradesBanner.error.enrollmentNotFound',
		gradeTypeInvalid: 'uploads.gradesBanner.error.gradeTypeInvalid',
		gradeInvalid: 'uploads.gradesBanner.error.gradeInvalid',
		gradeAlreadyExists: 'uploads.gradesBanner.error.gradeAlreadyExists',
	},
	result: {
		uploadFailed: 'uploads.gradesBanner.result.uploadFailed',
		uploadSuccess: 'uploads.gradesBanner.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresScrapingNotasBanner.xlsx',
	},
} as const;
