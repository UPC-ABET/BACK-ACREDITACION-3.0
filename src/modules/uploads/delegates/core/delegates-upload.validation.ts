import { DelegateRow } from '../model/delegates-upload.types';
import { delegatesUploadStrings } from '../config/strings/delegates-upload.validation';

// Lookups pre-cargados con queries set-based.
export interface DelegatesLookups {
	sseIdByKey: Map<string, number>;          // `${courseCode}|${sectionCode}|${studentCode}` → academic.student_section_enrollments.id
	alreadyDelegateSseIds: Set<number>;       // SSE ids con is_delegate=true (dedup)
}

export interface ResolvedDelegateRow {
	rowNumber: number;
	errors: string[];
	sseId?: number;
}

// Réplica pura de las validaciones de USP_DelegadosCargaMasiva.
export class DelegatesUploadValidation {
	static validateRow(row: DelegateRow, lookups: DelegatesLookups): ResolvedDelegateRow {
		const errors: string[] = [];

		const courseCode = (row.courseCode ?? '').trim();
		const sectionCode = (row.sectionCode ?? '').trim();
		const studentCode = (row.studentCode ?? '').trim();
		const key = `${courseCode}|${sectionCode}|${studentCode}`;
		const sseId = lookups.sseIdByKey.get(key);

		// Regla 1: códigos no vacíos.
		if (courseCode === '') errors.push(delegatesUploadStrings.error.courseCodeEmpty);
		if (sectionCode === '') errors.push(delegatesUploadStrings.error.sectionCodeEmpty);
		if (studentCode === '') errors.push(delegatesUploadStrings.error.studentCodeEmpty);

		// Regla 2: el alumno debe estar matriculado en la sección (SSE existe).
		if (courseCode !== '' && sectionCode !== '' && studentCode !== '' && sseId === undefined) {
			errors.push(delegatesUploadStrings.error.enrollmentNotFound);
		}

		// Regla 3: dedup — no marcar dos veces como delegado.
		if (sseId !== undefined && lookups.alreadyDelegateSseIds.has(sseId)) {
			errors.push(delegatesUploadStrings.error.alreadyDelegate);
		}

		return { rowNumber: row.rowNumber, errors, sseId };
	}

	static validateAll(rows: DelegateRow[], lookups: DelegatesLookups): ResolvedDelegateRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
