export const projectsTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		projectCode: 'Código del proyecto',
		projectNameEs: 'Nombre del proyecto (ES)',
		projectNameEn: 'Nombre del proyecto (EN)',
		courseCode: 'Código del curso',
		studentCode: 'Código del alumno',
		sectionCode: 'Código de sección',
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
				'Código del alumno integrante del proyecto. Cada alumno ocupa una fila. Opcional si el proyecto ya existe y solo se desean actualizar los evaluadores.',
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
			field: 'Comité (TG403-T001)',
			description:
				'Código(s) del docente con rol de Comité. Para múltiples docentes, separarlos por coma sin espacios. Si se re-sube el proyecto, reemplaza los evaluadores anteriores de este rol.',
			required: false,
			example: 'N12345678,N87654321',
		},
		{
			field: 'Gerente (TG403-T002)',
			description:
				'Código del docente con rol de Gerente. Solo se permite un docente por proyecto.',
			required: false,
			example: 'N12345678',
		},
		{
			field: 'Docente (TG403-T003)',
			description:
				'Código del docente con rol de Docente. Solo se permite un docente por proyecto.',
			required: false,
			example: 'N12345678',
		},
		{
			field: 'Cliente (TG403-T004)',
			description:
				'Código del docente con rol de Cliente. Solo se permite un docente por proyecto.',
			required: false,
			example: 'N12345678',
		},
		{
			field: 'Coautor (TG403-T005)',
			description:
				'Código del docente con rol de Coautor. Solo se permite un docente por proyecto.',
			required: false,
			example: 'N12345678',
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
				'Code of a member student. Each student occupies one row. Optional if the project already exists and only evaluators need to be updated.',
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
			field: 'Committee (TG403-T001)',
			description:
				'Professor code(s) with the Committee role. For multiple professors, separate with commas and no spaces. On re-upload, replaces previous evaluators for this role.',
			required: false,
			example: 'N12345678,N87654321',
		},
		{
			field: 'Manager (TG403-T002)',
			description:
				'Professor code with the Manager role. Only one professor per project is allowed.',
			required: false,
			example: 'N12345678',
		},
		{
			field: 'Professor (TG403-T003)',
			description:
				'Professor code with the Professor role. Only one professor per project is allowed.',
			required: false,
			example: 'N12345678',
		},
		{
			field: 'Client (TG403-T004)',
			description:
				'Professor code with the Client role. Only one professor per project is allowed.',
			required: false,
			example: 'N12345678',
		},
		{
			field: 'Co-author (TG403-T005)',
			description:
				'Professor code with the Co-author role. Only one professor per project is allowed.',
			required: false,
			example: 'N12345678',
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
		sectionCodeEmpty: 'El código de sección es obligatorio cuando se indica un alumno.',
		projectNameEmpty:
			'El proyecto nuevo debe tener nombre en español e inglés en al menos una fila.',
		newProjectRequiresStudent:
			'El proyecto es nuevo y debe tener al menos una fila con código de alumno.',
		courseNotFound: 'No existe un curso con ese código.',
		courseNotEvaluable:
			'El curso no está configurado como evaluable (is_evaluable) en el periodo académico.',
		studentNotFound: 'No existe un alumno con ese código.',
		studentNotInCourse:
			'El alumno no está matriculado en esa sección del curso durante el periodo académico.',
		studentAlreadyInProject: 'El alumno ya pertenece a un proyecto activo en el periodo académico.',
		professorNotFound: 'No existe un docente con ese código en la columna de evaluadores.',
		multipleEvaluatorsNotAllowed:
			'Solo el tipo Comité permite múltiples docentes. Los demás tipos aceptan un único código.',
	},
	en: {
		projectCodeEmpty: 'Project code is required.',
		projectCodeTooLong: 'Project code exceeds the maximum allowed length (50 characters).',
		courseCodeEmpty: 'Course code is required.',
		sectionCodeEmpty: 'Section code is required when a student code is provided.',
		projectNameEmpty: 'A new project must have a name in Spanish and English on at least one row.',
		newProjectRequiresStudent:
			'The project is new and must have at least one row with a student code.',
		courseNotFound: 'No course exists with that code.',
		courseNotEvaluable:
			'The course is not configured as evaluable (is_evaluable) in the academic period.',
		studentNotFound: 'No student exists with that code.',
		studentNotInCourse:
			'The student is not enrolled in that course section during the academic period.',
		studentAlreadyInProject:
			'The student already belongs to an active project in the academic period.',
		professorNotFound: 'No professor exists with that code in the evaluator columns.',
		multipleEvaluatorsNotAllowed:
			'Only the Committee type allows multiple professors. Other types accept a single code.',
	},
};

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';
