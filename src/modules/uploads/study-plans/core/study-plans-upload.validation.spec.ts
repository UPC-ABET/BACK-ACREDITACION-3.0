import { StudyPlansUploadValidation, StudyPlansLookups } from './study-plans-upload.validation';
import { StudyPlanRow, parseBooleanLike, parsePrerequisites } from '../model/study-plans-upload.types';
import { studyPlansUploadStrings } from '../config/strings/study-plans-upload.validation';

const E = studyPlansUploadStrings.error;

function makeLookups(overrides: Partial<StudyPlansLookups> = {}): StudyPlansLookups {
	return {
		programIdByCode: new Map([['INF', 5]]),
		levelTypeIdByCode: new Map([['BASIC', 1]]),
		existingCourseIdByCode: new Map([['ma101', 10], ['cs101', 11]]),
		existingStudyPlanIdByCode: new Map(),
		existingSpcCodes: new Set<string>(),
		rowCourseCodes: new Set(['MA101', 'CS101']),
		...overrides,
	};
}

function makeRow(overrides: Partial<StudyPlanRow> = {}): StudyPlanRow {
	return {
		rowNumber: 2,
		studyPlanCode: 'MALLA-2024',
		studyPlanName: 'Malla 2024',
		programCode: 'INF',
		courseCode: 'CS101',
		courseName: 'Algoritmos',
		isElective: 'false',
		levelTypeCode: 'BASIC',
		prerequisites: 'MA101',
		...overrides,
	};
}

describe('parseBooleanLike / parsePrerequisites', () => {
	it('true / SI / 1 → true', () => {
		expect(parseBooleanLike('true')).toBe(true);
		expect(parseBooleanLike('SI')).toBe(true);
		expect(parseBooleanLike('1')).toBe(true);
	});
	it('false / 0 / vacío → false', () => {
		expect(parseBooleanLike('false')).toBe(false);
		expect(parseBooleanLike('0')).toBe(false);
		expect(parseBooleanLike('')).toBe(false);
	});
	it('parsePrerequisites split por espacios + dedup', () => {
		expect(parsePrerequisites('A B  C A')).toEqual(['A', 'B', 'C']);
	});
});

describe('StudyPlansUploadValidation', () => {
	describe('happy path', () => {
		it('fila válida → sin errores', () => {
			const r = StudyPlansUploadValidation.validateRow(makeRow(), makeLookups());
			expect(r.errors).toEqual([]);
			expect(r.programId).toBe(5);
			expect(r.levelTypeId).toBe(1);
			expect(r.prerequisites).toEqual(['MA101']);
		});
	});

	describe('regla 1 — codigo malla', () => {
		it('vacío → studyPlanCodeEmpty', () => {
			const r = StudyPlansUploadValidation.validateRow(makeRow({ studyPlanCode: '' }), makeLookups());
			expect(r.errors).toContain(E.studyPlanCodeEmpty);
		});
	});

	describe('regla 2 — carrera', () => {
		it('no existe → programNotFound', () => {
			const r = StudyPlansUploadValidation.validateRow(makeRow({ programCode: 'NOPE' }), makeLookups());
			expect(r.errors).toContain(E.programNotFound);
		});
	});

	describe('regla 3-4 — curso codigo+nombre', () => {
		it('codigo curso vacío', () => {
			const r = StudyPlansUploadValidation.validateRow(makeRow({ courseCode: '' }), makeLookups());
			expect(r.errors).toContain(E.courseCodeEmpty);
		});
		it('nombre curso vacío', () => {
			const r = StudyPlansUploadValidation.validateRow(makeRow({ courseName: '' }), makeLookups());
			expect(r.errors).toContain(E.courseNameEmpty);
		});
	});

	describe('regla 5 — LEVEL_TYPE (OPCIONAL — pendiente definición de negocio, 2026-05-29)', () => {
		it('inválido → NO genera error (nivel opcional; ver TODO LEVEL_TYPE en la validación)', () => {
			const r = StudyPlansUploadValidation.validateRow(makeRow({ levelTypeCode: 'NOPE' }), makeLookups());
			expect(r.errors).not.toContain(E.levelTypeInvalid);
		});
	});

	describe('regla 6 — prerrequisitos', () => {
		it('prerequisito que no existe ni en BD ni en lote → prerequisiteNotFound', () => {
			const r = StudyPlansUploadValidation.validateRow(makeRow({ prerequisites: 'ZZZ' }), makeLookups());
			expect(r.errors).toContain(E.prerequisiteNotFound);
		});
		it('prerequisito intra-lote OK', () => {
			const r = StudyPlansUploadValidation.validateRow(makeRow({ prerequisites: 'CS101' }), makeLookups());
			expect(r.errors).not.toContain(E.prerequisiteNotFound);
		});
	});

	describe('regla 7 — dedup curso×malla', () => {
		it('ya en la malla → courseAlreadyInStudyPlan', () => {
			const r = StudyPlansUploadValidation.validateRow(
				makeRow(),
				makeLookups({ existingSpcCodes: new Set(['MALLA-2024|CS101']) }),
			);
			expect(r.errors).toContain(E.courseAlreadyInStudyPlan);
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const results = StudyPlansUploadValidation.validateAll(
				[makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, programCode: 'NOPE' })],
				makeLookups(),
			);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.programNotFound);
		});
	});
});
