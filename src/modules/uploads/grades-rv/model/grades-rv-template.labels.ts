export const gradesRvTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		sectionCode: 'Código de sección',
		studentCode: 'Código del alumno',
		outcomeCode: 'Código del outcome',
		grade: 'Nota',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaNotasRV.xlsx',
		templateFileName: 'PlantillaNotasRV.xlsx',
	},
	en: {
		sectionCode: 'Section code',
		studentCode: 'Student code',
		outcomeCode: 'Outcome code',
		grade: 'Grade',
		errorColumn: 'Error message',
		errorsFileName: 'GradesRvUploadErrors.xlsx',
		templateFileName: 'GradesRvTemplate.xlsx',
	},
};

export const gradesRvErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateRowInFile: 'Fila duplicada en el archivo (sección, alumno y outcome repetidos).',
		sectionCodeEmpty: 'El código de sección es obligatorio.',
		sectionNotFound: 'No existe una sección con ese código.',
		studentCodeEmpty: 'El código del alumno es obligatorio.',
		studentNotFound: 'No existe un alumno con ese código.',
		enrollmentNotFound: 'El alumno no está matriculado en esa sección.',
		outcomeCodeEmpty: 'El código del outcome es obligatorio.',
		outcomeNotFound: 'No existe un outcome con ese código.',
		outcomeNotInSection: 'El outcome no está asociado al curso de esa sección.',
		gradeEmpty: 'La nota es obligatoria.',
		gradeInvalid: 'La nota no es un número válido.',
	},
	en: {
		duplicateRowInFile: 'Duplicate row in the file (section, student and outcome repeated).',
		sectionCodeEmpty: 'Section code is required.',
		sectionNotFound: 'No section exists with that code.',
		studentCodeEmpty: 'Student code is required.',
		studentNotFound: 'No student exists with that code.',
		enrollmentNotFound: 'The student is not enrolled in that section.',
		outcomeCodeEmpty: 'Outcome code is required.',
		outcomeNotFound: 'No outcome exists with that code.',
		outcomeNotInSection: "The outcome is not associated with the section's course.",
		gradeEmpty: 'Grade is required.',
		gradeInvalid: 'The grade is not a valid number.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
