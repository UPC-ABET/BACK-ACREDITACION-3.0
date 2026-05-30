// Tipos y constantes PUROS del flujo de carga Notas Banner Scraping (C3, sin deps de Nest).
// Réplica de usp_InsertarAlumnoNotasRCBannerScraping. Una fila Excel = 1 (alumno × curso × nrc × tipoNota).
// A diferencia de A4 (RC manual), aquí TipoNota y Peso vienen explícitos en cada fila.

export interface GradesBannerRow {
	rowNumber: number;
	studentCode: string;     // CodigoAlumno
	courseCode: string;      // CursoCodigo
	sectionCode: string;     // Nrc
	gradeTypeCode: string;   // TipoNota → core.types/GRADE_TYPE (PARTIAL/FINAL/FDM/REAL)
	grade: string;           // Nota
	weight: string;          // Peso → student_course_grades.grade_type_percentage
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
// Mismo guard que A4 (MAPEO_ASIS_TOBE.md A4 + C3).
export function parseGrade(value: string): number | null {
	const v = (value ?? '').trim();
	if (v === '') return null;
	const cleaned = v.replace(/[^0-9.]/g, '');
	if (cleaned === '' || cleaned === '.') return null;
	const n = Number(cleaned);
	if (!Number.isFinite(n) || n >= 10000) return null;
	return n;
}

export function parseWeight(value: string): number | null {
	const v = (value ?? '').trim();
	if (v === '') return null;
	const n = Number(v.replace(',', '.'));
	return Number.isFinite(n) ? n : null;
}
