export const classRepresentativesTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		sectionCode: 'Código de sección',
		studentCode: 'Código del alumno',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaDelegados.xlsx',
		templateFileName: 'PlantillaDelegados.xlsx',
	},
	en: {
		sectionCode: 'Section code',
		studentCode: 'Student code',
		errorColumn: 'Error message',
		errorsFileName: 'ClassRepresentativesUploadErrors.xlsx',
		templateFileName: 'ClassRepresentativesTemplate.xlsx',
	},
};

export const classRepresentativesErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateRowInFile: 'Fila duplicada en el archivo (misma sección y alumno).',
		sectionCodeEmpty: 'El código de sección es obligatorio.',
		sectionNotFound: 'No existe una sección con ese código.',
		studentCodeEmpty: 'El código del alumno es obligatorio.',
		studentNotFound: 'No existe un alumno con ese código.',
		sectionAlreadyHasRepresentative: 'La sección ya tiene un delegado.',
	},
	en: {
		duplicateRowInFile: 'Duplicate row in the file (same section and student).',
		sectionCodeEmpty: 'Section code is required.',
		sectionNotFound: 'No section exists with that code.',
		studentCodeEmpty: 'Student code is required.',
		studentNotFound: 'No student exists with that code.',
		sectionAlreadyHasRepresentative: 'This section already has a class representative.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
