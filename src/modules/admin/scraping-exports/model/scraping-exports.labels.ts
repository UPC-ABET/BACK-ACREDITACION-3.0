// Column headers + output file names for each generated export. Headers mirror the matching
// uploads/* template (so the file reads naturally and stays upload-compatible), with the extra
// staff `email` column appended. The upload parsers read positionally, so the leading columns
// must keep the template order.

import { GRADE_RC_OBSERVATIONS, ScrapingExportType } from './scraping-exports.types';

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

export const staffExportLabels: LangMap = {
	es: {
		headers: ['Código de docente', 'Apellidos', 'Nombres', 'Correo'],
		fileName: 'Docentes.xlsx',
	},
	en: {
		headers: ['Professor code', 'Last name', 'First name', 'Email'],
		fileName: 'Professors.xlsx',
	},
};

export const sectionExportLabels: LangMap = {
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

export const enrolledStudentExportLabels: LangMap = {
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

export const studentSectionExportLabels: LangMap = {
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

const EXPORT_LABELS_BY_TYPE: Record<ScrapingExportType, LangMap> = {
	staff: staffExportLabels,
	sections: sectionExportLabels,
	enrolledStudents: enrolledStudentExportLabels,
	studentSections: studentSectionExportLabels,
	gradesRc: gradesRcExportLabels,
};

// The status/regenerate contract has no `lang` to resolve a real filename with (see
// ScrapingExportStatusResponse), so this is always the default-language name — a readiness signal,
// not a promise about what a later `download` call will actually render.
export const getDefaultExportFileName = (exportType: ScrapingExportType): string =>
	EXPORT_LABELS_BY_TYPE[exportType][DEFAULT_TEMPLATE_LANGUAGE].fileName;

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
		// Written for whoever downloads the file: what happened and, where it applies, what to do.
		observations: {
			[GRADE_RC_OBSERVATIONS.COURSE_LEVEL_STATUS]:
				'El alumno figura retirado o sancionado en el curso, por eso la nota es 0.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE]:
				'No tiene la nota con la que se evalúa el curso; su retiro o sanción lo explica. Se registra 0.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_PENDING]:
				'REQUIERE ATENCIÓN. No tiene la nota con la que se evalúa el curso y esa evaluación sigue abierta. Se registra 0 con estado "NR". Esperar a que el docente califique y volver a descargar.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_UNEXPLAINED]:
				'REQUIERE ATENCIÓN. No tiene la nota con la que se evalúa el curso y no hay motivo que lo explique. Se registra 0 con estado "NR". Revisar el caso.',
			[GRADE_RC_OBSERVATIONS.FALLBACK_GRADE]:
				'REQUIERE ATENCIÓN. El curso no tiene configurado con qué nota se evalúa: se usó la última evaluación del alumno. Configurar el tipo de nota del curso y volver a descargar.',
			[GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED]:
				'La nota es 0 y no hay nada que indique por qué. Puede ser un 0 real o una evaluación sin calificar.',
			[GRADE_RC_OBSERVATIONS.UNREGISTERED_STATUS]:
				'REQUIERE ATENCIÓN. El estado de calificación no está registrado en el sistema: se muestra tal cual viene del origen. Verificarlo antes de cargar.',
			[GRADE_RC_OBSERVATIONS.NO_SOURCE_GRADE_OR_STATUS]:
				'REQUIERE ATENCIÓN. El origen no reporta nota ni estado para esta evaluación: no hay nada que indique que el alumno la haya rendido ni por qué no. Se muestra 0 con estado "NR" como valor por defecto, no porque el sistema de origen lo diga. Revisar el caso antes de cargar.',
			[GRADE_RC_OBSERVATIONS.UNREGISTERED_GRADE_TYPE]:
				'REQUIERE ATENCIÓN. El tipo de nota no está registrado en el sistema. Registrarlo o configurar el tipo de nota del curso, y volver a descargar.',
			[GRADE_RC_OBSERVATIONS.STUDENT_NOT_IN_SECTION]:
				'REQUIERE ATENCIÓN. El alumno está matriculado en el periodo, pero no figura registrado en esta sección (alumno-sección). Cargar el archivo de alumno-sección del periodo y volver a descargar.',
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
				'The student is recorded as withdrawn or sanctioned in the course, which is why the grade is 0.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE]:
				'No grade of the type this course is evaluated with; their withdrawal or sanction explains it. Recorded as 0.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_PENDING]:
				'NEEDS ATTENTION. No grade of the type this course is evaluated with, and that evaluation is still open. Recorded as 0 with status "NR". Wait for the teacher to grade it and download again.',
			[GRADE_RC_OBSERVATIONS.MISSING_DESIGNATED_GRADE_UNEXPLAINED]:
				'NEEDS ATTENTION. No grade of the type this course is evaluated with and no reason for it. Recorded as 0 with status "NR". Review the case.',
			[GRADE_RC_OBSERVATIONS.FALLBACK_GRADE]:
				"NEEDS ATTENTION. The course has no grade type configured to be evaluated with: the student's last evaluation was used. Configure the course's grade type and download again.",
			[GRADE_RC_OBSERVATIONS.ZERO_GRADE_UNEXPLAINED]:
				'The grade is 0 and nothing indicates why. It may be a real 0 or an evaluation that was never graded.',
			[GRADE_RC_OBSERVATIONS.UNREGISTERED_STATUS]:
				'NEEDS ATTENTION. The qualification status is not registered in the system: it is shown exactly as it comes from the source. Check it before uploading.',
			[GRADE_RC_OBSERVATIONS.NO_SOURCE_GRADE_OR_STATUS]:
				'NEEDS ATTENTION. The source reports neither a grade nor a status for this evaluation: nothing indicates that the student sat it, or why they did not. It is shown as 0 with status "NR" as a default, not because the source system says so. Review the case before uploading.',
			[GRADE_RC_OBSERVATIONS.UNREGISTERED_GRADE_TYPE]:
				"NEEDS ATTENTION. The grade type is not registered in the system. Register it or configure the course's grade type, and download again.",
		},
	},
};
