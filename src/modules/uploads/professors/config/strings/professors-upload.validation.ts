// Mensajes de validación — claves i18n (se resuelven en el front vía tryTranslate).
// Réplica funcional de las validaciones de USP_DocenteCargaMasiva (ABET 2.0).
export const professorsUploadStrings = {
	error: {
		userNameEmpty: 'uploads.professors.error.userNameEmpty', // username (correo) vacío
		nameEmpty: 'uploads.professors.error.nameEmpty', // nombre completo vacío
		professorAlreadyExists: 'uploads.professors.error.professorAlreadyExists', // docente ya registrado (staff.code/staff_email duplicado)
		positionTypeMissing: 'uploads.professors.error.positionTypeMissing', // catálogo DOCENTE no encontrado en core.types
	},
	result: {
		uploadFailed: 'uploads.professors.result.uploadFailed',
		uploadSuccess: 'uploads.professors.result.uploadSuccess',
	},
	file: {
		errorsFileName: 'ErroresCargaDocentes.xlsx',
	},
} as const;
