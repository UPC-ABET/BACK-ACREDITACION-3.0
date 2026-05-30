// Mensajes de validación — claves i18n. Réplica funcional de USP_AlumnoSeccionCargaMasiva (ABET 2.0).
export const studentSectionsUploadStrings = {
	error: {
		courseCodeEmpty: 'uploads.studentSections.error.courseCodeEmpty',
		sectionNotFound: 'uploads.studentSections.error.sectionNotFound', // curso+sección no registrada
		studentCodeEmpty: 'uploads.studentSections.error.studentCodeEmpty',
		studentNotEnrolled: 'uploads.studentSections.error.studentNotEnrolled', // alumno no matriculado en el período
		enrollmentAlreadyExists: 'uploads.studentSections.error.enrollmentAlreadyExists', // alumno ya en la sección
	},
	result: {
		uploadFailed: 'uploads.studentSections.result.uploadFailed',
		uploadSuccess: 'uploads.studentSections.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaAlumnoSeccion.xlsx',
	},
} as const;
