export const staffTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		email: 'Correo del usuario',
		positionTypeCode: 'Código de cargo',
		jobTitle: 'Cargo',
		professorCode: 'Código de docente',
		legendSheet: 'Leyenda',
		legendCode: 'Código',
		legendName: 'Cargo',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaPersonal.xlsx',
		templateFileName: 'PlantillaPersonal.xlsx',
	},
	en: {
		email: 'User email',
		positionTypeCode: 'Position code',
		jobTitle: 'Job title',
		professorCode: 'Professor code',
		legendSheet: 'Legend',
		legendCode: 'Code',
		legendName: 'Position',
		errorColumn: 'Error message',
		errorsFileName: 'StaffUploadErrors.xlsx',
		templateFileName: 'StaffTemplate.xlsx',
	},
};

export const staffErrorMessages: Record<string, Record<string, string>> = {
	es: {
		emailEmpty: 'El correo del usuario es obligatorio.',
		userNotFound: 'No existe un usuario con ese correo.',
		positionTypeInvalid: 'El código de cargo no es válido.',
		duplicateEmailInFile: 'Correo duplicado en el archivo.',
		duplicateProfessorCodeInFile: 'Código de docente duplicado en el archivo.',
	},
	en: {
		emailEmpty: 'User email is required.',
		userNotFound: 'No user exists with that email.',
		positionTypeInvalid: 'The position code is not valid.',
		duplicateEmailInFile: 'Duplicate email in the file.',
		duplicateProfessorCodeInFile: 'Duplicate professor code in the file.',
	},
};

export const languageDisplayNames: Record<string, Record<string, string>> = {
	es: { es: 'Español', en: 'Inglés' },
	en: { es: 'Spanish', en: 'English' },
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
