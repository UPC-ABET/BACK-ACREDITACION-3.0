// Tipos y constantes PUROS del flujo de carga de Malla Curricular (sin deps de Nest/class-validator).
// Réplica de USP_MallaCurricularCargaMasiva (ABET 2.0).

// Una fila del Excel de Malla = 1 curso dentro de una malla en el período.
// Columnas legacy: CodigoMalla, NombreMalla, CodigoCarrera, CodigoCurso, NombreCurso, EsElectivo, NivelCurso, Requisitos.
export interface StudyPlanRow {
	rowNumber: number;
	studyPlanCode: string;       // academic.study_plans.code
	studyPlanName: string;       // study_plans.name (jsonb i18n)
	programCode: string;         // academic.programs.code
	courseCode: string;          // academic.courses.code
	courseName: string;          // courses.name (jsonb i18n)
	isElective: string;          // 'true' / 'false' / 'Sí' / 'SI' / '1' / '0'
	levelTypeCode: string;       // core.types/LEVEL_TYPE.code
	prerequisites: string;       // códigos de curso separados por espacio (manifiesto §14.6)
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

// Heurística "Sí" / "true" / "1" → true. Réplica del cast EsElectivo BIT del legacy.
export function parseBooleanLike(value: string): boolean {
	const v = (value ?? '').trim().toUpperCase();
	return v === 'TRUE' || v === '1' || v === 'SI' || v === 'SÍ' || v === 'YES' || v === 'Y';
}

// "MA101 FI201 IN305" → ["MA101", "FI201", "IN305"]. Dedup intra-lista.
export function parsePrerequisites(value: string): string[] {
	const v = (value ?? '').trim();
	if (v === '') return [];
	return [...new Set(v.split(/\s+/).map((c) => c.trim()).filter(Boolean))];
}
