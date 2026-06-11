export const staffTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		email: 'Correo del usuario',
		professorCode: 'Código de docente',
		lastName: 'Apellidos',
		firstName: 'Nombres',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaDocentes.xlsx',
		templateFileName: 'PlantillaDocentes.xlsx',
	},
	en: {
		email: 'User email',
		professorCode: 'Professor code',
		lastName: 'Last name',
		firstName: 'First name',
		errorColumn: 'Error message',
		errorsFileName: 'ProfessorsUploadErrors.xlsx',
		templateFileName: 'ProfessorsTemplate.xlsx',
	},
};

export const staffErrorMessages: Record<string, Record<string, string>> = {
	es: {
		userNotFound: 'No existe un usuario con ese correo.',
		lastNameEmpty: 'Los apellidos son obligatorios.',
		firstNameEmpty: 'Los nombres son obligatorios.',
		duplicateEmailInFile: 'Correo duplicado en el archivo.',
		duplicateProfessorCodeInFile: 'Código de docente duplicado en el archivo.',
	},
	en: {
		userNotFound: 'No user exists with that email.',
		lastNameEmpty: 'Last name is required.',
		firstNameEmpty: 'First name is required.',
		duplicateEmailInFile: 'Duplicate email in the file.',
		duplicateProfessorCodeInFile: 'Duplicate professor code in the file.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
