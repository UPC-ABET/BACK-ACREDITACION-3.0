export const projectsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		projectCode: 'Código del proyecto',
		projectNameEs: 'Nombre del proyecto (ES)',
		projectNameEn: 'Nombre del proyecto (EN)',
		courseCode: 'Código del curso',
		studentCode: 'Código del alumno',
		sectionCode: 'Código de sección',
		professorCode: 'Código del docente evaluador',
		evaluatorTypeCode: 'Código de tipo de evaluador',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaProyectos.xlsx',
		templateFileName: 'PlantillaProyectos.xlsx',
		instructionsTitle: 'Instrucciones de llenado',
		instructionsColField: 'Campo',
		instructionsColDescription: 'Descripción',
		instructionsColRequired: 'Obligatorio',
		instructionsColExample: 'Ejemplo',
		instructionsYes: 'Sí',
		instructionsNo: 'No',
		evaluatorTypesTitle: 'Tipos de evaluador disponibles',
		evaluatorTypesColCode: 'Código',
		evaluatorTypesColName: 'Nombre',
	},
	en: {
		projectCode: 'Project code',
		projectNameEs: 'Project name (ES)',
		projectNameEn: 'Project name (EN)',
		courseCode: 'Course code',
		studentCode: 'Student code',
		sectionCode: 'Section code',
		professorCode: 'Evaluator professor code',
		evaluatorTypeCode: 'Evaluator type code',
		errorColumn: 'Error message',
		errorsFileName: 'ProjectsUploadErrors.xlsx',
		templateFileName: 'ProjectsTemplate.xlsx',
		instructionsTitle: 'Fill instructions',
		instructionsColField: 'Field',
		instructionsColDescription: 'Description',
		instructionsColRequired: 'Required',
		instructionsColExample: 'Example',
		instructionsYes: 'Yes',
		instructionsNo: 'No',
		evaluatorTypesTitle: 'Available evaluator types',
		evaluatorTypesColCode: 'Code',
		evaluatorTypesColName: 'Name',
	},
};

export interface FieldInstruction {
	field: string;
	description: string;
	required: boolean;
	example: string;
}

export const projectsFieldInstructions: Record<string, FieldInstruction[]> = {
	es: [
		{
			field: 'Código del proyecto',
			description:
				'Identificador único del proyecto. Máximo 50 caracteres. Se repite en cada fila del mismo proyecto.',
			required: true,
			example: 'PROY-XXXX-000',
		},
		{
			field: 'Nombre del proyecto (ES)',
			description:
				'Nombre en español. Solo es obligatorio en una fila del proyecto; puede dejarse vacío en las demás.',
			required: true,
			example: 'Nombre del proyecto en español',
		},
		{
			field: 'Nombre del proyecto (EN)',
			description:
				'Nombre en inglés. Solo es obligatorio en una fila del proyecto; puede dejarse vacío en las demás.',
			required: true,
			example: 'Project name in English',
		},
		{
			field: 'Código del curso',
			description:
				'Código del curso asociado al proyecto. Debe ser un curso evaluable en el periodo académico.',
			required: true,
			example: 'CURSXXXX',
		},
		{
			field: 'Código del alumno',
			description:
				'Código del alumno integrante. Cada alumno ocupa una fila. Requerido si no se indica docente evaluador.',
			required: false,
			example: '20XXXXXXXX',
		},
		{
			field: 'Código de sección',
			description: 'Sección del alumno en el curso. Obligatorio cuando se indica un alumno.',
			required: false,
			example: 'XXXXX',
		},
		{
			field: 'Código del docente evaluador',
			description:
				'Código del docente que evalúa el proyecto. Cada evaluador ocupa una fila. Requerido si no se indica alumno.',
			required: false,
			example: 'NXXXXXXXX',
		},
		{
			field: 'Código de tipo de evaluador',
			description:
				'Tipo de rol del evaluador. Obligatorio cuando se indica un docente evaluador. Ver tabla de tipos a continuación.',
			required: false,
			example: 'TG403-T00X',
		},
	],
	en: [
		{
			field: 'Project code',
			description:
				'Unique project identifier. Max 50 characters. Repeat on every row of the same project.',
			required: true,
			example: 'PROJ-XXXX-000',
		},
		{
			field: 'Project name (ES)',
			description:
				'Name in Spanish. Only required on one row per project; may be left empty on others.',
			required: true,
			example: 'Nombre del proyecto en español',
		},
		{
			field: 'Project name (EN)',
			description:
				'Name in English. Only required on one row per project; may be left empty on others.',
			required: true,
			example: 'Project name in English',
		},
		{
			field: 'Course code',
			description:
				'Code of the course linked to the project. Must be an evaluable course in the academic period.',
			required: true,
			example: 'COURSXXXX',
		},
		{
			field: 'Student code',
			description:
				'Code of a member student. Each student occupies one row. Required if no evaluator is provided.',
			required: false,
			example: '20XXXXXXXX',
		},
		{
			field: 'Section code',
			description: "Student's section in the course. Required when a student code is provided.",
			required: false,
			example: 'XXXXX',
		},
		{
			field: 'Evaluator professor code',
			description:
				'Code of the evaluating professor. Each evaluator occupies one row. Required if no student is provided.',
			required: false,
			example: 'NXXXXXXXX',
		},
		{
			field: 'Evaluator type code',
			description:
				'Role type of the evaluator. Required when an evaluator professor is provided. See types table below.',
			required: false,
			example: 'TG403-T00X',
		},
	],
};

