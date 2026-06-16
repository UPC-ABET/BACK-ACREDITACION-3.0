export const rubricsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		courseCode: 'Código del curso',
		programCode: 'Código de carrera',
		gradeTypeCode: 'Código de tipo de calificación',
		outcomeCode: 'Código de outcome',
		questionEs: 'Pregunta (ES)',
		questionEn: 'Pregunta (EN)',
		criteriaEs: 'Criterio (ES)',
		criteriaEn: 'Criterio (EN)',
		minValue: 'Puntaje mínimo',
		maxValue: 'Puntaje máximo',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaRubricas.xlsx',
		templateFileName: 'PlantillaRubricas.xlsx',
		instructionsTitle: 'Instrucciones de llenado',
		instructionsColField: 'Campo',
		instructionsColDescription: 'Descripción',
		instructionsColRequired: 'Obligatorio',
		instructionsColExample: 'Ejemplo',
		instructionsYes: 'Sí',
		instructionsNo: 'No',
		gradeTypesTitle: 'Tipos de calificación disponibles',
		gradeTypesColCode: 'Código',
		gradeTypesColName: 'Nombre',
	},
	en: {
		courseCode: 'Course code',
		programCode: 'Program code',
		gradeTypeCode: 'Grade type code',
		outcomeCode: 'Outcome code',
		questionEs: 'Question (ES)',
		questionEn: 'Question (EN)',
		criteriaEs: 'Criteria (ES)',
		criteriaEn: 'Criteria (EN)',
		minValue: 'Min score',
		maxValue: 'Max score',
		errorColumn: 'Error message',
		errorsFileName: 'RubricsUploadErrors.xlsx',
		templateFileName: 'RubricsTemplate.xlsx',
		instructionsTitle: 'Fill instructions',
		instructionsColField: 'Field',
		instructionsColDescription: 'Description',
		instructionsColRequired: 'Required',
		instructionsColExample: 'Example',
		instructionsYes: 'Yes',
		instructionsNo: 'No',
		gradeTypesTitle: 'Available grade types',
		gradeTypesColCode: 'Code',
		gradeTypesColName: 'Name',
	},
};

export interface FieldInstruction {
	field: string;
	description: string;
	required: boolean;
	example: string;
}

export const rubricsFieldInstructions: Record<string, FieldInstruction[]> = {
	es: [
		{
			field: 'Código del curso',
			description:
				'Código del curso al que pertenece la rúbrica. Se repite en todas las filas de la misma rúbrica.',
			required: true,
			example: 'CURSXXXX',
		},
		{
			field: 'Código de carrera',
			description:
				'Código de la carrera (programa) al que pertenece el curso. Permite diferenciar cursos con el mismo código en distintas carreras.',
			required: true,
			example: 'PROG001',
		},
		{
			field: 'Código de tipo de calificación',
			description:
				'Tipo de evaluación. Ver tabla de tipos disponibles. Se repite en todas las filas de la misma rúbrica.',
			required: true,
			example: 'TG205-T00X',
		},
		{
			field: 'Código de outcome',
			description:
				'Solo para rúbricas por Outcomes. Identifica el outcome asociado a la pregunta. En los demás casos debe dejarse vacío.',
			required: false,
			example: 'OC-XXX',
		},
		{
			field: 'Pregunta (ES)',
			description:
				'Texto de la pregunta en español. Todas las filas con el mismo texto pertenecen a la misma pregunta. Opcional si se indica outcomeCode.',
			required: false,
			example: 'Nombre de la pregunta en español',
		},
		{
			field: 'Pregunta (EN)',
			description: 'Texto de la pregunta en inglés. Opcional si se indica outcomeCode.',
			required: false,
			example: 'Question name in English',
		},
		{
			field: 'Criterio (ES)',
			description: 'Nombre del criterio en español.',
			required: true,
			example: 'Nombre del criterio en español',
		},
		{
			field: 'Criterio (EN)',
			description: 'Nombre del criterio en inglés.',
			required: true,
			example: 'Criteria name in English',
		},
		{
			field: 'Puntaje mínimo',
			description: 'Puntaje mínimo del criterio. Opcional para rúbricas por Outcomes.',
			required: false,
			example: '0',
		},
		{
			field: 'Puntaje máximo',
			description: 'Puntaje máximo del criterio. Opcional para rúbricas por Outcomes.',
			required: true,
			example: '4',
		},
	],
	en: [
		{
			field: 'Course code',
			description:
				'Code of the course the rubric belongs to. Repeat on all rows of the same rubric.',
			required: true,
			example: 'COURSXXXX',
		},
		{
			field: 'Program code',
			description:
				'Code of the academic program (career) the course belongs to. Disambiguates courses with the same code across different programs.',
			required: true,
			example: 'PROG001',
		},
		{
			field: 'Grade type code',
			description:
				'Evaluation type. See available types table. Repeat on all rows of the same rubric.',
			required: true,
			example: 'TG205-T00X',
		},
		{
			field: 'Outcome code',
			description:
				'Only for outcome-based rubrics. Identifies the outcome linked to the question. Leave empty otherwise.',
			required: false,
			example: 'OC-XXX',
		},
		{
			field: 'Question (ES)',
			description:
				'Question text in Spanish. All rows with the same text belong to the same question. Optional if outcomeCode is provided.',
			required: false,
			example: 'Question name in Spanish',
		},
		{
			field: 'Question (EN)',
			description: 'Question text in English. Optional if outcomeCode is provided.',
			required: false,
			example: 'Question name in English',
		},
		{
			field: 'Criteria (ES)',
			description: 'Criteria name in Spanish.',
			required: true,
			example: 'Criteria name in Spanish',
		},
		{
			field: 'Criteria (EN)',
			description: 'Criteria name in English.',
			required: true,
			example: 'Criteria name in English',
		},
		{
			field: 'Min score',
			description:
				'Minimum score for the criteria. Optional for outcome-based rubrics with grade type EB (defaults to 0).',
			required: false,
			example: '0',
		},
		{
			field: 'Max score',
			description:
				'Maximum score for the criteria. Optional for outcome-based rubrics with grade type EB (defaults to 0).',
			required: true,
			example: '4',
		},
	],
};

export interface GradeType {
	code: string;
	name: string;
}

// These must match core.types where type_group.code = 'TG205'
export const gradeTypesList: GradeType[] = [
	{ code: 'TG205-T001', name: 'EA' },
	{ code: 'TG205-T002', name: 'EB' },
	{ code: 'TG205-T003', name: 'PA' },
	{ code: 'TG205-T004', name: 'TA' },
	{ code: 'TG205-T005', name: 'TP' },
	{ code: 'TG205-T006', name: 'TF' },
];

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
