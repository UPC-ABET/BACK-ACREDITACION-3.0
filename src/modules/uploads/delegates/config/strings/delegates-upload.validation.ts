// Mensajes de validación — claves i18n (se resuelven en el front vía tryTranslate).
// Réplica funcional de las validaciones de USP_DelegadosCargaMasiva (ABET 2.0).
export const delegatesUploadStrings = {
	error: {
		courseCodeEmpty: 'uploads.delegates.error.courseCodeEmpty',
		sectionCodeEmpty: 'uploads.delegates.error.sectionCodeEmpty',
		studentCodeEmpty: 'uploads.delegates.error.studentCodeEmpty',
		enrollmentNotFound: 'uploads.delegates.error.enrollmentNotFound', // alumno no está matriculado en la sección
		alreadyDelegate: 'uploads.delegates.error.alreadyDelegate',       // dedup: ya marcado como delegado
	},
	result: {
		uploadFailed: 'uploads.delegates.result.uploadFailed',
		uploadSuccess: 'uploads.delegates.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaDelegados.xlsx',
	},
} as const;
