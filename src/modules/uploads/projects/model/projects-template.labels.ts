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
	},
};

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
