export const studyPlansTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		studyPlanCode: 'Código de malla',
		studyPlanName: 'Nombre de malla',
		programCode: 'Código de carrera',
		levelTypeCode: 'Código de nivel',
		courseCode: 'Código de curso',
		courseName: 'Nombre de curso',
		learningOutcome: 'Resultado de aprendizaje',
		elective: 'Electivo (X)',
		legendSheet: 'Leyenda',
		legendCode: 'Código',
		legendName: 'Nivel',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaMalla.xlsx',
		templateFileName: 'PlantillaMallaCurricular.xlsx',
	},
	en: {
		studyPlanCode: 'Study plan code',
		studyPlanName: 'Study plan name',
		programCode: 'Program code',
		levelTypeCode: 'Level code',
		courseCode: 'Course code',
		courseName: 'Course name',
		learningOutcome: 'Learning outcome',
		elective: 'Elective (X)',
		legendSheet: 'Legend',
		legendCode: 'Code',
		legendName: 'Level',
		errorColumn: 'Error message',
		errorsFileName: 'StudyPlanUploadErrors.xlsx',
		templateFileName: 'StudyPlanTemplate.xlsx',
	},
};

export const languageDisplayNames: Record<string, Record<string, string>> = {
	es: { es: 'Español', en: 'Inglés' },
	en: { es: 'Spanish', en: 'English' },
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
