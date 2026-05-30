import { PppUploadValidation, PppLookups } from './ppp-upload.validation';
import { PppRow, parseScore, buildSurveyInformation } from '../model/ppp-upload.types';
import { pppUploadStrings } from '../config/strings/ppp-upload.validation';

const E = pppUploadStrings.error;

function makeLookups(overrides: Partial<PppLookups> = {}): PppLookups {
	return {
		surveyTypeIdByCode: new Map([['PPP', 1]]),
		surveyStatusTypeIdByCode: new Map([['SURVEY_ACTIVE', 10], ['SURVEY_INACTIVE', 11]]),
		studentIdByCode: new Map([['U001', 100]]),
		academicPeriodIdByCode: new Map([['2024-1', 200]]),
		campusIdByCode: new Map([['LIMA', 30]]),
		programIdByCode: new Map([['INF', 5]]),
		outcomeIdByKey: new Map([['1|INF', 700]]),
		...overrides,
	};
}

function makeRow(overrides: Partial<PppRow> = {}): PppRow {
	return {
		rowNumber: 2,
		surveyTypeCode: 'PPP',
		surveyStatusCode: 'ACT',
		studentCode: 'U001',
		academicPeriodCode: '2024-1',
		campusCode: 'LIMA',
		programCode: 'INF',
		surveyNumber: '42',
		razonSocial: 'EMP X',
		nombreJefe: 'J',
		cargoJefe: 'C',
		telefonoJefe: '999',
		correoJefe: 'j@x',
		ruc: '20',
		totalHoras: '480',
		numeroInforme: '1',
		fechaInicio: '2024-01-01',
		fechaFin: '2024-06-30',
		comentario: '-',
		outcomeCode: '1',
		score: '3.5',
		...overrides,
	};
}

describe('parseScore / buildSurveyInformation', () => {
	it('parseScore vacío → null', () => expect(parseScore('')).toBeNull());
	it('parseScore decimal con coma', () => expect(parseScore('3,5')).toBe(3.5));
	it('buildSurveyInformation incluye los 12 campos', () => {
		const info = buildSurveyInformation(makeRow());
		expect(info.razon_social).toBe('EMP X');
		expect(info.ruc).toBe('20');
		expect(info.fecha_registro).toBeDefined();
	});
});

describe('PppUploadValidation', () => {
	describe('happy path', () => {
		it('fila válida + ACT → SURVEY_ACTIVE', () => {
			const r = PppUploadValidation.validateRow(makeRow(), makeLookups());
			expect(r.errors).toEqual([]);
			expect(r.surveyStatusTypeId).toBe(10);
			expect(r.score).toBe(3.5);
		});
	});

	describe('reglas — lookups requeridos', () => {
		it('surveyType inválido', () => {
			const r = PppUploadValidation.validateRow(makeRow({ surveyTypeCode: 'X' }), makeLookups());
			expect(r.errors).toContain(E.surveyTypeInvalid);
		});
		it('surveyStatus inválido', () => {
			const r = PppUploadValidation.validateRow(makeRow({ surveyStatusCode: 'X' }), makeLookups());
			expect(r.errors).toContain(E.surveyStatusInvalid);
		});
		it('student no existe', () => {
			const r = PppUploadValidation.validateRow(makeRow({ studentCode: 'Z' }), makeLookups());
			expect(r.errors).toContain(E.studentNotFound);
		});
		it('period no existe', () => {
			const r = PppUploadValidation.validateRow(makeRow({ academicPeriodCode: 'Z' }), makeLookups());
			expect(r.errors).toContain(E.academicPeriodNotFound);
		});
		it('campus no existe', () => {
			const r = PppUploadValidation.validateRow(makeRow({ campusCode: 'Z' }), makeLookups());
			expect(r.errors).toContain(E.campusNotFound);
		});
		it('program no existe', () => {
			const r = PppUploadValidation.validateRow(makeRow({ programCode: 'Z' }), makeLookups());
			expect(r.errors).toContain(E.programNotFound);
		});
		it('surveyNumber vacío', () => {
			const r = PppUploadValidation.validateRow(makeRow({ surveyNumber: '' }), makeLookups());
			expect(r.errors).toContain(E.surveyNumberEmpty);
		});
		it('outcome no encontrado (matching frágil)', () => {
			const r = PppUploadValidation.validateRow(makeRow({ outcomeCode: 'ZZ' }), makeLookups());
			expect(r.errors).toContain(E.outcomeNotFound);
		});
		it('score no parseable → scoreInvalid', () => {
			const r = PppUploadValidation.validateRow(makeRow({ score: 'abc' }), makeLookups());
			expect(r.errors).toContain(E.scoreInvalid);
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const results = PppUploadValidation.validateAll(
				[makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, score: 'abc' })],
				makeLookups(),
			);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.scoreInvalid);
		});
	});
});
