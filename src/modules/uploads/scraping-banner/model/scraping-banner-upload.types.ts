// Tipos y constantes PUROS del flujo de carga Scraping Banner (C1+C2 combinados, sin deps de Nest).
// Réplica de usp_InsertarAlumnoSeccionBannerScraping (C1) + usp_InsertarAlumnoPersonalBannerScraping (C2).
// Excel exportado del Banner API (vs DTO JSON): un row = 1 alumno × 1 sección × 1 periodo, con datos personales.

export interface ScrapingBannerRow {
	rowNumber: number;
	// C2 (personal)
	studentCode: string;          // organization.users.code (clave natural)
	firstName: string;
	lastName: string;
	institutionalEmail: string;   // users.email
	personalEmail: string;        // bug #8 — se persistiría si la columna estuviera disponible
	mobilePhone: string;          // ídem
	// Programa / período / sede
	programCode: string;
	graduationModalityCode: string; // Nivel → MODALITY_TYPE.code (PG/UG → modality)
	academicPeriodCode: string;
	campusCode: string;
	enrollmentModalityCode: string; // MetodoEducativoCodigo → MODALITY_TYPE.code
	// C1 (sección/curso/docente)
	sectionCode: string;          // Nrc
	courseCodeFull: string;       // CursoCodigoFull
	professorCode: string;        // DocenteIdBanner / staff.code
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
