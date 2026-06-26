export const studyPlansTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		studyPlanCode: 'Código de malla',
		studyPlanName: 'Nombre de malla',
		programCode: 'Código de carrera',
		level: 'Nivel',
		courseCode: 'Código de curso',
		courseName: 'Nombre de curso',
		learningOutcome: 'Logro',
		elective: 'Electivo (SI/NO)',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaMalla.xlsx',
		templateFileName: 'PlantillaMallaCurricular.xlsx',
	},
	en: {
		studyPlanCode: 'Study plan code',
		studyPlanName: 'Study plan name',
		programCode: 'Program code',
		level: 'Level',
		courseCode: 'Course code',
		courseName: 'Course name',
		learningOutcome: 'Learning outcome',
		elective: 'Elective (YES/NO)',
		errorColumn: 'Error message',
		errorsFileName: 'StudyPlanUploadErrors.xlsx',
		templateFileName: 'StudyPlanTemplate.xlsx',
	},
};

export const studyPlansErrorMessages: Record<string, Record<string, string>> = {
	es: {
		studyPlanCodeEmpty: 'El código de malla es obligatorio.',
		studyPlanCodeTooLong: 'El código de malla supera el largo máximo permitido (20 caracteres).',
		studyPlanCodeExists: 'El código de malla ya está registrado para otra carrera o periodo.',
		studyPlanCodeConflictInFile:
			'El mismo código de malla se usa para más de una carrera en el archivo.',
		programNotFound: 'La carrera indicada no existe.',
		programModalityMismatch: 'La carrera no corresponde a la modalidad del período académico.',
		courseCodeEmpty: 'El código de curso es obligatorio.',
		courseCodeTooLong: 'El código de curso supera el largo máximo permitido (50 caracteres).',
		courseNameEmpty: 'El nombre de curso es obligatorio.',
		levelTypeInvalid: 'El nivel indicado no es válido.',
		courseAlreadyInStudyPlan: 'El curso ya está registrado en la malla para el periodo.',
		duplicateRowInFile: 'Fila duplicada en el archivo (misma carrera y curso).',
	},
	en: {
		studyPlanCodeEmpty: 'Study plan code is required.',
		studyPlanCodeTooLong: 'Study plan code exceeds the maximum allowed length (20 characters).',
		studyPlanCodeExists: 'The study plan code is already registered for another program or period.',
		studyPlanCodeConflictInFile:
			'The same study plan code is used for more than one program in the file.',
		programNotFound: 'The specified program does not exist.',
		programModalityMismatch: 'The program does not match the academic period modality.',
		courseCodeEmpty: 'Course code is required.',
		courseCodeTooLong: 'Course code exceeds the maximum allowed length (50 characters).',
		courseNameEmpty: 'Course name is required.',
		levelTypeInvalid: 'The level is not valid.',
		courseAlreadyInStudyPlan: 'The course is already in the study plan for this period.',
		duplicateRowInFile: 'Duplicate row in the file (same program and course).',
	},
};

export const languageDisplayNames: Record<string, Record<string, string>> = {
	es: { es: 'Español', en: 'Inglés' },
	en: { es: 'Spanish', en: 'English' },
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
