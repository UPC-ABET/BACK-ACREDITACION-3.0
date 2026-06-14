export const chartsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		code: 'Id',
		parentCode: 'Padre',
		title: 'Unidad académica',
		professorCode: 'Código de docente',
		email: 'Correo del responsable',
		entityType: 'Tipo de entidad',
		entityCode: 'Código de entidad',
		entityLegendSheet: 'Tipos de entidad',
		legendCode: 'Código',
		legendName: 'Descripción',
		legendEntityCodeUsage: '¿Requiere código de entidad?',
		legendYes: 'Sí',
		legendNo: 'No',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaOrganigrama.xlsx',
		templateFileName: 'PlantillaOrganigrama.xlsx',
	},
	en: {
		code: 'Id',
		parentCode: 'Parent',
		title: 'Academic unit',
		professorCode: 'Professor code',
		email: 'Responsible email',
		entityType: 'Entity type',
		entityCode: 'Entity code',
		entityLegendSheet: 'Entity types',
		legendCode: 'Code',
		legendName: 'Description',
		legendEntityCodeUsage: 'Requires entity code?',
		legendYes: 'Yes',
		legendNo: 'No',
		errorColumn: 'Error message',
		errorsFileName: 'OrgChartUploadErrors.xlsx',
		templateFileName: 'OrgChartTemplate.xlsx',
	},
};

// Human-readable text for the downloadable error report. The PG function returns stable short codes
// (e.g. 'professorNotFound'); the frontend never sees the generated Excel, so we resolve each code to
// localized text here before writing the error column.
export const chartsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código duplicado en el archivo.',
		codeEmpty: 'El código del nodo es obligatorio.',
		titleEmpty: 'El título es obligatorio.',
		professorCodeEmpty: 'El código de docente es obligatorio.',
		professorNotFound: 'No existe un docente con ese código.',
		emailEmpty: 'El correo del responsable es obligatorio.',
		emailTooLong: 'El correo del responsable supera el largo máximo permitido (255 caracteres).',
		inconsistentEmailForProfessor:
			'El mismo código de docente aparece con correos distintos en el archivo.',
		inconsistentProfessorForEmail:
			'El mismo correo aparece con códigos de docente distintos en el archivo.',
		entityCodeWithoutType: 'Indicó un código de entidad sin tipo de entidad.',
		entityTypeInvalid: 'El código de tipo de entidad no es válido.',
		entityNotFound: 'No existe la entidad indicada para ese tipo.',
		parentNotFound: 'El código del padre no existe en el archivo.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate code in the file.',
		codeEmpty: 'Node code is required.',
		titleEmpty: 'Title is required.',
		professorCodeEmpty: 'Professor code is required.',
		professorNotFound: 'No professor exists with that code.',
		emailEmpty: 'Responsible email is required.',
		emailTooLong: 'Responsible email exceeds the maximum allowed length (255 characters).',
		inconsistentEmailForProfessor:
			'The same professor code appears with different emails in the file.',
		inconsistentProfessorForEmail:
			'The same email appears with different professor codes in the file.',
		entityCodeWithoutType: 'An entity code was provided without an entity type.',
		entityTypeInvalid: 'The entity type code is not valid.',
		entityNotFound: 'No entity exists with that code for the given type.',
		parentNotFound: 'The parent code does not exist in the file.',
	},
};

export const languageDisplayNames: Record<string, Record<string, string>> = {
	es: { es: 'Español', en: 'Inglés' },
	en: { es: 'Spanish', en: 'English' },
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
