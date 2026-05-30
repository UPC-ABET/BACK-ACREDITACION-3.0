import { GradesBannerUploadValidation, GradesBannerLookups } from './grades-banner-upload.validation';
import { GradesBannerRow, parseGrade, parseWeight } from '../model/grades-banner-upload.types';
import { gradesBannerUploadStrings } from '../config/strings/grades-banner-upload.validation';

const E = gradesBannerUploadStrings.error;

function makeLookups(overrides: Partial<GradesBannerLookups> = {}): GradesBannerLookups {
	return {
		sseIdByKey: new Map([['CS101|A|U001', 500]]),
		gradeTypeIdByCode: new Map([['GRADE_PARTIAL', 1], ['GRADE_FINAL', 2]]),
		existingGradeKeys: new Set<string>(),
		...overrides,
	};
}

function makeRow(overrides: Partial<GradesBannerRow> = {}): GradesBannerRow {
	return {
		rowNumber: 2,
		studentCode: 'U001',
		courseCode: 'CS101',
		sectionCode: 'A',
		gradeTypeCode: 'GRADE_PARTIAL',
		grade: '15',
		weight: '30',
		...overrides,
	};
}

describe('parseGrade / parseWeight', () => {
	it('parseGrade vacío → null', () => expect(parseGrade('')).toBeNull());
	it('parseGrade outlier → null', () => expect(parseGrade('99999')).toBeNull());
	it('parseGrade decimal con coma', () => expect(parseWeight('30,5')).toBe(30.5));
	it('parseWeight vacío → null', () => expect(parseWeight('')).toBeNull());
});

describe('GradesBannerUploadValidation (paridad con usp_InsertarAlumnoNotasRCBannerScraping)', () => {
	describe('happy path', () => {
		it('fila válida → sin errores', () => {
			const result = GradesBannerUploadValidation.validateRow(makeRow(), makeLookups());
			expect(result.errors).toEqual([]);
			expect(result.sseId).toBe(500);
			expect(result.gradeTypeId).toBe(1);
			expect(result.grade).toBe(15);
		});
	});

	describe('reglas 1-3 — códigos no vacíos', () => {
		it('studentCode vacío', () => {
			const r = GradesBannerUploadValidation.validateRow(makeRow({ studentCode: '' }), makeLookups());
			expect(r.errors).toContain(E.studentCodeEmpty);
		});
		it('courseCode vacío', () => {
			const r = GradesBannerUploadValidation.validateRow(makeRow({ courseCode: '' }), makeLookups());
			expect(r.errors).toContain(E.courseCodeEmpty);
		});
		it('sectionCode vacío', () => {
			const r = GradesBannerUploadValidation.validateRow(makeRow({ sectionCode: '' }), makeLookups());
			expect(r.errors).toContain(E.sectionCodeEmpty);
		});
	});

	describe('regla 4 — SSE existe', () => {
		it('SSE no encontrada → enrollmentNotFound', () => {
			const r = GradesBannerUploadValidation.validateRow(makeRow({ studentCode: 'U999' }), makeLookups());
			expect(r.errors).toContain(E.enrollmentNotFound);
		});
	});

	describe('regla 5 — GRADE_TYPE válido', () => {
		it('tipo no reconocido → gradeTypeInvalid', () => {
			const r = GradesBannerUploadValidation.validateRow(makeRow({ gradeTypeCode: 'ZZZ' }), makeLookups());
			expect(r.errors).toContain(E.gradeTypeInvalid);
		});
	});

	describe('regla 6 — nota parseable', () => {
		it('nota acrónimo RET → gradeInvalid', () => {
			const r = GradesBannerUploadValidation.validateRow(makeRow({ grade: 'RET' }), makeLookups());
			expect(r.errors).toContain(E.gradeInvalid);
		});
	});

	describe('regla 7 — dedup', () => {
		it('nota ya existe → gradeAlreadyExists', () => {
			const r = GradesBannerUploadValidation.validateRow(
				makeRow(),
				makeLookups({ existingGradeKeys: new Set(['500|1']) }),
			);
			expect(r.errors).toContain(E.gradeAlreadyExists);
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const results = GradesBannerUploadValidation.validateAll(
				[makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, gradeTypeCode: 'ZZZ' })],
				makeLookups(),
			);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.gradeTypeInvalid);
		});
	});
});
