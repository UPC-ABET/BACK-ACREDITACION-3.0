import { DelegatesUploadValidation, DelegatesLookups } from './delegates-upload.validation';
import { DelegateRow } from '../model/delegates-upload.types';
import { delegatesUploadStrings } from '../config/strings/delegates-upload.validation';

const E = delegatesUploadStrings.error;

function makeLookups(overrides: Partial<DelegatesLookups> = {}): DelegatesLookups {
	return {
		sseIdByKey: new Map([['CS101|A|U001', 500]]),
		alreadyDelegateSseIds: new Set<number>(),
		...overrides,
	};
}

function makeRow(overrides: Partial<DelegateRow> = {}): DelegateRow {
	return { rowNumber: 2, courseCode: 'CS101', sectionCode: 'A', studentCode: 'U001', ...overrides };
}

describe('DelegatesUploadValidation (paridad con USP_DelegadosCargaMasiva)', () => {
	describe('happy path', () => {
		it('fila válida → sin errores y con sseId resuelto', () => {
			const result = DelegatesUploadValidation.validateRow(makeRow(), makeLookups());
			expect(result.errors).toEqual([]);
			expect(result.sseId).toBe(500);
		});
	});

	describe('reglas 1-3 — códigos no vacíos', () => {
		it('courseCode vacío → courseCodeEmpty', () => {
			const result = DelegatesUploadValidation.validateRow(makeRow({ courseCode: '' }), makeLookups());
			expect(result.errors).toContain(E.courseCodeEmpty);
		});
		it('sectionCode vacío → sectionCodeEmpty', () => {
			const result = DelegatesUploadValidation.validateRow(makeRow({ sectionCode: '' }), makeLookups());
			expect(result.errors).toContain(E.sectionCodeEmpty);
		});
		it('studentCode vacío → studentCodeEmpty', () => {
			const result = DelegatesUploadValidation.validateRow(makeRow({ studentCode: '' }), makeLookups());
			expect(result.errors).toContain(E.studentCodeEmpty);
		});
	});

	describe('regla 4 — SSE existe', () => {
		it('SSE no encontrada → enrollmentNotFound', () => {
			const result = DelegatesUploadValidation.validateRow(makeRow({ studentCode: 'U999' }), makeLookups());
			expect(result.errors).toContain(E.enrollmentNotFound);
		});
		it('códigos vacíos NO disparan enrollmentNotFound', () => {
			const result = DelegatesUploadValidation.validateRow(makeRow({ studentCode: '' }), makeLookups());
			expect(result.errors).not.toContain(E.enrollmentNotFound);
		});
	});

	describe('regla 5 — dedup', () => {
		it('ya delegado → alreadyDelegate', () => {
			const lookups = makeLookups({ alreadyDelegateSseIds: new Set([500]) });
			const result = DelegatesUploadValidation.validateRow(makeRow(), lookups);
			expect(result.errors).toContain(E.alreadyDelegate);
		});
	});

	describe('múltiples errores', () => {
		it('acumula todos los aplicables', () => {
			const result = DelegatesUploadValidation.validateRow(
				makeRow({ courseCode: '', sectionCode: '', studentCode: '' }),
				makeLookups(),
			);
			expect(result.errors).toEqual(expect.arrayContaining([E.courseCodeEmpty, E.sectionCodeEmpty, E.studentCodeEmpty]));
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const rows = [makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, studentCode: 'U999' })];
			const results = DelegatesUploadValidation.validateAll(rows, makeLookups());
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.enrollmentNotFound);
		});
	});
});
