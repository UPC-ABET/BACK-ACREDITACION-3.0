export const sectionsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		courseCode: 'Código del curso',
		sectionCode: 'Código de sección',
		professorCode: 'Código de docente',
		campusCode: 'Código del campus',
		sectionModalityTypeCode: 'Código de modalidad de sección',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaSecciones.xlsx',
		templateFileName: 'PlantillaSecciones.xlsx',
	},
	en: {
		courseCode: 'Course code',
		sectionCode: 'Section code',
		professorCode: 'Professor code',
		campusCode: 'Campus code',
		sectionModalityTypeCode: 'Section modality code',
		errorColumn: 'Error message',
		errorsFileName: 'SectionsUploadErrors.xlsx',
		templateFileName: 'SectionsTemplate.xlsx',
	},
};

export const sectionsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código de sección duplicado en el archivo.',
		sectionCodeEmpty: 'El código de sección es obligatorio.',
		sectionCodeTooLong: 'El código de sección supera el largo máximo permitido (50 caracteres).',
		courseCodeEmpty: 'El código del curso es obligatorio.',
		courseNotFound: 'No existe un curso con ese código.',
		courseNotInStudyPlan: 'El curso no pertenece a ningún plan de estudios de este período.',
		campusNotFound: 'No existe un campus con ese código.',
		professorNotFound: 'No existe un docente con ese código.',
		sectionModalityInvalid: 'El código de modalidad de sección no es válido. Use P, S o V.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate section code in the file.',
		sectionCodeEmpty: 'Section code is required.',
		sectionCodeTooLong: 'Section code exceeds the maximum allowed length (50 characters).',
		courseCodeEmpty: 'Course code is required.',
		courseNotFound: 'No course exists with that code.',
		courseNotInStudyPlan: 'The course does not belong to any study plan for this period.',
		campusNotFound: 'No campus exists with that code.',
		professorNotFound: 'No professor exists with that code.',
		sectionModalityInvalid: 'The section modality code is not valid. Use P, S or V.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
