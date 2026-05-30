// Mensajes de validación — claves i18n (se resuelven en el front vía tryTranslate).
// Réplica funcional de las validaciones de USP_OrganigramaCargaMasiva (ABET 2.0).
export const chartsUploadStrings = {
	error: {
		entityCodeEmpty: 'uploads.charts.error.entityCodeEmpty',
		nameEmpty: 'uploads.charts.error.nameEmpty',
		levelInvalid: 'uploads.charts.error.levelInvalid',
		entityTypeInvalid: 'uploads.charts.error.entityTypeInvalid',
		responsibleNotFound: 'uploads.charts.error.responsibleNotFound',
		campusNotFound: 'uploads.charts.error.campusNotFound',
		parentNotFound: 'uploads.charts.error.parentNotFound',
		chartAlreadyExists: 'uploads.charts.error.chartAlreadyExists',
	},
	result: {
		uploadFailed: 'uploads.charts.result.uploadFailed',
		uploadSuccess: 'uploads.charts.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaOrganigrama.xlsx',
	},
} as const;
