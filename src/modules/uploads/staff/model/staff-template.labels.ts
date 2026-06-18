export const staffTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		professorCode: 'Código de docente',
		lastName: 'Apellidos',
		firstName: 'Nombres',
		email: 'Correo electrónico',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaDocentes.xlsx',
		templateFileName: 'PlantillaDocentes.xlsx',
	},
	en: {
		professorCode: 'Professor code',
		lastName: 'Last name',
		firstName: 'First name',
		email: 'Email',
		errorColumn: 'Error message',
		errorsFileName: 'ProfessorsUploadErrors.xlsx',
		templateFileName: 'ProfessorsTemplate.xlsx',
	},
};

export const staffErrorMessages: Record<string, Record<string, string>> = {
	es: {
		lastNameEmpty: 'Los apellidos son obligatorios.',
		lastNameTooLong: 'Los apellidos superan el largo máximo permitido (255 caracteres).',
		firstNameEmpty: 'Los nombres son obligatorios.',
		firstNameTooLong: 'Los nombres superan el largo máximo permitido (255 caracteres).',
		professorCodeTooLong: 'El código de docente supera el largo máximo permitido (50 caracteres).',
		emailTooLong: 'El correo electrónico supera el largo máximo permitido (255 caracteres).',
		duplicateProfessorCodeInFile: 'Código de docente duplicado en el archivo.',
	},
	en: {
		lastNameEmpty: 'Last name is required.',
		lastNameTooLong: 'Last name exceeds the maximum allowed length (255 characters).',
		firstNameEmpty: 'First name is required.',
		firstNameTooLong: 'First name exceeds the maximum allowed length (255 characters).',
		professorCodeTooLong: 'Professor code exceeds the maximum allowed length (50 characters).',
		emailTooLong: 'Email exceeds the maximum allowed length (255 characters).',
		duplicateProfessorCodeInFile: 'Duplicate professor code in the file.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
