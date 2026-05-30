import { EnrolledStudentRow } from '../model/enrolled-students-upload.types';
import { enrolledStudentsUploadStrings } from '../config/strings/enrolled-students-upload.validation';

// Lookups pre-cargados por el servicio con queries set-based (1 query por dimensión, no N+1).
export interface EnrolledStudentsLookups {
	programIdByCode: Map<string, number>; // carrera code → academic.programs.id
	campusIdByCode: Map<string, number>; // organization.campuses.code → id
	enrollmentStatusTypeIdByCode: Map<string, number>; // ESTADO MATRICULA → core type id
	existingStudentCodes: Set<string>; // códigos de alumno ya matriculados en el período (dedup)
}

// Fila resuelta a ids — lista para INSERT cuando errors está vacío.
export interface ResolvedEnrolledStudentRow {
	rowNumber: number;
	errors: string[];
	studentCode?: string;
	fullName?: string;
	programId?: number;
	campusId?: number;
	enrollmentStatusTypeId?: number;
}

// Réplica pura de las validaciones de USP_AlumnoMatriculadoCargaMasiva.
// Pura a propósito: permite tests de regresión 1:1 contra el SP legacy (paridad de comportamiento).
export class EnrolledStudentsUploadValidation {
	static validateRow(row: EnrolledStudentRow, lookups: EnrolledStudentsLookups): ResolvedEnrolledStudentRow {
		const errors: string[] = [];

		const code = (row.studentCode ?? '').trim();
		const enrollmentStatus = (row.enrollmentStatus ?? '').trim().toUpperCase();
		const programId = lookups.programIdByCode.get((row.programCode ?? '').trim());
		const campusId = lookups.campusIdByCode.get((row.campusCode ?? '').trim());
		const enrollmentStatusTypeId = lookups.enrollmentStatusTypeIdByCode.get(enrollmentStatus);

		// Regla 1: código de alumno no vacío.
		if (code === '') errors.push(enrolledStudentsUploadStrings.error.studentCodeEmpty);

		// Regla 2: nombre completo no vacío.
		if (!row.fullName || row.fullName.trim() === '') errors.push(enrolledStudentsUploadStrings.error.fullNameEmpty);

		// Regla 3: carrera registrada.
		if (programId === undefined) errors.push(enrolledStudentsUploadStrings.error.programNotFound);

		// Regla 4: sede registrada.
		if (campusId === undefined) errors.push(enrolledStudentsUploadStrings.error.campusNotFound);

		// Regla 5: estado de matrícula no vacío y reconocido.
		if (enrollmentStatus === '') errors.push(enrolledStudentsUploadStrings.error.enrollmentStatusEmpty);
		else if (enrollmentStatusTypeId === undefined) errors.push(enrolledStudentsUploadStrings.error.enrollmentStatusInvalid);

		// Regla 6: dedup por código de alumno en el período.
		if (code !== '' && lookups.existingStudentCodes.has(code)) errors.push(enrolledStudentsUploadStrings.error.studentAlreadyExists);

		return {
			rowNumber: row.rowNumber,
			errors,
			studentCode: code,
			fullName: row.fullName?.trim(),
			programId,
			campusId,
			enrollmentStatusTypeId,
		};
	}

	static validateAll(rows: EnrolledStudentRow[], lookups: EnrolledStudentsLookups): ResolvedEnrolledStudentRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
