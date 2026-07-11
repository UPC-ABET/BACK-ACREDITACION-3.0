import { MAX_CRITERIA_SLOTS, MAX_QUESTION_SLOTS } from './project-grades-upload.types';

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';

export const projectGradesTemplateLabels: Record<string, Record<string, string>> = {
	es: {
		competencyScopeCode: 'Código de alcance de competencias',
		gradeTypeCode: 'Código de tipo de nota',
		academicPeriodCode: 'Código de periodo académico',
		projectCode: 'Código del proyecto',
		studentCode: 'Código del alumno',
		evaluatorCode: 'Código del evaluador (docente)',
		statusCode: 'Código de estado de calificación',
		outcomeCode: 'Código de outcome',
		question: 'Puntaje pregunta',
		criteria: 'Puntaje criterio',
		observationEs: 'Observación (ES)',
		observationEn: 'Observación (EN)',
		errorColumn: 'Mensaje de error',
		errorsFileName: 'ErroresCargaNotasProyectos.xlsx',
		templateFileName: 'PlantillaNotasProyectos.xlsx',
		sheetB: 'Preguntas',
		sheetA: 'Outcomes',
		instructionsTitle: 'Instrucciones de llenado',
		instructionsColField: 'Campo',
		instructionsColDescription: 'Descripción',
		instructionsColRequired: 'Obligatorio',
		instructionsColExample: 'Ejemplo',
		instructionsYes: 'Sí',
		instructionsNo: 'No',
		gradeTypesTitle: 'Tipos de nota disponibles',
		gradeTypesColCode: 'Código',
		gradeTypesColName: 'Nombre',
		competencyScopeTitle: 'Alcance de competencias disponibles',
		competencyScopeColCode: 'Código',
		competencyScopeColName: 'Nombre',
		statusTypesTitle: 'Estados de calificación disponibles',
		statusTypesColCode: 'Código',
		statusTypesColName: 'Nombre',
	},
	en: {
		competencyScopeCode: 'Competency scope code',
		gradeTypeCode: 'Grade type code',
		academicPeriodCode: 'Academic period code',
		projectCode: 'Project code',
		studentCode: 'Student code',
		evaluatorCode: 'Evaluator (professor) code',
		statusCode: 'Qualification status code',
		outcomeCode: 'Outcome code',
		question: 'Question score',
		criteria: 'Criterion score',
		observationEs: 'Observation (ES)',
		observationEn: 'Observation (EN)',
		errorColumn: 'Error message',
		errorsFileName: 'ProjectGradesUploadErrors.xlsx',
		templateFileName: 'ProjectGradesTemplate.xlsx',
		sheetB: 'Questions',
		sheetA: 'Outcomes',
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
		competencyScopeTitle: 'Available competency scopes',
		competencyScopeColCode: 'Code',
		competencyScopeColName: 'Name',
		statusTypesTitle: 'Available qualification statuses',
		statusTypesColCode: 'Code',
		statusTypesColName: 'Name',
	},
};

export interface FieldInstruction {
	field: string;
	description: string;
	required: boolean;
	example: string;
}

