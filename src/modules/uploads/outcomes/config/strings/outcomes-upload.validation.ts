// Mensajes de validación — claves i18n.
// Réplica funcional de las validaciones de USP_OutcomeCargaMasiva (ABET 2.0).
export const outcomesUploadStrings = {
	error: {
		accreditorCodeEmpty: 'uploads.outcomes.error.accreditorCodeEmpty',
		commissionCodeEmpty: 'uploads.outcomes.error.commissionCodeEmpty',
		programNotFound: 'uploads.outcomes.error.programNotFound',
		studyPlanCourseNotFound: 'uploads.outcomes.error.studyPlanCourseNotFound', // curso no está en la malla del período
		outcomeCodeEmpty: 'uploads.outcomes.error.outcomeCodeEmpty',
		outcomeTypeInvalid: 'uploads.outcomes.error.outcomeTypeInvalid',
		outcomeAlreadyMapped: 'uploads.outcomes.error.outcomeAlreadyMapped', // dedup outcome×SPC
	},
	result: {
		uploadFailed: 'uploads.outcomes.result.uploadFailed',
		uploadSuccess: 'uploads.outcomes.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaOutcomes.xlsx',
	},
} as const;
