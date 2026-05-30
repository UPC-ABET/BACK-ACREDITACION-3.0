import { OutcomesUploadValidation, OutcomesLookups } from './outcomes-upload.validation';
import { OutcomeRow } from '../model/outcomes-upload.types';
import { outcomesUploadStrings } from '../config/strings/outcomes-upload.validation';

const E = outcomesUploadStrings.error;

function makeLookups(overrides: Partial<OutcomesLookups> = {}): OutcomesLookups {
	return {
		programIdByCode: new Map([['INF', 5]]),
		spcIdByPlanCourse: new Map([['MALLA-2024|CS101', 100]]),
		outcomeTypeIdByCode: new Map([['CONTROL', 1], ['VERIFICACION', 2]]),
		existingMappingKeys: new Set<string>(),
		...overrides,
	};
}

function makeRow(overrides: Partial<OutcomeRow> = {}): OutcomeRow {
	return {
		rowNumber: 2,
		accreditorCode: 'ABET',
		commissionCode: 'EAC',
		programCode: 'INF',
		studyPlanCode: 'MALLA-2024',
		courseCode: 'CS101',
		outcomeCode: '1',
		outcomeNameEn: 'Engineering Knowledge',
		outcomeDescription: 'Conocimiento de ingeniería',
		outcomeTypeCode: 'CONTROL',
		...overrides,
	};
}

describe('OutcomesUploadValidation', () => {
	describe('happy path', () => {
		it('fila válida → sin errores', () => {
			const r = OutcomesUploadValidation.validateRow(makeRow(), makeLookups());
			expect(r.errors).toEqual([]);
			expect(r.programId).toBe(5);
			expect(r.spcId).toBe(100);
			expect(r.outcomeTypeId).toBe(1);
		});
	});

	describe('regla 1 — acreditador', () => {
		it('vacío → accreditorCodeEmpty', () => {
			const r = OutcomesUploadValidation.validateRow(makeRow({ accreditorCode: '' }), makeLookups());
			expect(r.errors).toContain(E.accreditorCodeEmpty);
		});
	});

	describe('regla 2 — comisión', () => {
		it('vacío → commissionCodeEmpty', () => {
			const r = OutcomesUploadValidation.validateRow(makeRow({ commissionCode: '' }), makeLookups());
			expect(r.errors).toContain(E.commissionCodeEmpty);
		});
	});

	describe('regla 3 — carrera', () => {
		it('no existe → programNotFound', () => {
			const r = OutcomesUploadValidation.validateRow(makeRow({ programCode: 'NOPE' }), makeLookups());
			expect(r.errors).toContain(E.programNotFound);
		});
	});

	describe('regla 4 — SPC en la malla', () => {
		it('no existe → studyPlanCourseNotFound', () => {
			const r = OutcomesUploadValidation.validateRow(makeRow({ courseCode: 'NOPE' }), makeLookups());
			expect(r.errors).toContain(E.studyPlanCourseNotFound);
		});
	});

	describe('regla 5 — outcome', () => {
		it('vacío → outcomeCodeEmpty', () => {
			const r = OutcomesUploadValidation.validateRow(makeRow({ outcomeCode: '' }), makeLookups());
			expect(r.errors).toContain(E.outcomeCodeEmpty);
		});
	});

	describe('regla 6 — tipo outcome', () => {
		it('inválido → outcomeTypeInvalid', () => {
			const r = OutcomesUploadValidation.validateRow(makeRow({ outcomeTypeCode: 'NOPE' }), makeLookups());
			expect(r.errors).toContain(E.outcomeTypeInvalid);
		});
	});

	describe('regla 7 — dedup', () => {
		it('outcome×SPC ya mapeado → outcomeAlreadyMapped', () => {
			const r = OutcomesUploadValidation.validateRow(
				makeRow(),
				makeLookups({ existingMappingKeys: new Set(['1|100']) }),
			);
			expect(r.errors).toContain(E.outcomeAlreadyMapped);
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const results = OutcomesUploadValidation.validateAll(
				[makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, outcomeCode: '' })],
				makeLookups(),
			);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.outcomeCodeEmpty);
		});
	});
});
