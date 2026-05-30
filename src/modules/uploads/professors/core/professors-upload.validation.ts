import { ProfessorRow } from '../model/professors-upload.types';
import { professorsUploadStrings } from '../config/strings/professors-upload.validation';

// Lookups pre-cargados con queries set-based (1 query por dimensión, no N+1).
export interface ProfessorsLookups {
	positionTypeIdDocente?: number; // id de DOCENTE en core.types/POSITION_TYPE — required para insert
	existingStaffCodes: Set<string>; // codes ya presentes en organization.staff (dedup)
	existingStaffEmails: Set<string>; // staff_emails ya presentes en organization.staff (dedup)
}

// Fila resuelta a ids — lista para INSERT cuando errors está vacío.
export interface ResolvedProfessorRow {
	rowNumber: number;
	errors: string[];
	userName?: string;
	firstName?: string;
	lastName?: string;
}

// Réplica pura de las validaciones de USP_DocenteCargaMasiva.
// Pura a propósito: permite tests de regresión 1:1 contra el SP legacy (paridad de comportamiento).
export class ProfessorsUploadValidation {
	static validateRow(row: ProfessorRow, lookups: ProfessorsLookups): ResolvedProfessorRow {
		const errors: string[] = [];

		const userName = (row.userName ?? '').trim();
		const name = (row.name ?? '').trim();

		// Regla 1: UserName (correo) no vacío.
		if (userName === '') errors.push(professorsUploadStrings.error.userNameEmpty);

		// Regla 2: Name no vacío.
		if (name === '') errors.push(professorsUploadStrings.error.nameEmpty);

		// Regla 3: el docente no debe existir ya (por code o por staff_email).
		if (userName !== '' && (lookups.existingStaffCodes.has(userName) || lookups.existingStaffEmails.has(userName))) {
			errors.push(professorsUploadStrings.error.professorAlreadyExists);
		}

		// Regla 4: el catálogo DOCENTE debe existir en core.types (precondición del insert).
		if (lookups.positionTypeIdDocente === undefined) errors.push(professorsUploadStrings.error.positionTypeMissing);

		// Split del Name → firstName/lastName se calcula en el service (heurística por espacio).
		// Acá solo se devuelve el userName resuelto.
		return { rowNumber: row.rowNumber, errors, userName };
	}

	static validateAll(rows: ProfessorRow[], lookups: ProfessorsLookups): ResolvedProfessorRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
