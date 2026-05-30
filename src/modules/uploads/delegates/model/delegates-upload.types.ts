// Tipos y constantes PUROS del flujo de carga de Delegados (sin deps de Nest/class-validator).
// Espejo del modelo legacy. Réplica del contrato de USP_DelegadosCargaMasiva — flujo UPDATE.

// Una fila del Excel de Delegados.
// Columnas legacy: CodigoCurso, CodigoSeccion, CodigoAlumno.
export interface DelegateRow {
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
