// Tipos PUROS del flujo Alumno×Sección (sin deps de Nest/class-validator).
// Espejo de StudentsPerClassFileModel (ABET 2.0). Réplica de USP_AlumnoSeccionCargaMasiva → Usp_Carga_AlumnoSeccion.

// Una fila del Excel. Columnas legacy: codigo_curso, codigo_seccion, codigo_alumno.
export interface StudentSectionRow {
	rowNumber: number;
	courseCode: string;
	sectionCode: string;
	studentCode: string;
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
