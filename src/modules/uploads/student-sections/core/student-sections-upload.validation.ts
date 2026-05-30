import { StudentSectionRow } from '../model/student-sections-upload.types';
import { studentSectionsUploadStrings } from '../config/strings/student-sections-upload.validation';

// Lookups pre-cargados con queries set-based.
export interface StudentSectionsLookups {
	courseSectionIdByKey: Map<string, number>; // `${courseCode}|${sectionCode}` → academic.course_sections.id
	enrolledStudentIdByCode: Map<string, number>; // student code → academic.enrolled_students.id (en el período)
	existingEnrollmentKeys: Set<string>; // `${enrolledStudentId}|${courseSectionId}` ya existentes
}

export interface ResolvedStudentSectionRow {
	rowNumber: number;
	errors: string[];
	courseSectionId?: number;
	enrolledStudentId?: number;
}

// Réplica pura de las validaciones de Usp_Carga_AlumnoSeccion.
export class StudentSectionsUploadValidation {
	static validateRow(row: StudentSectionRow, lookups: StudentSectionsLookups): ResolvedStudentSectionRow {
		const errors: string[] = [];

		const courseCode = (row.courseCode ?? '').trim();
		const sectionCode = (row.sectionCode ?? '').trim();
		const studentCode = (row.studentCode ?? '').trim();
		const sectionKey = `${courseCode}|${sectionCode}`;
		const courseSectionId = lookups.courseSectionIdByKey.get(sectionKey);
		const enrolledStudentId = lookups.enrolledStudentIdByCode.get(studentCode);

		// Regla 1: código de curso no vacío.
		if (courseCode === '') errors.push(studentSectionsUploadStrings.error.courseCodeEmpty);

		// Regla 2: la sección (curso+sección) debe existir.
		if (courseCode !== '' && courseSectionId === undefined) errors.push(studentSectionsUploadStrings.error.sectionNotFound);

		// Regla 3: código de alumno no vacío.
		if (studentCode === '') errors.push(studentSectionsUploadStrings.error.studentCodeEmpty);

		// Regla 4: el alumno debe estar matriculado en el período.
		if (studentCode !== '' && enrolledStudentId === undefined) errors.push(studentSectionsUploadStrings.error.studentNotEnrolled);

		// Regla 5: dedup alumno×sección.
		if (courseSectionId !== undefined && enrolledStudentId !== undefined) {
			const key = `${enrolledStudentId}|${courseSectionId}`;
			if (lookups.existingEnrollmentKeys.has(key)) errors.push(studentSectionsUploadStrings.error.enrollmentAlreadyExists);
		}

		return { rowNumber: row.rowNumber, errors, courseSectionId, enrolledStudentId };
	}

	static validateAll(rows: StudentSectionRow[], lookups: StudentSectionsLookups): ResolvedStudentSectionRow[] {
		return rows.map((row) => this.validateRow(row, lookups));
	}
}
