import { GradesRcRow } from '../model/grades-rc-upload.types';
import { gradesRcUploadStrings } from '../config/strings/grades-rc-upload.validation';

// Lookups pre-cargados con queries set-based.
export interface GradesRcLookups {
	sseIdByKey: Map<string, number>;          // `${courseCode}|${sectionCode}|${studentCode}` → SSE.id
	gradeTypeIdByCode: Map<string, number>;   // core.types/GRADE_TYPE.code → id (los 4: PARTIAL/FINAL/FDM/REAL)
	existingGradeKeys: Set<string>;           // `${sseId}|${gradeTypeId}` ya registrados
}

export interface ResolvedGradesRcRow {
	rowNumber: number;
	errors: string[];
	sseId?: number;
}

export class GradesRcUploadValidation {
	static validateRow(row: GradesRcRow, lookups: GradesRcLookups): ResolvedGradesRcRow {
		const errors: string[] = [];

		const courseCode = (row.courseCode ?? '').trim();
		const sectionCode = (row.sectionCode ?? '').trim();
		const studentCode = (row.studentCode ?? '').trim();
		const sseId = lookups.sseIdByKey.get(`${courseCode}|${sectionCode}|${studentCode}`);

		if (courseCode === '') errors.push(gradesRcUploadStrings.error.courseCodeEmpty);
		if (sectionCode === '') errors.push(gradesRcUploadStrings.error.sectionCodeEmpty);
		if (studentCode === '') errors.push(gradesRcUploadStrings.error.studentCodeEmpty);
		if (courseCode !== '' && sectionCode !== '' && studentCode !== '' && sseId === undefined) {
			errors.push(gradesRcUploadStrings.error.enrollmentNotFound);
		}

		// Catálogo GRADE_TYPE debe tener los 4 codes esperados.
		if (lookups.gradeTypeIdByCode.size < 4) errors.push(gradesRcUploadStrings.error.gradeTypeCatalogMissing);

		// Dedup: si CUALQUIER tipo de nota ya está cargado para esta SSE → error
		// (la carga es ALL-OR-NOTHING por fila Excel).
		if (sseId !== undefined) {
			for (const gtId of lookups.gradeTypeIdByCode.values()) {
				if (lookups.existingGradeKeys.has(`${sseId}|${gtId}`)) {
					errors.push(gradesRcUploadStrings.error.gradeAlreadyExists);
					break;
				}
			}
		}

		return { rowNumber: row.rowNumber, errors, sseId };
	}

	static validateAll(rows: GradesRcRow[], lookups: GradesRcLookups): ResolvedGradesRcRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