export interface EvaluatorType {
	code: string;
	name: string;
}

// These must match core.types where type_group.code = 'TG403'
export const evaluatorTypesList: EvaluatorType[] = [
	{ code: 'TG403-T001', name: 'Comité / Committee' },
	{ code: 'TG403-T002', name: 'Gerente / Manager' },
	{ code: 'TG403-T003', name: 'Docente / Professor' },
	{ code: 'TG403-T004', name: 'Cliente / Client' },
	{ code: 'TG403-T005', name: 'Coautor / Co-author' },
];

export const projectsErrorMessages: Record<string, Record<string, string>> = {
	es: {
		projectCodeEmpty: 'El código del proyecto es obligatorio.',
		projectCodeTooLong: 'El código del proyecto supera el largo máximo permitido (50 caracteres).',
		courseCodeEmpty: 'El código del curso es obligatorio.',
		rowMissingStudentAndEvaluator:
			'Cada fila debe tener al menos un código de alumno o un código de docente evaluador.',
		sectionCodeEmpty: 'El código de sección es obligatorio cuando se indica un alumno.',
		evaluatorTypeCodeEmpty:
			'El código de tipo de evaluador es obligatorio cuando se indica un docente evaluador.',
		projectNameEmpty: 'El proyecto debe tener nombre en español e inglés en al menos una fila.',
		courseNotFound: 'No existe un curso con ese código.',
		courseNotEvaluable:
			'El curso no está configurado como evaluable (is_evaluable) en el periodo académico.',
		projectCodeDuplicateInPeriod: 'Ya existe un proyecto con ese código en el periodo académico.',
		studentNotFound: 'No existe un alumno con ese código.',
		studentNotInCourse:
			'El alumno no está matriculado en esa sección del curso durante el periodo académico.',
		studentAlreadyInProject: 'El alumno ya pertenece a un proyecto activo en el periodo académico.',
		professorNotFound: 'No existe un docente con ese código.',
		evaluatorTypeNotFound:
			'El código de tipo de evaluador no es válido. Use un código del grupo TG403.',
		duplicateEvaluatorType:
			'El mismo tipo de evaluador aparece más de una vez en el mismo proyecto.',
	},
	en: {
		projectCodeEmpty: 'Project code is required.',
		projectCodeTooLong: 'Project code exceeds the maximum allowed length (50 characters).',
		courseCodeEmpty: 'Course code is required.',
		rowMissingStudentAndEvaluator:
			'Each row must have at least a student code or an evaluator professor code.',
		sectionCodeEmpty: 'Section code is required when a student code is provided.',
		evaluatorTypeCodeEmpty:
			'Evaluator type code is required when an evaluator professor code is provided.',
		projectNameEmpty: 'The project must have a name in Spanish and English on at least one row.',
		courseNotFound: 'No course exists with that code.',
		courseNotEvaluable:
			'The course is not configured as evaluable (is_evaluable) in the academic period.',
		projectCodeDuplicateInPeriod: 'A project with that code already exists in the academic period.',
		studentNotFound: 'No student exists with that code.',
		studentNotInCourse:
			'The student is not enrolled in that course section during the academic period.',
		studentAlreadyInProject:
			'The student already belongs to an active project in the academic period.',
		professorNotFound: 'No professor exists with that code.',
		evaluatorTypeNotFound: 'The evaluator type code is not valid. Use a code from group TG403.',
		duplicateEvaluatorType: 'The same evaluator type appears more than once in the same project.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
