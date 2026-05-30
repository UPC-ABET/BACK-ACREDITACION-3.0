// Mensajes de validación — claves i18n (se resuelven en el front vía tryTranslate).
// Réplica funcional de los mensajes de Ciclo.FN_Valida_Secciones (ABET 2.0).
export const sectionsUploadStrings = {
	error: {
		courseNotFound: 'uploads.sections.error.courseNotFound', // curso no registrado en el sistema
		courseNotInStudyPlan: 'uploads.sections.error.courseNotInStudyPlan', // curso no está en la malla del período
		professorNotFound: 'uploads.sections.error.professorNotFound', // docente no registrado
		campusNotFound: 'uploads.sections.error.campusNotFound', // sede no registrada
		sectionCodeEmpty: 'uploads.sections.error.sectionCodeEmpty', // código de sección vacío
		sectionAlreadyExists: 'uploads.sections.error.sectionAlreadyExists', // sección duplicada
		studyTypeEmpty: 'uploads.sections.error.studyTypeEmpty', // TipoEstudio vacío
		studyTypeInvalid: 'uploads.sections.error.studyTypeInvalid', // TipoEstudio inválido (usar P, V, S)
	},
	result: {
		uploadFailed: 'uploads.sections.result.uploadFailed', // se encontraron errores en la carga
		uploadSuccess: 'uploads.sections.result.uploadSuccess', // carga realizada exitosamente
	},
	file: {
		errorsFileName: 'ErroresCargaSeccion.xlsx',
	},
} as const;
