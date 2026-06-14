export const chartsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		code: 'Id',
		parentCode: 'Padre',
		title: 'Unidad académica',
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
// (e.g. 'userNotFound'); the frontend never sees the generated Excel, so we resolve each code to
// localized text here before writing the error column.
export const chartsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		duplicateCodeInFile: 'Código duplicado en el archivo.',
		codeEmpty: 'El código del nodo es obligatorio.',
		titleEmpty: 'El título es obligatorio.',
		emailEmpty: 'El correo del responsable es obligatorio.',
		userNotFound: 'No existe un usuario con ese correo.',
		staffNotFound: 'El usuario no está registrado como personal.',
		entityCodeWithoutType: 'Indicó un código de entidad sin tipo de entidad.',
		entityTypeInvalid: 'El código de tipo de entidad no es válido.',
		entityNotFound: 'No existe la entidad indicada para ese tipo.',
		parentNotFound: 'El código del padre no existe en el archivo.',
	},
	en: {
		duplicateCodeInFile: 'Duplicate code in the file.',
		codeEmpty: 'Node code is required.',
		titleEmpty: 'Title is required.',
		emailEmpty: 'Responsible email is required.',
		userNotFound: 'No user exists with that email.',
		staffNotFound: 'The user is not registered as staff.',
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
