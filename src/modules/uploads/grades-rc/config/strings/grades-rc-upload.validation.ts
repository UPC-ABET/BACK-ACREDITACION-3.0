// Mensajes de validación — claves i18n.
// Réplica funcional de las validaciones de USP_GradesRCCargaMasiva (ABET 2.0).
export const gradesRcUploadStrings = {
	error: {
		courseCodeEmpty: 'uploads.gradesRc.error.courseCodeEmpty',
		sectionCodeEmpty: 'uploads.gradesRc.error.sectionCodeEmpty',
		studentCodeEmpty: 'uploads.gradesRc.error.studentCodeEmpty',
		enrollmentNotFound: 'uploads.gradesRc.error.enrollmentNotFound',
		gradeTypeCatalogMissing: 'uploads.gradesRc.error.gradeTypeCatalogMissing',
		gradeAlreadyExists: 'uploads.gradesRc.error.gradeAlreadyExists',
	},
	result: {
		uploadFailed: 'uploads.gradesRc.result.uploadFailed',
		uploadSuccess: 'uploads.gradesRc.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaNotasRC.xlsx',
	},
} as const;