export const projectGradesSheetBInstructions: Record<string, FieldInstruction[]> = {
	es: [
		{
			field: 'Código de alcance de competencias',
			description:
				'Código del alcance de competencias de la rúbrica a calificar (no usar Múltiple + Capstone aquí, va en la otra hoja).',
			required: true,
			example: 'TG402-T001',
		},
		{
			field: 'Código de tipo de nota',
			description: 'Código del tipo de nota (EB1, TF1, etc.) de la rúbrica a calificar.',
			required: true,
			example: 'TG205-T001',
		},
		{
			field: 'Código de periodo académico',
			description: 'Periodo académico del proyecto.',
			required: true,
			example: '2025-1',
		},
		{
			field: 'Código del proyecto',
			description: 'Identificador del proyecto a calificar.',
			required: true,
			example: 'PROY-XXXX-000',
		},
		{
			field: 'Código del alumno',
			description: 'Alumno integrante del proyecto que se está calificando.',
			required: true,
			example: '20XXXXXXXX',
		},
		{
			field: 'Código del evaluador',
			description: 'Código del docente evaluador (debe ser evaluador del proyecto).',
			required: true,
			example: 'N12345678',
		},
		{
			field: 'Código de estado de calificación',
			description:
				'Estado desde core.types (TG404). Ej: ASISTIO (TG404-T001), NR (TG404-T002), NA (TG404-T003), ' +
				'DPI (TG404-T004), RET (TG404-T005), SAN (TG404-T006). Cualquier estado distinto de ASISTIO ' +
				'ignora el puntaje escrito y fuerza el criterio de rango más bajo de cada pregunta, con puntaje 0.',
			required: true,
			example: 'TG404-T001',
		},
		{
			field: `Pregunta N (1-${MAX_QUESTION_SLOTS})`,
			description:
				'Cada columna corresponde a la N-ésima pregunta de la rúbrica (ordenadas por id). El valor es el ' +
				'puntaje numérico; el sistema calcula automáticamente a qué criterio (rango min-max) corresponde.',
			required: false,
			example: '5',
		},
		{
			field: 'Observación (ES/EN)',
			description: 'Opcional; si ambos idiomas están vacíos no se envía.',
			required: false,
			example: 'Buen desempeño',
		},
	],
	en: [
		{
			field: 'Competency scope code',
			description:
				'Competency scope code of the rubric being graded (do not use Multiple + Capstone here, that goes in the other sheet).',
			required: true,
			example: 'TG402-T001',
		},
		{
			field: 'Grade type code',
			description: 'Grade type code (EB1, TF1, etc.) of the rubric being graded.',
			required: true,
			example: 'TG205-T001',
		},
		{
			field: 'Academic period code',
			description: 'Academic period the project belongs to.',
			required: true,
			example: '2025-1',
		},
		{
			field: 'Project code',
			description: 'Identifier of the project being graded.',
			required: true,
			example: 'PROJ-XXXX-000',
		},
		{
			field: 'Student code',
			description: 'Member student being graded.',
			required: true,
			example: '20XXXXXXXX',
		},
		{
			field: 'Evaluator code',
			description: 'Professor code of the evaluator (must be an evaluator of the project).',
			required: true,
			example: 'N12345678',
		},
		{
			field: 'Qualification status code',
			description:
				'Status from core.types (TG404). E.g. ASISTIO (TG404-T001), NR (TG404-T002), NA (TG404-T003), ' +
				'DPI (TG404-T004), RET (TG404-T005), SAN (TG404-T006). Any status other than ASISTIO ignores the ' +
				'typed score and forces the lowest-range criterion of every question, with score 0.',
			required: true,
			example: 'TG404-T001',
		},
		{
			field: `Question N (1-${MAX_QUESTION_SLOTS})`,
			description:
				'Each column corresponds to the Nth question of the rubric (ordered by id). The value is the ' +
				'numeric score; the system matches it to the right criterion (min-max range) automatically.',
			required: false,
			example: '5',
		},
		{
			field: 'Observation (ES/EN)',
			description: 'Optional; if both languages are empty, it is not sent.',
			required: false,
			example: 'Good performance',
		},
	],
};

