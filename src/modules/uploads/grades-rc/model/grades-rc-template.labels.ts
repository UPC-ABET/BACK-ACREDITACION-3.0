export const gradesRcTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		sectionCode: 'Código de sección',
		studentCode: 'Código del alumno',
		gradeTypeCode: 'Código de tipo de nota',
		gradeTypePercentage: 'Peso del tipo de nota (%)',
		grade: 'Nota',
		legendSheet: 'Tipos de nota',
		legendCode: 'Código',
		legendName: 'Tipo de nota',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaNotasRC.xlsx',
		templateFileName: 'PlantillaNotasRC.xlsx',
	},
	en: {
		sectionCode: 'Section code',
		studentCode: 'Student code',
		gradeTypeCode: 'Grade type code',
		gradeTypePercentage: 'Grade type weight (%)',
		grade: 'Grade',
		legendSheet: 'Grade types',
		legendCode: 'Code',
		legendName: 'Grade type',
		errorColumn: 'Error message',
		errorsFileName: 'GradesRcUploadErrors.xlsx',
		templateFileName: 'GradesRcTemplate.xlsx',
	},
};

export const gradesRcErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateRowInFile: 'Fila duplicada en el archivo (sección, alumno y tipo de nota repetidos).',
		sectionCodeEmpty: 'El código de sección es obligatorio.',
		sectionNotFound: 'No existe una sección con ese código.',
		studentCodeEmpty: 'El código del alumno es obligatorio.',
		studentNotFound: 'No existe un alumno con ese código.',
		enrollmentNotFound: 'El alumno no está matriculado en esa sección.',
		gradeTypeEmpty: 'El código de tipo de nota es obligatorio.',
		gradeTypeInvalid: 'El código de tipo de nota no es válido.',
		gradeTypePercentageInvalid: 'El peso del tipo de nota no es un número válido.',
		gradeEmpty: 'La nota es obligatoria.',
		gradeInvalid: 'La nota no es un número válido.',
	},
	en: {
		duplicateRowInFile: 'Duplicate row in the file (section, student and grade type repeated).',
		sectionCodeEmpty: 'Section code is required.',
		sectionNotFound: 'No section exists with that code.',
		studentCodeEmpty: 'Student code is required.',
		studentNotFound: 'No student exists with that code.',
		enrollmentNotFound: 'The student is not enrolled in that section.',
		gradeTypeEmpty: 'Grade type code is required.',
		gradeTypeInvalid: 'The grade type code is not valid.',
		gradeTypePercentageInvalid: 'The grade type weight is not a valid number.',
		gradeEmpty: 'Grade is required.',
		gradeInvalid: 'The grade is not a valid number.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
