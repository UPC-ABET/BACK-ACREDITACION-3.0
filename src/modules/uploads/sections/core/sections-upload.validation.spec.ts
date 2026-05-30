import { SectionsUploadValidation, SectionsLookups } from './sections-upload.validation';
import { SectionRow } from '../model/sections-upload.types';
import { sectionsUploadStrings } from '../config/strings/sections-upload.validation';

const E = sectionsUploadStrings.error;

// Lookups base con TODO válido. Cada test desactiva una dimensión para forzar su error.
function makeLookups(overrides: Partial<SectionsLookups> = {}): SectionsLookups {
	return {
		courseIdByCode: new Map([['CS101', 10]]),
		studyPlanCourseIdByCourseId: new Map([[10, 100]]),
		professorIdByCode: new Map([['PROF1', 20]]),
		campusIdByCode: new Map([['LIMA', 30]]),
		modalityTypeIdByStudyType: new Map([
			['P', 8],
			['V', 9],
			['S', 11],
		]),
		existingSectionKeys: new Set<string>(),
		...overrides,
	};
}

// Fila base válida. Override por test.
function makeRow(overrides: Partial<SectionRow> = {}): SectionRow {
	return {
		rowNumber: 2,
		courseCode: 'CS101',
		sectionCode: 'A',
		professorCode: 'PROF1',
		campusCode: 'LIMA',
		studyType: 'P',
		...overrides,
	};
}

describe('SectionsUploadValidation (paridad con FN_Valida_Secciones)', () => {
	describe('happy path', () => {
		it('fila válida → sin errores y con ids resueltos', () => {
			const result = SectionsUploadValidation.validateRow(makeRow(), makeLookups());
			expect(result.errors).toEqual([]);
			expect(result.studyPlanCourseId).toBe(100);
			expect(result.professorId).toBe(20);
			expect(result.campusId).toBe(30);
			expect(result.sectionModalityTypeId).toBe(8);
			expect(result.sectionCode).toBe('A');
		});

		it('mapea TipoEstudio con trim + uppercase (" p " → P)', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ studyType: ' p ' }), makeLookups());
			expect(result.errors).toEqual([]);
			expect(result.sectionModalityTypeId).toBe(8);
		});

		it('mapea V → VIRTUAL y S → HYBRID (ids distintos, sin colisión del legacy)', () => {
			const v = SectionsUploadValidation.validateRow(makeRow({ studyType: 'V' }), makeLookups());
			const s = SectionsUploadValidation.validateRow(makeRow({ studyType: 'S' }), makeLookups());
			expect(v.sectionModalityTypeId).toBe(9);
			expect(s.sectionModalityTypeId).toBe(11);
			expect(v.errors).toEqual([]);
			expect(s.errors).toEqual([]);
		});
	});

	describe('regla 1 — curso existe', () => {
		it('curso no registrado → courseNotFound', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ courseCode: 'NOPE' }), makeLookups());
			expect(result.errors).toContain(E.courseNotFound);
		});
	});

	describe('regla 2 — curso en la malla del período', () => {
		it('curso existe pero no está en la malla → courseNotInStudyPlan', () => {
			const lookups = makeLookups({ studyPlanCourseIdByCourseId: new Map() });
			const result = SectionsUploadValidation.validateRow(makeRow(), lookups);
			expect(result.errors).toContain(E.courseNotInStudyPlan);
			expect(result.errors).not.toContain(E.courseNotFound);
		});

		it('curso inexistente NO dispara courseNotInStudyPlan (solo courseNotFound)', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ courseCode: 'NOPE' }), makeLookups());
			expect(result.errors).toContain(E.courseNotFound);
			expect(result.errors).not.toContain(E.courseNotInStudyPlan);
		});
	});

	describe('regla 3 — docente existe', () => {
		it('docente no registrado → professorNotFound', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ professorCode: 'X' }), makeLookups());
			expect(result.errors).toContain(E.professorNotFound);
		});
	});

	describe('regla 4 — sede existe', () => {
		it('sede no registrada → campusNotFound', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ campusCode: 'X' }), makeLookups());
			expect(result.errors).toContain(E.campusNotFound);
		});
	});

	describe('regla 5 — código de sección no vacío', () => {
		it('sección vacía → sectionCodeEmpty', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ sectionCode: '   ' }), makeLookups());
			expect(result.errors).toContain(E.sectionCodeEmpty);
		});
	});

	describe('regla 6 — sección no duplicada', () => {
		it('sección ya registrada → sectionAlreadyExists', () => {
			const lookups = makeLookups({ existingSectionKeys: new Set(['100|30|A']) });
			const result = SectionsUploadValidation.validateRow(makeRow(), lookups);
			expect(result.errors).toContain(E.sectionAlreadyExists);
		});

		it('misma clave pero distinta sede NO es duplicado', () => {
			const lookups = makeLookups({ existingSectionKeys: new Set(['100|99|A']) });
			const result = SectionsUploadValidation.validateRow(makeRow(), lookups);
			expect(result.errors).not.toContain(E.sectionAlreadyExists);
		});
	});

	describe('TipoEstudio', () => {
		it('vacío → studyTypeEmpty', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ studyType: '' }), makeLookups());
			expect(result.errors).toContain(E.studyTypeEmpty);
		});

		it('inválido (no P/V/S) → studyTypeInvalid', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ studyType: 'Z' }), makeLookups());
			expect(result.errors).toContain(E.studyTypeInvalid);
		});

		it('vacío NO dispara studyTypeInvalid', () => {
			const result = SectionsUploadValidation.validateRow(makeRow({ studyType: '' }), makeLookups());
			expect(result.errors).not.toContain(E.studyTypeInvalid);
		});
	});

	describe('múltiples errores en una fila', () => {
		it('acumula todos los errores aplicables', () => {
			const row = makeRow({ courseCode: 'NOPE', professorCode: 'X', campusCode: 'Y', sectionCode: '', studyType: 'Z' });
			const result = SectionsUploadValidation.validateRow(row, makeLookups());
			expect(result.errors).toEqual(
				expect.arrayContaining([E.courseNotFound, E.professorNotFound, E.campusNotFound, E.sectionCodeEmpty, E.studyTypeInvalid]),
			);
		});
	});

	describe('validateAll', () => {
		it('valida un lote y conserva el rowNumber de cada fila', () => {
			const rows = [makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, courseCode: 'NOPE' })];
			const results = SectionsUploadValidation.validateAll(rows, makeLookups());
			expect(results).toHaveLength(2);
			expect(results[0].rowNumber).toBe(2);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.courseNotFound);
		});
	});
});