export const projectGradesSheetAInstructions: Record<string, FieldInstruction[]> = {
	es: [
		{
			field: 'Código de tipo de nota',
			description: 'Código del tipo de nota de la rúbrica Capstone + Múltiple competencia.',
			required: true,
			example: 'TG205-T001',
		},
		{
			field: 'Código de periodo académico',
			description: 'Periodo académico del proyecto.',
			required: true,
			example: '2025-1',
		},
		{
			field: 'Código del proyecto',
			description: 'Identificador del proyecto a calificar.',
			required: true,
			example: 'PROY-XXXX-000',
		},
		{
			field: 'Código del alumno',
			description: 'Alumno integrante del proyecto que se está calificando.',
			required: true,
			example: '20XXXXXXXX',
		},
		{
			field: 'Código del evaluador',
			description: 'Código del docente evaluador (debe ser evaluador del proyecto).',
			required: true,
			example: 'N12345678',
		},
		{
			field: 'Código de estado de calificación',
			description:
				'Estado desde core.types (TG404). Cualquier estado distinto de ASISTIO fuerza el puntaje de cada ' +
				'criterio a 0, manteniendo el mismo criterio.',
			required: true,
			example: 'TG404-T001',
		},
		{
			field: 'Código de outcome',
			description:
				'Cada fila representa UN outcome del estudiante. Repita las filas necesarias para cubrir todos los ' +
				'outcomes que la rúbrica mapea para ese proyecto/estudiante.',
			required: true,
			example: 'RA1',
		},
		{
			field: `Criterio N (1-${MAX_CRITERIA_SLOTS})`,
			description:
				'Puntaje de cada criterio de la pregunta de ese outcome, en el mismo orden en que están definidos ' +
				'(no es necesario indicar el nivel: solo se escribe el puntaje). El sistema valida que el puntaje ' +
				'sea uno de los valores únicos de los niveles de desempeño (performance levels) del instrumento ' +
				'Rúbrica configurados para el periodo académico — no puede ser mayor al nivel más alto ni menor al ' +
				'más bajo.',
			required: false,
			example: '3',
		},
		{
			field: 'Observación (ES/EN)',
			description:
				'Opcional. Se guarda en la misma evaluación del estudiante (compartida entre todas sus filas de ' +
				'outcomes); si aparece en más de una fila del mismo estudiante, la última que se procese es la que ' +
				'queda guardada.',
			required: false,
			example: 'Buen desempeño',
		},
	],
	en: [
		{
			field: 'Grade type code',
			description: 'Grade type code of the Capstone + Multiple competency rubric.',
			required: true,
			example: 'TG205-T001',
		},
		{
			field: 'Academic period code',
			description: 'Academic period the project belongs to.',
			required: true,
			example: '2025-1',
		},
		{
			field: 'Project code',
			description: 'Identifier of the project being graded.',
			required: true,
			example: 'PROJ-XXXX-000',
		},
		{
			field: 'Student code',
			description: 'Member student being graded.',
			required: true,
			example: '20XXXXXXXX',
		},
		{
			field: 'Evaluator code',
			description: 'Professor code of the evaluator (must be an evaluator of the project).',
			required: true,
			example: 'N12345678',
		},
		{
			field: 'Qualification status code',
			description:
				'Status from core.types (TG404). Any status other than ASISTIO forces every criterion score to 0, ' +
				'keeping the same criterion.',
			required: true,
			example: 'TG404-T001',
		},
		{
			field: 'Outcome code',
			description:
				'Each row represents ONE outcome of the student. Repeat rows as needed to cover every outcome the ' +
				'rubric maps for that project/student.',
			required: true,
			example: 'RA1',
		},
		{
			field: `Criterion N (1-${MAX_CRITERIA_SLOTS})`,
			description:
				"Score for each criterion of that outcome's question, in definition order (no need to specify the " +
				'level: just write the score). The system validates the score is one of the unique performance ' +
				'level values configured for the Rubric instrument in that academic period — it cannot exceed the ' +
				'highest level nor be below the lowest.',
			required: false,
			example: '3',
		},
		{
			field: 'Observation (ES/EN)',
			description:
				"Optional. Saved on the student's evaluation (shared across all their outcome rows); if it appears " +
				'on more than one row for the same student, the last one processed is kept.',
			required: false,
			example: 'Good performance',
		},
	],
};

