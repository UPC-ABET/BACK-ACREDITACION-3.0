// Tipos y constantes PUROS del flujo de carga de Alumnos Matriculados (sin deps de Nest/class-validator).
// Espejo de EnrolledStudentsFileModel (ABET 2.0). Réplica del contrato de USP_AlumnoMatriculadoCargaMasiva.

// Una fila del Excel de Alumnos Matriculados.
// Columnas legacy: CÓDIGO ALUMNO, NOMBRE COMPLETO, CARRERA, ESTADO MATRICULA, SEDE.
export interface EnrolledStudentRow {
	rowNumber: number; // fila del Excel (1-based, incluye encabezado) para anotar errores
	studentCode: string;
	fullName: string; // "Apellidos, Nombres" (el SP legacy lo parte por la coma)
	programCode: string; // carrera
	enrollmentStatus: string; // ESTADO MATRICULA
	campusCode: string; // sede
}

export interface RowValidationResult {
	rowNumber: number;
	errors: string[];
}

export interface UploadResult {
	success: boolean;
	message: string | null;
	uploadLogId: number | null;
	totalRows: number;
	loadedRows: number;
	errorRows: number;
	excelWithErrors: string | null;
	fileName: string | null;
}

// Nombre completo legacy "Apellidos, Nombres" → { lastName, firstName }.
// Réplica del split por la primera coma que hace el SP. Sin coma → todo es firstName.
export function splitFullName(fullName: string): { lastName: string; firstName: string } {
	const trimmed = (fullName ?? '').trim();
	const comma = trimmed.indexOf(',');
	if (comma === -1) return { lastName: '', firstName: trimmed };
	return { lastName: trimmed.slice(0, comma).trim(), firstName: trimmed.slice(comma + 1).trim() };
}
