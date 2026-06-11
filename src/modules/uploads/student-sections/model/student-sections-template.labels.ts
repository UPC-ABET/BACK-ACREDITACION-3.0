export const studentSectionsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		sectionCode: 'Código de sección',
		studentCode: 'Código del alumno',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaAlumnoSeccion.xlsx',
		templateFileName: 'PlantillaAlumnoSeccion.xlsx',
	},
	en: {
		sectionCode: 'Section code',
		studentCode: 'Student code',
		errorColumn: 'Error message',
		errorsFileName: 'StudentSectionUploadErrors.xlsx',
		templateFileName: 'StudentSectionTemplate.xlsx',
	},
};

export const studentSectionsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateRowInFile: 'Fila duplicada en el archivo (misma sección y alumno).',
		sectionCodeEmpty: 'El código de sección es obligatorio.',
		sectionNotFound: 'No existe una sección con ese código.',
		studentCodeEmpty: 'El código del alumno es obligatorio.',
		studentNotFound: 'No existe un alumno con ese código.',
		studyPlanPeriodMismatch:
			'El alumno no está matriculado en el mismo plan de estudios y período que la sección.',
	},
	en: {
		duplicateRowInFile: 'Duplicate row in the file (same section and student).',
		sectionCodeEmpty: 'Section code is required.',
		sectionNotFound: 'No section exists with that code.',
		studentCodeEmpty: 'Student code is required.',
		studentNotFound: 'No student exists with that code.',
		studyPlanPeriodMismatch:
			'The student is not enrolled in the same study plan and period as the section.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
