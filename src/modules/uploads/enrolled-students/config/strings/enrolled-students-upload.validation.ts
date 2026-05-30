// Mensajes de validación — claves i18n (se resuelven en el front vía tryTranslate).
// Réplica funcional de las validaciones de USP_AlumnoMatriculadoCargaMasiva (ABET 2.0).
export const enrolledStudentsUploadStrings = {
	error: {
		studentCodeEmpty: 'uploads.enrolledStudents.error.studentCodeEmpty', // código de alumno vacío
		fullNameEmpty: 'uploads.enrolledStudents.error.fullNameEmpty', // nombre completo vacío
		programNotFound: 'uploads.enrolledStudents.error.programNotFound', // carrera no registrada
		campusNotFound: 'uploads.enrolledStudents.error.campusNotFound', // sede no registrada
		enrollmentStatusEmpty: 'uploads.enrolledStudents.error.enrollmentStatusEmpty', // estado de matrícula vacío
		enrollmentStatusInvalid: 'uploads.enrolledStudents.error.enrollmentStatusInvalid', // estado de matrícula no reconocido
		studentAlreadyExists: 'uploads.enrolledStudents.error.studentAlreadyExists', // alumno ya matriculado en el período
	},
	result: {
		uploadFailed: 'uploads.enrolledStudents.result.uploadFailed',
		uploadSuccess: 'uploads.enrolledStudents.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaAlumnosMatriculados.xlsx',
	},
} as const;