export const projectGradesErrorMessages: Record<string, Record<string, string>> = {
	es: {
		academicPeriodCodeEmpty: 'El código de periodo académico es obligatorio.',
		academicPeriodNotFound: 'No existe un periodo académico con ese código.',
		academicPeriodMismatch:
			'El alumno no está matriculado bajo ese periodo académico en su plan de estudios.',
		projectCodeEmpty: 'El código del proyecto es obligatorio.',
		projectNotFound: 'No existe un proyecto con ese código.',
		studentCodeEmpty: 'El código del alumno es obligatorio.',
		studentNotInProject: 'El alumno no pertenece a ese proyecto.',
		evaluatorCodeEmpty: 'El código del evaluador es obligatorio.',
		evaluatorNotFound: 'No existe un docente con ese código.',
		evaluatorNotInProject: 'El docente no es evaluador de ese proyecto.',
		evaluatorInactive: 'El evaluador está inactivo y no puede calificar.',
		evaluatorTypeNotAuthorized: 'El tipo de evaluador no está autorizado para calificar.',
		statusCodeEmpty: 'El código de estado de calificación es obligatorio.',
		statusCodeNotFound: 'El código de estado de calificación no es válido.',
		statusCodeInconsistent: 'El estado de calificación difiere entre filas del mismo alumno.',
		evaluatorCodeInconsistent: 'El evaluador difiere entre filas del mismo alumno.',
		gradeTypeCodeEmpty: 'El código de tipo de nota es obligatorio.',
		gradeTypeNotFound: 'El código de tipo de nota no es válido.',
		competencyScopeCodeEmpty: 'El código de alcance de competencias es obligatorio.',
		competencyScopeNotFound: 'El código de alcance de competencias no es válido.',
		competencyScopeNotAllowedHere:
			'Esta hoja no admite rúbricas Capstone + Múltiple competencia; use la otra hoja.',
		rubricNotFound:
			'No existe una rúbrica activa para ese proyecto con ese tipo de nota y alcance de competencias en el periodo.',
		outcomeCodeEmpty: 'El código de outcome es obligatorio.',
		outcomeCodeNotFound: 'El código de outcome no pertenece a la rúbrica de este proyecto.',
		outcomeDuplicated: 'El outcome aparece más de una vez para el mismo alumno.',
		outcomeMissing: 'Faltan outcomes de la rúbrica por calificar para este alumno.',
		criteriaScoreInvalid: 'El puntaje del criterio no es un número válido.',
		criteriaScoreNotValidLevel:
			'El puntaje no corresponde a ningún nivel de desempeño configurado para el periodo académico.',
		criteriaSlotUnused: 'Hay un puntaje en una columna de criterio que ese outcome no usa.',
		noCriteriaScored: 'El outcome no tiene ningún puntaje de criterio en la fila.',
		performanceLevelsNotConfigured:
			'No hay niveles de desempeño configurados para el instrumento Rúbrica en ese periodo académico.',
		questionScoreMissing: 'Falta el puntaje de una pregunta de la rúbrica.',
		questionScoreInvalid: 'El puntaje de la pregunta no es un número válido.',
		questionScoreOutOfRange:
			'El puntaje no corresponde al rango de ningún criterio de la pregunta.',
		questionSlotUnused: 'Hay un puntaje en una columna de pregunta que la rúbrica no usa.',
		questionNoCriteria: 'La pregunta no tiene criterios configurados.',
		tooManyQuestionsForTemplate: `La rúbrica tiene más preguntas que las ${MAX_QUESTION_SLOTS} columnas disponibles en la plantilla.`,
		tooManyCriteriasForTemplate: `El outcome tiene más criterios que las ${MAX_CRITERIA_SLOTS} columnas disponibles en la plantilla.`,
	},
	en: {
		academicPeriodCodeEmpty: 'Academic period code is required.',
		academicPeriodNotFound: 'No academic period exists with that code.',
		academicPeriodMismatch:
			'The student is not enrolled under that academic period in their study plan.',
		projectCodeEmpty: 'Project code is required.',
		projectNotFound: 'No project exists with that code.',
		studentCodeEmpty: 'Student code is required.',
		studentNotInProject: 'The student does not belong to that project.',
		evaluatorCodeEmpty: 'Evaluator code is required.',
		evaluatorNotFound: 'No professor exists with that code.',
		evaluatorNotInProject: 'The professor is not an evaluator of that project.',
		evaluatorInactive: 'The evaluator is inactive and cannot grade.',
		evaluatorTypeNotAuthorized: 'The evaluator type is not authorized to grade.',
		statusCodeEmpty: 'Qualification status code is required.',
		statusCodeNotFound: 'Qualification status code is not valid.',
		statusCodeInconsistent: 'Qualification status differs across rows of the same student.',
		evaluatorCodeInconsistent: 'Evaluator differs across rows of the same student.',
		gradeTypeCodeEmpty: 'Grade type code is required.',
		gradeTypeNotFound: 'Grade type code is not valid.',
		competencyScopeCodeEmpty: 'Competency scope code is required.',
		competencyScopeNotFound: 'Competency scope code is not valid.',
		competencyScopeNotAllowedHere:
			'This sheet does not accept Capstone + Multiple competency rubrics; use the other sheet.',
		rubricNotFound:
			'No active rubric exists for that project with that grade type and competency scope in the period.',
		outcomeCodeEmpty: 'Outcome code is required.',
		outcomeCodeNotFound: 'The outcome code does not belong to this project rubric.',
		outcomeDuplicated: 'The outcome appears more than once for the same student.',
		outcomeMissing: 'Some rubric outcomes are missing a grade for this student.',
		criteriaScoreInvalid: 'The criterion score is not a valid number.',
		criteriaScoreNotValidLevel:
			'The score does not match any performance level configured for the academic period.',
		criteriaSlotUnused: 'There is a score in a criterion column that outcome does not use.',
		noCriteriaScored: 'The outcome has no criterion score in the row.',
		performanceLevelsNotConfigured:
			'No performance levels are configured for the Rubric instrument in that academic period.',
		questionScoreMissing: 'A rubric question score is missing.',
		questionScoreInvalid: 'The question score is not a valid number.',
		questionScoreOutOfRange:
			'The score does not fall in the range of any criterion of the question.',
		questionSlotUnused: 'There is a score in a question column the rubric does not use.',
		questionNoCriteria: 'The question has no configured criteria.',
		tooManyQuestionsForTemplate: `The rubric has more questions than the ${MAX_QUESTION_SLOTS} columns available in the template.`,
		tooManyCriteriasForTemplate: `The outcome has more criteria than the ${MAX_CRITERIA_SLOTS} columns available in the template.`,
	},
};
