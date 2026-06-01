export const chartsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		code: 'Código',
		parentCode: 'Código del padre',
		levelTypeCode: 'Código de nivel',
		title: 'Título',
		email: 'Correo del responsable',
		entityTypeCode: 'Código de tipo de entidad',
		entityCode: 'Código de entidad',
		levelLegendSheet: 'Niveles',
		entityLegendSheet: 'Tipos de entidad',
		legendCode: 'Código',
		legendName: 'Descripción',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaOrganigrama.xlsx',
		templateFileName: 'PlantillaOrganigrama.xlsx',
	},
	en: {
		code: 'Code',
		parentCode: 'Parent code',
		levelTypeCode: 'Level code',
		title: 'Title',
		email: 'Responsible email',
		entityTypeCode: 'Entity type code',
		entityCode: 'Entity code',
		levelLegendSheet: 'Levels',
		entityLegendSheet: 'Entity types',
		legendCode: 'Code',
		legendName: 'Description',
		errorColumn: 'Error message',
		errorsFileName: 'OrgChartUploadErrors.xlsx',
		templateFileName: 'OrgChartTemplate.xlsx',
	},
};

// Human-readable text for the downloadable error report. The PG function returns stable short codes
// (e.g. 'userNotFound'); the frontend never sees the generated Excel, so we resolve each code to
// localized text here before writing the error column.
export const chartsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código duplicado en el archivo.',
		codeEmpty: 'El código del nodo es obligatorio.',
		levelTypeInvalid: 'El código de nivel no es válido.',
		titleEmpty: 'El título es obligatorio.',
		emailEmpty: 'El correo del responsable es obligatorio.',
		userNotFound: 'No existe un usuario con ese correo.',
		staffNotFound: 'El usuario no está registrado como personal.',
		entityIncomplete: 'Debe indicar el tipo de entidad y su código juntos, o dejar ambos vacíos.',
		entityTypeInvalid: 'El código de tipo de entidad no es válido.',
		entityNotFound: 'No existe la entidad indicada para ese tipo.',
		parentNotFound: 'El código del padre no existe en el archivo.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate code in the file.',
		codeEmpty: 'Node code is required.',
		levelTypeInvalid: 'The level code is not valid.',
		titleEmpty: 'Title is required.',
		emailEmpty: 'Responsible email is required.',
		userNotFound: 'No user exists with that email.',
		staffNotFound: 'The user is not registered as staff.',
		entityIncomplete: 'Provide the entity type and its code together, or leave both empty.',
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
