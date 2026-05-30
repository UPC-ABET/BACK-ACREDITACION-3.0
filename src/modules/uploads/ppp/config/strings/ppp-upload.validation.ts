// Mensajes de validación — claves i18n.
// Réplica funcional de POST /excel/upload-PPP (ABET 2.0).
export const pppUploadStrings = {
	error: {
		surveyTypeInvalid: 'uploads.ppp.error.surveyTypeInvalid',
		surveyStatusInvalid: 'uploads.ppp.error.surveyStatusInvalid',
		studentNotFound: 'uploads.ppp.error.studentNotFound',
		academicPeriodNotFound: 'uploads.ppp.error.academicPeriodNotFound',
		campusNotFound: 'uploads.ppp.error.campusNotFound',
		programNotFound: 'uploads.ppp.error.programNotFound',
		surveyNumberEmpty: 'uploads.ppp.error.surveyNumberEmpty',
		outcomeNotFound: 'uploads.ppp.error.outcomeNotFound', // matching frágil por outcome_code + program (MAPEO bug #15)
		scoreInvalid: 'uploads.ppp.error.scoreInvalid',
	},
	result: {
		uploadFailed: 'uploads.ppp.result.uploadFailed',
		uploadSuccess: 'uploads.ppp.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaPPP.xlsx',
	},
} as const;
