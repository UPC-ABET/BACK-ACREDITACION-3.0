export const enrolledStudentsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		studentCode: 'Código del alumno',
		email: 'Correo del usuario',
		programCode: 'Código del programa',
		studyPlanCode: 'Código del plan de estudios',
		campusCode: 'Código del campus',
		enrollmentModalityTypeCode: 'Código de modalidad de matrícula',
		legendSheet: 'Modalidades de matrícula',
		legendCode: 'Código',
		legendName: 'Modalidad de matrícula',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaMatriculados.xlsx',
		templateFileName: 'PlantillaMatriculados.xlsx',
	},
	en: {
		studentCode: 'Student code',
		email: 'User email',
		programCode: 'Program code',
		studyPlanCode: 'Study plan code',
		campusCode: 'Campus code',
		enrollmentModalityTypeCode: 'Enrollment modality code',
		legendSheet: 'Enrollment modalities',
		legendCode: 'Code',
		legendName: 'Enrollment modality',
		errorColumn: 'Error message',
		errorsFileName: 'EnrolledStudentsUploadErrors.xlsx',
		templateFileName: 'EnrolledStudentsTemplate.xlsx',
	},
};

export const enrolledStudentsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código de alumno duplicado en el archivo.',
		studentCodeEmpty: 'El código del alumno es obligatorio.',
		emailEmpty: 'El correo del usuario es obligatorio.',
		userNotFound: 'No existe un usuario con ese correo.',
		programNotFound: 'No existe un programa con ese código.',
		studyPlanCodeEmpty: 'El código del plan de estudios es obligatorio.',
		studyPlanPeriodNotFound: 'No existe el plan de estudios para el período indicado.',
		campusNotFound: 'No existe un campus con ese código.',
		enrollmentModalityInvalid: 'El código de modalidad de matrícula no es válido.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate student code in the file.',
		studentCodeEmpty: 'Student code is required.',
		emailEmpty: 'User email is required.',
		userNotFound: 'No user exists with that email.',
		programNotFound: 'No program exists with that code.',
		studyPlanCodeEmpty: 'Study plan code is required.',
		studyPlanPeriodNotFound: 'The study plan does not exist for the given period.',
		campusNotFound: 'No campus exists with that code.',
		enrollmentModalityInvalid: 'The enrollment modality code is not valid.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
