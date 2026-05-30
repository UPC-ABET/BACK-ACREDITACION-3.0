import { GradesRcUploadValidation, GradesRcLookups } from './grades-rc-upload.validation';
import { GradesRcRow, parseGrade } from '../model/grades-rc-upload.types';
import { gradesRcUploadStrings } from '../config/strings/grades-rc-upload.validation';

const E = gradesRcUploadStrings.error;

function makeLookups(overrides: Partial<GradesRcLookups> = {}): GradesRcLookups {
	return {
		sseIdByKey: new Map([['CS101|A|U001', 500]]),
		gradeTypeIdByCode: new Map([
			['GRADE_PARTIAL', 1],
			['GRADE_FINAL', 2],
			['GRADE_FDM', 3],
			['GRADE_REAL', 4],
		]),
		existingGradeKeys: new Set<string>(),
		...overrides,
	};
}

function makeRow(overrides: Partial<GradesRcRow> = {}): GradesRcRow {
	return {
		rowNumber: 2,
		courseCode: 'CS101',
		sectionCode: 'A',
		studentCode: 'U001',
		partialGrade: '15',
		finalGrade: '16',
		fdmGrade: '15.5',
		realGrade: '15.5',
		...overrides,
	};
}

describe('parseGrade (sanitize legacy)', () => {
	it('vacío → null', () => expect(parseGrade('')).toBeNull());
	it('numero válido', () => expect(parseGrade('15.5')).toBe(15.5));
	it('acrónimo RET → null (gap §14.8)', () => expect(parseGrade('RET')).toBeNull());
	it('outlier >= 10000 → null', () => expect(parseGrade('99999')).toBeNull());
});

describe('GradesRcUploadValidation (paridad con USP_GradesRCCargaMasiva)', () => {
	describe('happy path', () => {
		it('fila válida → sin errores y con sseId', () => {
			const result = GradesRcUploadValidation.validateRow(makeRow(), makeLookups());
			expect(result.errors).toEqual([]);
			expect(result.sseId).toBe(500);
		});
	});

	describe('reglas 1-3 — códigos no vacíos', () => {
		it('courseCode vacío', () => {
			const result = GradesRcUploadValidation.validateRow(makeRow({ courseCode: '' }), makeLookups());
			expect(result.errors).toContain(E.courseCodeEmpty);
		});
		it('sectionCode vacío', () => {
			const result = GradesRcUploadValidation.validateRow(makeRow({ sectionCode: '' }), makeLookups());
			expect(result.errors).toContain(E.sectionCodeEmpty);
		});
		it('studentCode vacío', () => {
			const result = GradesRcUploadValidation.validateRow(makeRow({ studentCode: '' }), makeLookups());
			expect(result.errors).toContain(E.studentCodeEmpty);
		});
	});

	describe('regla 4 — SSE existe', () => {
		it('SSE no encontrada → enrollmentNotFound', () => {
			const result = GradesRcUploadValidation.validateRow(makeRow({ studentCode: 'U999' }), makeLookups());
			expect(result.errors).toContain(E.enrollmentNotFound);
		});
	});

	describe('regla 5 — catálogo GRADE_TYPE completo', () => {
		it('faltan codes → gradeTypeCatalogMissing', () => {
			const result = GradesRcUploadValidation.validateRow(
				makeRow(),
				makeLookups({ gradeTypeIdByCode: new Map([['GRADE_PARTIAL', 1]]) }),
			);
			expect(result.errors).toContain(E.gradeTypeCatalogMissing);
		});
	});

	describe('regla 6 — dedup', () => {
		it('alguna nota ya existe para la SSE → gradeAlreadyExists', () => {
			const result = GradesRcUploadValidation.validateRow(
				makeRow(),
				makeLookups({ existingGradeKeys: new Set(['500|1']) }),
			);
			expect(result.errors).toContain(E.gradeAlreadyExists);
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const results = GradesRcUploadValidation.validateAll(
				[makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, studentCode: 'U999' })],
				makeLookups(),
			);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.enrollmentNotFound);
		});
	});
});
