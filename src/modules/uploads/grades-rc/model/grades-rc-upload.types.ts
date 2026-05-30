// Tipos y constantes PUROS del flujo de carga de Notas RC (sin deps de Nest).
// Réplica de USP_GradesRCCargaMasiva (ABET 2.0). Una fila Excel → N filas en student_course_grades (unpivot).

// Una fila del Excel de Notas RC = 1 alumno×sección con sus 4 notas planas.
export interface GradesRcRow {
	rowNumber: number;
	courseCode: string;
	sectionCode: string;
	studentCode: string;
	partialGrade: string;
	finalGrade: string;
	fdmGrade: string;
	realGrade: string;
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

// Sanitiza nota legacy → numeric|null. Acrónimos (RET/NR/PEN/DPI/SAN) y outliers (>=10000) → null.
// Réplica del guard del SP (§14.8: gap pendiente — no se preserva el código en TO-BE).
export function parseGrade(value: string): number | null {
	const v = (value ?? '').trim();
	if (v === '') return null;
	const cleaned = v.replace(/[^0-9.]/g, '');
	if (cleaned === '' || cleaned === '.') return null;
	const n = Number(cleaned);
	if (!Number.isFinite(n) || n >= 10000) return null;
	return n;
}

// Mapeo posición Excel → code en core.types/GRADE_TYPE (MAPEO_ASIS_TOBE.md A4).
export const GRADE_TYPE_CODES = {
	partial: 'GRADE_PARTIAL',
	final: 'GRADE_FINAL',
	fdm: 'GRADE_FDM',
	real: 'GRADE_REAL',
} as const;
