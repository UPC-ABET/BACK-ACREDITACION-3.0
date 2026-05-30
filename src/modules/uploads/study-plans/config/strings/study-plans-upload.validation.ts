// Mensajes de validación — claves i18n.
// Réplica funcional de las validaciones de USP_MallaCurricularCargaMasiva (ABET 2.0).
export const studyPlansUploadStrings = {
	error: {
		studyPlanCodeEmpty: 'uploads.studyPlans.error.studyPlanCodeEmpty',
		programNotFound: 'uploads.studyPlans.error.programNotFound',
		courseCodeEmpty: 'uploads.studyPlans.error.courseCodeEmpty',
		courseNameEmpty: 'uploads.studyPlans.error.courseNameEmpty',
		levelTypeInvalid: 'uploads.studyPlans.error.levelTypeInvalid',
		prerequisiteNotFound: 'uploads.studyPlans.error.prerequisiteNotFound',
		courseAlreadyInStudyPlan: 'uploads.studyPlans.error.courseAlreadyInStudyPlan',
	},
	result: {
		uploadFailed: 'uploads.studyPlans.result.uploadFailed',
		uploadSuccess: 'uploads.studyPlans.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaMalla.xlsx',
	},
} as const;
