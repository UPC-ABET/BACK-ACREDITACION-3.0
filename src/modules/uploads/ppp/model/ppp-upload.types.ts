// Tipos y constantes PUROS del flujo de carga PPP (sin deps de Nest).
// Réplica de POST /excel/upload-PPP (ExcelService — EF puro, sin SP de inserción).
// Una fila Excel = 1 (encuesta × score por outcome). Misma encuesta repite SurveyNumber entre rows.

export interface PppRow {
	rowNumber: number;
	surveyTypeCode: string;       // PPP / FDC / GRA / EVD / LCFC → core.types/SURVEY_TYPE
	surveyStatusCode: string;     // ACT/INA → SURVEY_ACTIVE/SURVEY_INACTIVE → core.types/SURVEY_STATUS
	studentCode: string;          // academic.students via users.code
	academicPeriodCode: string;
	campusCode: string;
	programCode: string;
	surveyNumber: string;         // NroEncuesta
	// Bloque `information` (jsonb): 12 campos del legacy.
	razonSocial: string;
	nombreJefe: string;
	cargoJefe: string;
	telefonoJefe: string;
	correoJefe: string;
	ruc: string;
	totalHoras: string;
	numeroInforme: string;
	fechaInicio: string;
	fechaFin: string;
	comentario: string;
	// Performance (1 outcome × score por fila).
	outcomeCode: string;
	score: string;
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

// Construye el jsonb `information` con los 12 campos del legacy. Réplica del jsonb_build_object documentado en MAPEO B1.
export function buildSurveyInformation(row: PppRow): Record<string, string> {
	return {
		razon_social: row.razonSocial ?? '',
		nombre_jefe: row.nombreJefe ?? '',
		cargo_jefe: row.cargoJefe ?? '',
		telefono_jefe: row.telefonoJefe ?? '',
		correo_jefe: row.correoJefe ?? '',
		ruc: row.ruc ?? '',
		total_horas: row.totalHoras ?? '',
		numero_informe: row.numeroInforme ?? '',
		fecha_inicio: row.fechaInicio ?? '',
		fecha_fin: row.fechaFin ?? '',
		comentario: row.comentario ?? '',
		fecha_registro: new Date().toISOString(),
	};
}

export function parseScore(value: string): number | null {
	const v = (value ?? '').trim();
	if (v === '') return null;
	const n = Number(v.replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}
