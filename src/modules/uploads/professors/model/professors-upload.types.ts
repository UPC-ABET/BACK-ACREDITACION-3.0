// Tipos y constantes PUROS del flujo de carga de Docentes (sin deps de Nest/class-validator).
// Espejo de ProfessorsFileModel (ABET 2.0). Réplica del contrato de USP_DocenteCargaMasiva.

// Una fila del Excel de Docentes.
// Columnas legacy: UserName, Name.
export interface ProfessorRow {
	rowNumber: number; // fila del Excel (1-based, incluye encabezado) para anotar errores
	userName: string;  // correo corporativo — clave natural en organization.users.email + staff.staff_email + staff.code + professors.code
	name: string;      // nombre completo (sin coma) — se parte por el primer espacio
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

// Nombre completo "Nombres Apellidos" (sin coma en el modelo legacy de docentes) → { firstName, lastName }.
// Heurística: primer token = firstName, resto = lastName. MAPEO_ASIS_TOBE.md A3: "Transformación (split por espacio)".
export function splitProfessorName(name: string): { firstName: string; lastName: string } {
	const trimmed = (name ?? '').trim().replace(/\s+/g, ' ');
	if (trimmed === '') return { firstName: '', lastName: '' };
	const space = trimmed.indexOf(' ');
	if (space === -1) return { firstName: trimmed, lastName: '' };
	return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) };
}

// Code del tipo POSITION_TYPE que identifica a un docente en core.types.
export const DOCENTE_POSITION_CODE = 'TEACHER';
