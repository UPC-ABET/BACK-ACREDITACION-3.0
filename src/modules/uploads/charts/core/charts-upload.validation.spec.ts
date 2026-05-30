import { ChartsUploadValidation, ChartsLookups } from './charts-upload.validation';
import { ChartRow } from '../model/charts-upload.types';
import { chartsUploadStrings } from '../config/strings/charts-upload.validation';

const E = chartsUploadStrings.error;

function makeLookups(overrides: Partial<ChartsLookups> = {}): ChartsLookups {
	return {
		chartLevelIdByLevel: new Map([[1, 10], [2, 11], [3, 12]]),
		entityTypeIdByCode: new Map([['SCHOOL', 100], ['PROGRAM', 101]]),
		staffIdByCode: new Map([['user@upc', 50]]),
		campusIdByCode: new Map([['LIMA', 30]]),
		existingChartIdByEntityCode: new Map(),
		rowEntityCodes: new Set(['E001']),
		...overrides,
	};
}

function makeRow(overrides: Partial<ChartRow> = {}): ChartRow {
	return {
		rowNumber: 2,
		entityCode: 'E001',
		name: 'Escuela X',
		level: '1',
		entityTypeCode: 'SCHOOL',
		responsibleUserName: 'user@upc',
		campusCode: '',
		parentEntityCode: '',
		...overrides,
	};
}

describe('ChartsUploadValidation (paridad con USP_OrganigramaCargaMasiva)', () => {
	describe('happy path', () => {
		it('fila válida → sin errores y con ids resueltos', () => {
			const r = ChartsUploadValidation.validateRow(makeRow(), makeLookups());
			expect(r.errors).toEqual([]);
			expect(r.chartLevelId).toBe(10);
			expect(r.entityTypeId).toBe(100);
			expect(r.staffId).toBe(50);
		});
	});

	describe('regla 1 — entity_code', () => {
		it('vacío → entityCodeEmpty', () => {
			const r = ChartsUploadValidation.validateRow(makeRow({ entityCode: '' }), makeLookups());
			expect(r.errors).toContain(E.entityCodeEmpty);
		});
	});

	describe('regla 2 — nombre', () => {
		it('vacío → nameEmpty', () => {
			const r = ChartsUploadValidation.validateRow(makeRow({ name: '' }), makeLookups());
			expect(r.errors).toContain(E.nameEmpty);
		});
	});

	describe('regla 3 — nivel válido', () => {
		it('nivel fuera de chart_levels → levelInvalid', () => {
			const r = ChartsUploadValidation.validateRow(makeRow({ level: '99' }), makeLookups());
			expect(r.errors).toContain(E.levelInvalid);
		});
		it('nivel no numérico → levelInvalid', () => {
			const r = ChartsUploadValidation.validateRow(makeRow({ level: 'abc' }), makeLookups());
			expect(r.errors).toContain(E.levelInvalid);
		});
	});

	describe('regla 4 — tipo de entidad', () => {
		it('no reconocido → entityTypeInvalid', () => {
			const r = ChartsUploadValidation.validateRow(makeRow({ entityTypeCode: 'NOPE' }), makeLookups());
			expect(r.errors).toContain(E.entityTypeInvalid);
		});
	});

	describe('regla 5 — responsable', () => {
		it('no existe → responsibleNotFound', () => {
			const r = ChartsUploadValidation.validateRow(makeRow({ responsibleUserName: 'xxx' }), makeLookups());
			expect(r.errors).toContain(E.responsibleNotFound);
		});
	});

	describe('regla 6 — sede opcional', () => {
		it('sede dada que no existe → campusNotFound', () => {
			const r = ChartsUploadValidation.validateRow(makeRow({ campusCode: 'NOPE' }), makeLookups());
			expect(r.errors).toContain(E.campusNotFound);
		});
		it('sede vacía NO dispara campusNotFound', () => {
			const r = ChartsUploadValidation.validateRow(makeRow({ campusCode: '' }), makeLookups());
			expect(r.errors).not.toContain(E.campusNotFound);
		});
	});

	describe('regla 7 — padre', () => {
		it('padre intra-lote OK', () => {
			const r = ChartsUploadValidation.validateRow(
				makeRow({ parentEntityCode: 'E001' }),
				makeLookups({ rowEntityCodes: new Set(['E001']) }),
			);
			expect(r.errors).not.toContain(E.parentNotFound);
		});
		it('padre que no existe en lote ni BD → parentNotFound', () => {
			const r = ChartsUploadValidation.validateRow(
				makeRow({ parentEntityCode: 'NOPADRE' }),
				makeLookups(),
			);
			expect(r.errors).toContain(E.parentNotFound);
		});
	});

	describe('regla 8 — dedup', () => {
		it('entity_code ya cargado → chartAlreadyExists', () => {
			const r = ChartsUploadValidation.validateRow(
				makeRow(),
				makeLookups({ existingChartIdByEntityCode: new Map([['E001', 999]]) }),
			);
			expect(r.errors).toContain(E.chartAlreadyExists);
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const results = ChartsUploadValidation.validateAll(
				[makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, level: '99' })],
				makeLookups(),
			);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.levelInvalid);
		});
	});
});
