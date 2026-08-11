// Column headers + output file names for each generated export. Headers mirror the matching
// uploads/* template (so the file reads naturally and stays upload-compatible), with the extra
// docente `email` column appended. The upload parsers read positionally, so the leading columns
// must keep the template order.

import { GRADE_RC_OBSERVATIONS } from './scraping-exports.types';

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';

export interface ExportLabels {
	headers: string[];
	fileName: string;
}

// The grades RC export carries a second, descriptive worksheet alongside the upload-shaped one.
// The bulk upload only ever parses the first worksheet, so this sheet is free to hold whatever
// helps a human read the file — codes resolved to names, the course, the student.
export interface DescriptiveSheetLabels {
	sheetName: string;
	headers: string[];
	// Keyed by GRADE_RC_OBSERVATIONS codes.
	observations: Record<string, string>;
}

type LangMap = Record<string, ExportLabels>;

export const docenteExportLabels: LangMap = {
	es: {
		headers: ['Código de docente', 'Apellidos', 'Nombres', 'Correo'],
		fileName: 'Docentes.xlsx',
	},
	en: {
		headers: ['Professor code', 'Last name', 'First name', 'Email'],
		fileName: 'Professors.xlsx',
	},
};

export const seccionExportLabels: LangMap = {
	es: {
		headers: [
			'Código del curso',
			'Código de sección',
			'Código de docente',
			'Código del campus',
			'Código de modalidad de sección',
		],
		fileName: 'Secciones.xlsx',
	},
	en: {
		headers: [
			'Course code',
			'Section code',
			'Professor code',
			'Campus code',
			'Section modality code',
		],
		fileName: 'Sections.xlsx',
	},
};

export const alumnoMatriculadoExportLabels: LangMap = {
	es: {
		headers: [
			'Código del alumno',
			'Apellidos',
			'Nombres',
			'Código del programa',
			'Código del campus',
			'Código de modalidad de matrícula',
		],
		fileName: 'Matriculados.xlsx',
	},
	en: {
		headers: [
			'Student code',
			'Last name',
			'First name',
			'Program code',
			'Campus code',
			'Enrollment modality code',
		],
		fileName: 'EnrolledStudents.xlsx',
	},
};

export const alumnoSeccionExportLabels: LangMap = {
	es: {
		headers: ['Código de sección', 'Código del alumno'],
		fileName: 'AlumnoSeccion.xlsx',
	},
	en: {
		headers: ['Section code', 'Student code'],
		fileName: 'StudentSection.xlsx',
	},
};

// Mirrors the grades-rc bulk upload template column order exactly (uploads/grades-rc), so the
// generated file can be re-uploaded as-is.
export const gradesRcExportLabels: LangMap = {
	es: {
		headers: [
			'Código de sección',
			'Código del alumno',
			'Código de tipo de nota',
			'Peso del tipo de nota (%)',
			'Nota',
			'Código de estado de calificación',
		],
		fileName: 'NotasRC.xlsx',
	},
	en: {
		headers: [
			'Section code',
			'Student code',
			'Grade type code',
			'Grade type weight (%)',
			'Grade',
			'Qualification status code',
		],
		fileName: 'GradesRC.xlsx',
	},
};

