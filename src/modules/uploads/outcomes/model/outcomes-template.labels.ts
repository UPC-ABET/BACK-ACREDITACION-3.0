export const outcomesTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		outcomeCode: 'Código del outcome',
		outcomeName: 'Nombre',
		outcomeDescription: 'Descripción',
		commissionCode: 'Código de la comisión',
		programCode: 'Código de la carrera',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaOutcomes.xlsx',
		templateFileName: 'PlantillaOutcomes.xlsx',
	},
	en: {
		outcomeCode: 'Outcome code',
		outcomeName: 'Name',
		outcomeDescription: 'Description',
		commissionCode: 'Commission code',
		programCode: 'Program code',
		errorColumn: 'Error message',
		errorsFileName: 'OutcomesUploadErrors.xlsx',
		templateFileName: 'OutcomesTemplate.xlsx',
	},
};

export const outcomesErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código de outcome duplicado en el archivo.',
		outcomeCodeEmpty: 'El código del outcome es obligatorio.',
		outcomeCodeTooLong:
			'El código del outcome (comisión-carrera-outcome) supera el largo máximo permitido (50 caracteres).',
		outcomeNameEmpty: 'El nombre del outcome es obligatorio.',
		programNotFound: 'No existe una carrera con ese código.',
		programModalityMismatch: 'La carrera no corresponde a la modalidad del período académico.',
		commissionNotFound: 'No existe una comisión con ese código.',
		programCommissionNotFound: 'No existe una comisión asignada a la carrera en este período.',
		outcomeCodeConflict: 'El código del outcome ya está asignado a otra comisión.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate outcome code in the file.',
		outcomeCodeEmpty: 'Outcome code is required.',
		outcomeCodeTooLong:
			'The outcome code (commission-program-outcome) exceeds the maximum allowed length (50 characters).',
		outcomeNameEmpty: 'Outcome name is required.',
		programNotFound: 'No program exists with that code.',
		programModalityMismatch: 'The program does not match the academic period modality.',
		commissionNotFound: 'No commission exists with that code.',
		programCommissionNotFound: 'No commission is assigned to the program for this period.',
		outcomeCodeConflict: 'The outcome code is already assigned to another commission.',
	},
};

export const languageDisplayNames: Record<string, Record<string, string>> = {
	es: { es: 'Español', en: 'Inglés' },
	en: { es: 'Spanish', en: 'English' },
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
