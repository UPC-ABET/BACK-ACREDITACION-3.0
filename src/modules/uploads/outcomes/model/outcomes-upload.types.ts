// Tipos y constantes PUROS del flujo de carga de Malla COCOs / Outcomes (sin deps de Nest).
// Réplica de USP_OutcomeCargaMasiva. 5 tablas tocadas (3 catálogo upsert + 2 con upload_log_id).

// Una fila del Excel = 1 outcome asignado a 1 curso de una malla.
// Columnas: AcreditadoraCode, CommissionCode, ProgramCode, StudyPlanCode, CourseCode,
//           OutcomeCode, OutcomeNameEn, OutcomeDescription, OutcomeTypeCode (CONTROL/VERIFICACION).
export interface OutcomeRow {
	rowNumber: number;
	accreditorCode: string;
	commissionCode: string;
	programCode: string;
	studyPlanCode: string;
	courseCode: string;
	outcomeCode: string;
	outcomeNameEn: string;
	outcomeDescription: string;
	outcomeTypeCode: string; // CONTROL | VERIFICACION
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
