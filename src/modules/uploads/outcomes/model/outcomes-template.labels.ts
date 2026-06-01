export const outcomesTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		outcomeCode: 'Código del outcome',
		outcomeName: 'Nombre del outcome',
		programCode: 'Código del programa',
		commissionCode: 'Código de la comisión',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaOutcomes.xlsx',
		templateFileName: 'PlantillaOutcomes.xlsx',
	},
	en: {
		outcomeCode: 'Outcome code',
		outcomeName: 'Outcome name',
		programCode: 'Program code',
		commissionCode: 'Commission code',
		errorColumn: 'Error message',
		errorsFileName: 'OutcomesUploadErrors.xlsx',
		templateFileName: 'OutcomesTemplate.xlsx',
	},
};

export const outcomesErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código de outcome duplicado en el archivo.',
		outcomeCodeEmpty: 'El código del outcome es obligatorio.',
		outcomeNameEmpty: 'El nombre del outcome es obligatorio.',
		programNotFound: 'No existe un programa con ese código.',
		commissionNotFound: 'No existe una comisión con ese código.',
		programCommissionNotFound: 'No existe una comisión asignada al programa en este período.',
		outcomeCodeConflict: 'El código del outcome ya está asignado a otra comisión.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate outcome code in the file.',
		outcomeCodeEmpty: 'Outcome code is required.',
		outcomeNameEmpty: 'Outcome name is required.',
		programNotFound: 'No program exists with that code.',
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
