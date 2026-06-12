export const enrolledStudentsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		studentCode: 'Código del alumno',
		lastName: 'Apellidos',
		firstName: 'Nombres',
		programCode: 'Código del programa',
		campusCode: 'Código del campus',
		enrollmentModalityTypeCode: 'Código de modalidad de matrícula',
		email: 'Correo del usuario',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaMatriculados.xlsx',
		templateFileName: 'PlantillaMatriculados.xlsx',
	},
	en: {
		studentCode: 'Student code',
		lastName: 'Last name',
		firstName: 'First name',
		programCode: 'Program code',
		campusCode: 'Campus code',
		enrollmentModalityTypeCode: 'Enrollment modality code',
		email: 'User email',
		errorColumn: 'Error message',
		errorsFileName: 'EnrolledStudentsUploadErrors.xlsx',
		templateFileName: 'EnrolledStudentsTemplate.xlsx',
	},
};

export const enrolledStudentsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código de alumno duplicado en el archivo.',
		studentCodeEmpty: 'El código del alumno es obligatorio.',
		studentCodeTooLong: 'El código del alumno supera el largo máximo permitido (50 caracteres).',
		lastNameEmpty: 'Los apellidos son obligatorios.',
		lastNameTooLong: 'Los apellidos superan el largo máximo permitido (255 caracteres).',
		firstNameEmpty: 'Los nombres son obligatorios.',
		firstNameTooLong: 'Los nombres superan el largo máximo permitido (255 caracteres).',
		userNotFound: 'No existe un usuario con ese correo.',
		programNotFound: 'No existe un programa con ese código.',
		studyPlanPeriodNotFound: 'No existe un plan de estudios para ese programa en el período.',
		campusNotFound: 'No existe un campus con ese código.',
		enrollmentModalityInvalid: 'El código de modalidad de matrícula no es válido. Use P, S o V.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate student code in the file.',
		studentCodeEmpty: 'Student code is required.',
		studentCodeTooLong: 'Student code exceeds the maximum allowed length (50 characters).',
		lastNameEmpty: 'Last name is required.',
		lastNameTooLong: 'Last name exceeds the maximum allowed length (255 characters).',
		firstNameEmpty: 'First name is required.',
		firstNameTooLong: 'First name exceeds the maximum allowed length (255 characters).',
		userNotFound: 'No user exists with that email.',
		programNotFound: 'No program exists with that code.',
		studyPlanPeriodNotFound: 'No study plan exists for that program in the period.',
		campusNotFound: 'No campus exists with that code.',
		enrollmentModalityInvalid: 'The enrollment modality code is not valid. Use P, S or V.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
