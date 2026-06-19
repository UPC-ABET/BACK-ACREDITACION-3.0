export const articulationTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		outcomeCode: 'Código del outcome',
		studyPlanCode: 'Código de la malla curricular',
		courseCode: 'Código del curso',
		outcomeTypeCode: 'Código del tipo de outcome',
		legendSheet: 'Tipos de outcome',
		legendCode: 'Código',
		legendName: 'Tipo de outcome',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaArticulacion.xlsx',
		templateFileName: 'PlantillaArticulacion.xlsx',
	},
	en: {
		outcomeCode: 'Outcome code',
		studyPlanCode: 'Study plan code',
		courseCode: 'Course code',
		outcomeTypeCode: 'Outcome type code',
		legendSheet: 'Outcome types',
		legendCode: 'Code',
		legendName: 'Outcome type',
		errorColumn: 'Error message',
		errorsFileName: 'ArticulationUploadErrors.xlsx',
		templateFileName: 'ArticulationTemplate.xlsx',
	},
};

export const articulationErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateRowInFile: 'Fila duplicada en el archivo (mismo outcome, malla y curso).',
		outcomeCodeEmpty: 'El código del outcome es obligatorio.',
		outcomeNotFound: 'No existe un outcome con ese código.',
		studyPlanCodeEmpty: 'El código de la malla curricular es obligatorio.',
		courseCodeEmpty: 'El código del curso es obligatorio.',
		studyPlanCourseNotFound: 'No existe el curso en esa malla curricular para el período.',
		outcomeTypeInvalid: 'El código del tipo de outcome no es válido.',
	},
	en: {
		duplicateRowInFile: 'Duplicate row in the file (same outcome, plan and course).',
		outcomeCodeEmpty: 'Outcome code is required.',
		outcomeNotFound: 'No outcome exists with that code.',
		studyPlanCodeEmpty: 'Study plan code is required.',
		courseCodeEmpty: 'Course code is required.',
		studyPlanCourseNotFound: 'The course does not exist in that study plan for the period.',
		outcomeTypeInvalid: 'The outcome type code is not valid.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
