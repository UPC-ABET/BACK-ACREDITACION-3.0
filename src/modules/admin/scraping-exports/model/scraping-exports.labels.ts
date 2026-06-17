// Column headers + output file names for each generated export. Headers mirror the matching
// uploads/* template (so the file reads naturally and stays upload-compatible), with the extra
// docente `email` column appended. The upload parsers read positionally, so the leading columns
// must keep the template order.

export const DEFAULT_TEMPLATE_LANGUAGE = 'es';

export interface ExportLabels {
	headers: string[];
	fileName: string;
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
		headers: ['Course code', 'Section code', 'Professor code', 'Campus code', 'Section modality code'],
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
		headers: ['Student code', 'Last name', 'First name', 'Program code', 'Campus code', 'Enrollment modality code'],
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
