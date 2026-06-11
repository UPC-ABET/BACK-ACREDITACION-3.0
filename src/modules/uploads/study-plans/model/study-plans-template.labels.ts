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
		programNotFound: 'La carrera indicada no existe.',
		courseCodeEmpty: 'El código de curso es obligatorio.',
		courseNameEmpty: 'El nombre de curso es obligatorio.',
		levelTypeInvalid: 'El nivel indicado no es válido.',
		courseAlreadyInStudyPlan: 'El curso ya está registrado en la malla para el periodo.',
		duplicateRowInFile: 'Fila duplicada en el archivo (misma malla y curso).',
	},
	en: {
		studyPlanCodeEmpty: 'Study plan code is required.',
		programNotFound: 'The specified program does not exist.',
		courseCodeEmpty: 'Course code is required.',
		courseNameEmpty: 'Course name is required.',
		levelTypeInvalid: 'The level is not valid.',
		courseAlreadyInStudyPlan: 'The course is already in the study plan for this period.',
		duplicateRowInFile: 'Duplicate row in the file (same study plan and course).',
	},
};

export const languageDisplayNames: Record<string, Record<string, string>> = {
	es: { es: 'Español', en: 'Inglés' },
	en: { es: 'Spanish', en: 'English' },
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
