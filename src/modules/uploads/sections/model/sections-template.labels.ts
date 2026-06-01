export const sectionsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		studyPlanCode: 'Código del plan de estudios',
		courseCode: 'Código del curso',
		campusCode: 'Código del campus',
		professorCode: 'Código del docente',
		sectionModalityTypeCode: 'Código de modalidad de sección',
		sectionCode: 'Código de sección',
		legendSheet: 'Modalidades de sección',
		legendCode: 'Código',
		legendName: 'Modalidad de sección',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaSecciones.xlsx',
		templateFileName: 'PlantillaSecciones.xlsx',
	},
	en: {
		studyPlanCode: 'Study plan code',
		courseCode: 'Course code',
		campusCode: 'Campus code',
		professorCode: 'Professor code',
		sectionModalityTypeCode: 'Section modality code',
		sectionCode: 'Section code',
		legendSheet: 'Section modalities',
		legendCode: 'Code',
		legendName: 'Section modality',
		errorColumn: 'Error message',
		errorsFileName: 'SectionsUploadErrors.xlsx',
		templateFileName: 'SectionsTemplate.xlsx',
	},
};

export const sectionsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código de sección duplicado en el archivo.',
		sectionCodeEmpty: 'El código de sección es obligatorio.',
		studyPlanCodeEmpty: 'El código del plan de estudios es obligatorio.',
		courseCodeEmpty: 'El código del curso es obligatorio.',
		studyPlanCourseNotFound: 'No existe el curso en ese plan de estudios para el período.',
		campusNotFound: 'No existe un campus con ese código.',
		professorNotFound: 'No existe un docente con ese código.',
		sectionModalityInvalid: 'El código de modalidad de sección no es válido.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate section code in the file.',
		sectionCodeEmpty: 'Section code is required.',
		studyPlanCodeEmpty: 'Study plan code is required.',
		courseCodeEmpty: 'Course code is required.',
		studyPlanCourseNotFound: 'The course does not exist in that study plan for the period.',
		campusNotFound: 'No campus exists with that code.',
		professorNotFound: 'No professor exists with that code.',
		sectionModalityInvalid: 'The section modality code is not valid.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