// Column order must match the trailing fields of GradeRcExportRow as the service writes them.
export const gradesRcDescriptiveLabels: Record<string, DescriptiveSheetLabels> = {
	es: {
		sheetName: 'Detalle',
		headers: [
			'Periodo académico',
			'Código de sección',
			'Código de curso',
			'Nombre del curso',
			'Código del estudiante',
			'Nombre del estudiante',
			'Carrera',
			'Código del tipo de nota',
			'Tipo de nota',
			'Peso del tipo de nota (%)',
			'Nota',
			'Código del estado de calificación',
			'Estado de calificación',
			'Fuente',
			'Fecha de scrapeo',
			'Observación',
		],
		// Written for whoever downloads the file, not for whoever wrote the query: no column names
		// from the database, no internal vocabulary. Each one says what happened, whether the file
		// can still be uploaded, and what to do about it.
		observations: {
			[GRADE_RC_OBSERVATIONS.COURSE_LEVEL_STATUS]:
				'El alumno figura retirado o sancionado en el curso; puede verlo en la columna "Estado de calificación". Ese estado aplica a todo el curso, por eso la nota queda en 0: no es el resultado de una evaluación que haya rendido. Si el estado es correcto, esta fila se puede cargar tal como está.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE]:
				'El alumno no tiene la nota con la que se evalúa este curso (la que aparece en la columna "Tipo de nota"). Como figura retirado o sancionado, esa ausencia queda explicada: se registra 0 con ese estado y la fila se puede cargar.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_PENDING]:
				'REQUIERE ATENCIÓN. El alumno no tiene la nota con la que se evalúa este curso, y esa evaluación todavía figura abierta: el docente aún no la cerró, así que lo más probable es que falte calificarla. La fila quedó sin estado de calificación y el sistema rechazará el archivo completo mientras siga así. Lo recomendable es esperar a que el docente termine de calificar y volver a descargar el archivo.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_UNEXPLAINED]:
				'REQUIERE ATENCIÓN. El alumno no tiene la nota con la que se evalúa este curso y no se encontró ningún motivo que lo explique: no figura retirado, ni sancionado, ni con la evaluación pendiente. La fila quedó sin estado de calificación y el sistema rechazará el archivo completo mientras siga así. Hay que revisar este caso y completar la nota o el estado antes de subirlo.',
			[GRADE_RC_OBSERVATIONS.FALLBACK_GRADE]:
				'REQUIERE ATENCIÓN. Este curso no tiene configurado con qué nota se evalúa, o no se encontró ninguna nota de ese tipo, así que se usó la última evaluación del alumno; cuál es se ve en la columna "Tipo de nota". No es necesariamente la nota que corresponde para este curso: hay que revisarla antes de cargar el archivo, y lo correcto es configurar el tipo de nota del curso y volver a descargarlo.',
			[GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED]:
				'La nota es 0 y no hay nada que indique por qué: el alumno no figura retirado, ni sancionado, ni ausente. Puede ser un 0 que realmente sacó, o una evaluación que nunca llegó a calificarse. Conviene verificarlo antes de cargar.',
			[GRADE_RC_OBSERVATIONS.UNREGISTERED_GRADE_TYPE]:
				'REQUIERE ATENCIÓN. El tipo de nota de esta fila (columna "Código del tipo de nota") no está registrado en el sistema: viene tal cual del sistema de origen. El sistema rechazará el archivo completo mientras siga así, incluidas las filas de todos los demás cursos. Hay que registrar ese tipo de nota o configurar con qué nota se evalúa el curso, y volver a descargar el archivo.',
			[GRADE_RC_OBSERVATIONS.STUDENT_NOT_ENROLLED]:
				'REQUIERE ATENCIÓN. El alumno no figura matriculado en esta sección: o no está registrado en el sistema, o no tiene matrícula en ella. El sistema rechazará el archivo completo mientras siga así, incluidas las filas de todos los demás cursos. Hay que cargar antes los archivos de matriculados y de alumno-sección del periodo, y volver a descargar este archivo.',
		},
	},
	en: {
		sheetName: 'Details',
		headers: [
			'Academic period',
			'Section code',
			'Course code',
			'Course name',
			'Student code',
			'Student name',
			'Career',
			'Grade type code',
			'Grade type',
			'Grade type weight (%)',
			'Grade',
			'Qualification status code',
			'Qualification status',
			'Source',
			'Scraped at',
			'Observation',
		],
		observations: {
			[GRADE_RC_OBSERVATIONS.COURSE_LEVEL_STATUS]:
				'The student is recorded as withdrawn or sanctioned in the course; you can see it in the "Qualification status" column. That status applies to the whole course, which is why the grade is 0: it is not the result of an evaluation the student sat. If the status is right, this row can be uploaded as it is.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE]:
				'The student has no grade of the type this course is evaluated with (the one in the "Grade type" column). Since they are recorded as withdrawn or sanctioned, that absence is explained: it is recorded as 0 with that status and the row can be uploaded.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_PENDING]:
				'NEEDS ATTENTION. The student has no grade of the type this course is evaluated with, and that evaluation is still open: the teacher has not closed it, so it has most likely not been graded yet. The row was left with no qualification status and the system will reject the whole file while that is the case. Best to wait until the teacher finishes grading and download the file again.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_UNEXPLAINED]:
				'NEEDS ATTENTION. The student has no grade of the type this course is evaluated with and no reason was found for it: they are not recorded as withdrawn, sanctioned, or with the evaluation pending. The row was left with no qualification status and the system will reject the whole file while that is the case. This case has to be reviewed and the grade or the status filled in before uploading.',
			[GRADE_RC_OBSERVATIONS.FALLBACK_GRADE]:
				'NEEDS ATTENTION. This course has no grade type configured to be evaluated with, or no grade of that type was found, so the student\'s last evaluation was used; the "Grade type" column shows which one. It is not necessarily the right grade for this course: it has to be reviewed before uploading, and the proper fix is to configure the course\'s grade type and download the file again.',
			[GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED]:
				'The grade is 0 and nothing indicates why: the student is not recorded as withdrawn, sanctioned, or absent. It may be a 0 they actually scored, or an evaluation that was never graded. Worth checking before uploading.',
			[GRADE_RC_OBSERVATIONS.UNREGISTERED_GRADE_TYPE]:
				"NEEDS ATTENTION. This row's grade type (\"Grade type code\" column) is not registered in the system: it comes straight from the source system. The system will reject the whole file while that is the case, including every other course's rows. That grade type has to be registered, or the course's grade type configured, and the file downloaded again.",
			[GRADE_RC_OBSERVATIONS.STUDENT_NOT_ENROLLED]:
				"NEEDS ATTENTION. The student is not recorded as enrolled in this section: either they are not registered in the system, or they have no enrollment in it. The system will reject the whole file while that is the case, including every other course's rows. The period's enrolled-students and student-section files have to be uploaded first, and this file downloaded again.",
		},
	},
};
