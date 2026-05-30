// Tipos y constantes PUROS del flujo de carga de Secciones (sin dependencias de Nest/class-validator).
// Separados de los DTOs decorados para que la validación sea testeable sin infra.

// Una fila del Excel de Secciones. Espejo de SectionsFileModel (ABET 2.0).
// Columnas legacy: CodigoCurso, Seccion, Docente, Local, TipoEstudio.
export interface SectionRow {
	rowNumber: number; // fila del Excel (1-based, incluye encabezado) para anotar errores
	courseCode: string;
	sectionCode: string;
	professorCode: string;
	campusCode: string;
	studyType: string; // 'P' | 'V' | 'S'
}

// Resultado por fila tras la validación (réplica de la columna RESULT del SP).
export interface RowValidationResult {
	rowNumber: number;
	errors: string[]; // vacío = OK
}

// Contrato de salida — espejo de CargaResultado (ABET 2.0).
export interface UploadResult {
	success: boolean;
	message: string | null;
	uploadLogId: number | null;
	totalRows: number;
	loadedRows: number;
	errorRows: number;
	// Excel anotado con la columna MensajeError (base64) cuando success = false.
	excelWithErrors: string | null;
	fileName: string | null;
}

// Mapeo TipoEstudio (legacy 'P'/'V'/'S') → code de modalidad TO-BE.
// Legacy colapsaba S y V en id=5; en TO-BE se separan (decisión manifiesto §14.5).
export const STUDY_TYPE_TO_MODALITY_CODE: Record<string, string> = {
	P: 'IN_PERSON',
	V: 'VIRTUAL',
	S: 'HYBRID',
};

export const VALID_STUDY_TYPES = Object.keys(STUDY_TYPE_TO_MODALITY_CODE);
