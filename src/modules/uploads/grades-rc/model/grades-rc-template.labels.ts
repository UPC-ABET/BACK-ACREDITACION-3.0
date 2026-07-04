export const gradesRcTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		sectionCode: 'Código de sección',
		studentCode: 'Código del alumno',
		gradeTypeCode: 'Código de tipo de nota',
		gradeTypePercentage: 'Peso del tipo de nota (%)',
		grade: 'Nota',
		qualificationStatusCode: 'Código de estado de calificación',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaNotasRC.xlsx',
		templateFileName: 'PlantillaNotasRC.xlsx',
		instructionsTitle: 'Instrucciones de llenado',
		instructionsColField: 'Campo',
		instructionsColDescription: 'Descripción',
		instructionsColRequired: 'Obligatorio',
		instructionsColExample: 'Ejemplo',
		instructionsYes: 'Sí',
		instructionsNo: 'No',
		gradeTypesTitle: 'Tipos de nota disponibles',
		qualificationStatusTypesTitle: 'Tipos de estado de calificación disponibles',
		legendColCode: 'Código',
		legendColName: 'Nombre',
	},
	en: {
		sectionCode: 'Section code',
		studentCode: 'Student code',
		gradeTypeCode: 'Grade type code',
		gradeTypePercentage: 'Grade type weight (%)',
		grade: 'Grade',
		qualificationStatusCode: 'Qualification status code',
		errorColumn: 'Error message',
		errorsFileName: 'GradesRcUploadErrors.xlsx',
		templateFileName: 'GradesRcTemplate.xlsx',
		instructionsTitle: 'Fill instructions',
		instructionsColField: 'Field',
		instructionsColDescription: 'Description',
		instructionsColRequired: 'Required',
		instructionsColExample: 'Example',
		instructionsYes: 'Yes',
		instructionsNo: 'No',
		gradeTypesTitle: 'Available grade types',
		qualificationStatusTypesTitle: 'Available qualification status types',
		legendColCode: 'Code',
		legendColName: 'Name',
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
		qualificationStatusEmpty: 'El código de estado de calificación es obligatorio.',
		qualificationStatusInvalid: 'El código de estado de calificación no es válido.',
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
		qualificationStatusEmpty: 'Qualification status code is required.',
		qualificationStatusInvalid: 'The qualification status code is not valid.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';

export interface FieldInstruction {
	field: string;
	description: string;
	required: boolean;
	example: string;
}

export const gradesRcFieldInstructions: Record<string, FieldInstruction[]> = {
	es: [
		{
			field: 'Código de sección',
			description: 'Código de la sección en la que está matriculado el alumno.',
			required: true,
			example: 'CS401-S1',
		},
		{
			field: 'Código del alumno',
			description: 'Código del alumno matriculado en la sección.',
			required: true,
			example: '20201234567',
		},
		{
			field: 'Código de tipo de nota',
			description: 'Código del tipo de evaluación. Debe existir en el grupo de tipos TG205.',
			required: true,
			example: 'TG205-T008',
		},
		{
			field: 'Peso del tipo de nota (%)',
			description: 'Peso porcentual de este tipo de nota en el curso.',
			required: true,
			example: '20',
		},
		{
			field: 'Nota',
			description: 'Nota obtenida por el alumno en este tipo de evaluación.',
			required: true,
			example: '15.5',
		},
		{
			field: 'Código de estado de calificación',
			description:
				'Código del estado de calificación del alumno para esta evaluación. Debe existir en el ' +
				'grupo de tipos TG404 (ej. ASISTIO, NR, NA, DPI, RET, SAN). Obligatorio en todas las filas.',
			required: true,
			example: 'ASISTIO',
		},
	],
	en: [
		{
			field: 'Section code',
			description: 'Code of the section in which the student is enrolled.',
			required: true,
			example: 'CS401-S1',
		},
		{
			field: 'Student code',
			description: 'Code of the student enrolled in the section.',
			required: true,
			example: '20201234567',
		},
		{
			field: 'Grade type code',
			description: 'Code of the evaluation type. Must exist in type group TG205.',
			required: true,
			example: 'TG205-T008',
		},
		{
			field: 'Grade type weight (%)',
			description: 'Percentage weight of this grade type in the course.',
			required: true,
			example: '20',
		},
		{
			field: 'Grade',
			description: 'Grade obtained by the student for this evaluation type.',
			required: true,
			example: '15.5',
		},
		{
			field: 'Qualification status code',
			description:
				'Code of the student qualification status for this evaluation. Must exist in type group ' +
				'TG404 (e.g. ASISTIO, NR, NA, DPI, RET, SAN). Required on every row.',
			required: true,
			example: 'ASISTIO',
		},
	],
};
