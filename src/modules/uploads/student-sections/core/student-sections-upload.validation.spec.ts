import { StudentSectionsUploadValidation, StudentSectionsLookups } from './student-sections-upload.validation';
import { StudentSectionRow } from '../model/student-sections-upload.types';
import { studentSectionsUploadStrings } from '../config/strings/student-sections-upload.validation';

const E = studentSectionsUploadStrings.error;

function makeLookups(overrides: Partial<StudentSectionsLookups> = {}): StudentSectionsLookups {
	return {
		courseSectionIdByKey: new Map([['CS101|A', 500]]),
		enrolledStudentIdByCode: new Map([['U001', 700]]),
		existingEnrollmentKeys: new Set<string>(),
		...overrides,
	};
}

function makeRow(overrides: Partial<StudentSectionRow> = {}): StudentSectionRow {
	return { rowNumber: 2, courseCode: 'CS101', sectionCode: 'A', studentCode: 'U001', ...overrides };
}

describe('StudentSectionsUploadValidation (paridad con Usp_Carga_AlumnoSeccion)', () => {
	describe('happy path', () => {
		it('fila válida → sin errores y con ids resueltos', () => {
			const r = StudentSectionsUploadValidation.validateRow(makeRow(), makeLookups());
			expect(r.errors).toEqual([]);
			expect(r.courseSectionId).toBe(500);
			expect(r.enrolledStudentId).toBe(700);
		});
	});

	describe('regla 1 — courseCode no vacío', () => {
		it('vacío → courseCodeEmpty', () => {
			const r = StudentSectionsUploadValidation.validateRow(makeRow({ courseCode: '' }), makeLookups());
			expect(r.errors).toContain(E.courseCodeEmpty);
		});
	});

	describe('regla 2 — sección existe', () => {
		it('curso+sección no encontrada → sectionNotFound', () => {
			const r = StudentSectionsUploadValidation.validateRow(makeRow({ sectionCode: 'Z' }), makeLookups());
			expect(r.errors).toContain(E.sectionNotFound);
		});
		it('courseCode vacío NO dispara sectionNotFound', () => {
			const r = StudentSectionsUploadValidation.validateRow(makeRow({ courseCode: '' }), makeLookups());
			expect(r.errors).not.toContain(E.sectionNotFound);
		});
	});

	describe('regla 3 — studentCode no vacío', () => {
		it('vacío → studentCodeEmpty', () => {
			const r = StudentSectionsUploadValidation.validateRow(makeRow({ studentCode: '' }), makeLookups());
			expect(r.errors).toContain(E.studentCodeEmpty);
		});
	});

	describe('regla 4 — alumno matriculado en el período', () => {
		it('enrolled no encontrado → studentNotEnrolled', () => {
			const r = StudentSectionsUploadValidation.validateRow(makeRow({ studentCode: 'U999' }), makeLookups());
			expect(r.errors).toContain(E.studentNotEnrolled);
		});
		it('studentCode vacío NO dispara studentNotEnrolled', () => {
			const r = StudentSectionsUploadValidation.validateRow(makeRow({ studentCode: '' }), makeLookups());
			expect(r.errors).not.toContain(E.studentNotEnrolled);
		});
	});

	describe('regla 5 — dedup alumno×sección', () => {
		it('ya inscrito → enrollmentAlreadyExists', () => {
			const lookups = makeLookups({ existingEnrollmentKeys: new Set(['700|500']) });
			const r = StudentSectionsUploadValidation.validateRow(makeRow(), lookups);
			expect(r.errors).toContain(E.enrollmentAlreadyExists);
		});
	});

	describe('múltiples errores', () => {
		it('acumula todos los aplicables', () => {
			const r = StudentSectionsUploadValidation.validateRow(
				makeRow({ courseCode: '', studentCode: '' }),
				makeLookups(),
			);
			expect(r.errors).toEqual(expect.arrayContaining([E.courseCodeEmpty, E.studentCodeEmpty]));
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const results = StudentSectionsUploadValidation.validateAll(
				[makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, studentCode: 'U999' })],
				makeLookups(),
			);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.studentNotEnrolled);
		});
	});
});
