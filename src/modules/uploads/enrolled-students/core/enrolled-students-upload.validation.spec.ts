import { EnrolledStudentsUploadValidation, EnrolledStudentsLookups } from './enrolled-students-upload.validation';
import { EnrolledStudentRow, splitFullName } from '../model/enrolled-students-upload.types';
import { enrolledStudentsUploadStrings } from '../config/strings/enrolled-students-upload.validation';

const E = enrolledStudentsUploadStrings.error;

function makeLookups(overrides: Partial<EnrolledStudentsLookups> = {}): EnrolledStudentsLookups {
	return {
		programIdByCode: new Map([['INF', 5]]),
		campusIdByCode: new Map([['LIMA', 30]]),
		enrollmentStatusTypeIdByCode: new Map([['MATRICULADO', 7]]),
		existingStudentCodes: new Set<string>(),
		...overrides,
	};
}

function makeRow(overrides: Partial<EnrolledStudentRow> = {}): EnrolledStudentRow {
	return {
		rowNumber: 2,
		studentCode: 'U001',
		fullName: 'PEREZ GOMEZ, JUAN',
		programCode: 'INF',
		enrollmentStatus: 'MATRICULADO',
		campusCode: 'LIMA',
		...overrides,
	};
}

describe('splitFullName (réplica del split por coma del SP)', () => {
	it('"Apellidos, Nombres" → lastName/firstName', () => {
		expect(splitFullName('PEREZ GOMEZ, JUAN CARLOS')).toEqual({ lastName: 'PEREZ GOMEZ', firstName: 'JUAN CARLOS' });
	});
	it('sin coma → todo es firstName', () => {
		expect(splitFullName('JUAN')).toEqual({ lastName: '', firstName: 'JUAN' });
	});
	it('recorta espacios alrededor de la coma', () => {
		expect(splitFullName('  PEREZ ,  JUAN ')).toEqual({ lastName: 'PEREZ', firstName: 'JUAN' });
	});
});

describe('EnrolledStudentsUploadValidation (paridad con USP_AlumnoMatriculadoCargaMasiva)', () => {
	describe('happy path', () => {
		it('fila válida → sin errores y con ids resueltos', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow(), makeLookups());
			expect(result.errors).toEqual([]);
			expect(result.programId).toBe(5);
			expect(result.campusId).toBe(30);
			expect(result.enrollmentStatusTypeId).toBe(7);
			expect(result.studentCode).toBe('U001');
		});

		it('mapea ESTADO MATRICULA con trim + uppercase (" matriculado " → 7)', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow({ enrollmentStatus: ' matriculado ' }), makeLookups());
			expect(result.errors).toEqual([]);
			expect(result.enrollmentStatusTypeId).toBe(7);
		});
	});

	describe('regla 1 — código de alumno', () => {
		it('vacío → studentCodeEmpty', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow({ studentCode: '   ' }), makeLookups());
			expect(result.errors).toContain(E.studentCodeEmpty);
		});
	});

	describe('regla 2 — nombre completo', () => {
		it('vacío → fullNameEmpty', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow({ fullName: '' }), makeLookups());
			expect(result.errors).toContain(E.fullNameEmpty);
		});
	});

	describe('regla 3 — carrera existe', () => {
		it('carrera no registrada → programNotFound', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow({ programCode: 'NOPE' }), makeLookups());
			expect(result.errors).toContain(E.programNotFound);
		});
	});

	describe('regla 4 — sede existe', () => {
		it('sede no registrada → campusNotFound', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow({ campusCode: 'X' }), makeLookups());
			expect(result.errors).toContain(E.campusNotFound);
		});
	});

	describe('regla 5 — estado de matrícula', () => {
		it('vacío → enrollmentStatusEmpty', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow({ enrollmentStatus: '' }), makeLookups());
			expect(result.errors).toContain(E.enrollmentStatusEmpty);
		});
		it('no reconocido → enrollmentStatusInvalid', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow({ enrollmentStatus: 'ZZZ' }), makeLookups());
			expect(result.errors).toContain(E.enrollmentStatusInvalid);
		});
		it('vacío NO dispara enrollmentStatusInvalid', () => {
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow({ enrollmentStatus: '' }), makeLookups());
			expect(result.errors).not.toContain(E.enrollmentStatusInvalid);
		});
	});

	describe('regla 6 — dedup por código', () => {
		it('alumno ya matriculado → studentAlreadyExists', () => {
			const lookups = makeLookups({ existingStudentCodes: new Set(['U001']) });
			const result = EnrolledStudentsUploadValidation.validateRow(makeRow(), lookups);
			expect(result.errors).toContain(E.studentAlreadyExists);
		});
	});

	describe('múltiples errores', () => {
		it('acumula todos los aplicables', () => {
			const row = makeRow({ studentCode: '', fullName: '', programCode: 'X', campusCode: 'Y', enrollmentStatus: 'Z' });
			const result = EnrolledStudentsUploadValidation.validateRow(row, makeLookups());
			expect(result.errors).toEqual(
				expect.arrayContaining([E.studentCodeEmpty, E.fullNameEmpty, E.programNotFound, E.campusNotFound, E.enrollmentStatusInvalid]),
			);
		});
	});

	describe('validateAll', () => {
		it('conserva el rowNumber de cada fila', () => {
			const rows = [makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, programCode: 'NOPE' })];
			const results = EnrolledStudentsUploadValidation.validateAll(rows, makeLookups());
			expect(results).toHaveLength(2);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.programNotFound);
		});
	});
});
