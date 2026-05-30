import { ScrapingBannerUploadValidation, ScrapingBannerLookups } from './scraping-banner-upload.validation';
import { ScrapingBannerRow } from '../model/scraping-banner-upload.types';
import { scrapingBannerUploadStrings } from '../config/strings/scraping-banner-upload.validation';

const E = scrapingBannerUploadStrings.error;

function makeLookups(overrides: Partial<ScrapingBannerLookups> = {}): ScrapingBannerLookups {
	return {
		programIdByCode: new Map([['INF', 5]]),
		academicPeriodIdByCode: new Map([['2024-1', 1]]),
		campusIdByCode: new Map([['LIMA', 30]]),
		courseIdByCode: new Map([['CS101', 10]]),
		professorIdByCode: new Map([['PROF1', 20]]),
		modalityTypeIdByCode: new Map([['UG', 100], ['IN_PERSON', 101], ['VIRTUAL', 102]]),
		...overrides,
	};
}

function makeRow(overrides: Partial<ScrapingBannerRow> = {}): ScrapingBannerRow {
	return {
		rowNumber: 2,
		studentCode: 'U001',
		firstName: 'Juan',
		lastName: 'Perez',
		institutionalEmail: 'u001@upc.edu.pe',
		personalEmail: '',
		mobilePhone: '',
		programCode: 'INF',
		graduationModalityCode: 'UG',
		academicPeriodCode: '2024-1',
		campusCode: 'LIMA',
		enrollmentModalityCode: 'IN_PERSON',
		sectionCode: 'A',
		courseCodeFull: 'CS101',
		professorCode: 'PROF1',
		...overrides,
	};
}

describe('ScrapingBannerUploadValidation', () => {
	describe('happy path', () => {
		it('fila válida → sin errores', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow(), makeLookups(), 1);
			expect(r.errors).toEqual([]);
			expect(r.programId).toBe(5);
			expect(r.academicPeriodId).toBe(1);
			expect(r.courseId).toBe(10);
			expect(r.professorId).toBe(20);
			expect(r.graduationModalityId).toBe(100);
			expect(r.enrollmentModalityId).toBe(101);
		});

		it('sin academicPeriodCode usa fallback del DTO', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ academicPeriodCode: '' }), makeLookups(), 999);
			expect(r.academicPeriodId).toBe(999);
		});
	});

	describe('todos los lookups requeridos', () => {
		it('studentCode vacío', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ studentCode: '' }), makeLookups(), 1);
			expect(r.errors).toContain(E.studentCodeEmpty);
		});
		it('programa', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ programCode: 'NOPE' }), makeLookups(), 1);
			expect(r.errors).toContain(E.programNotFound);
		});
		it('campus', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ campusCode: 'NOPE' }), makeLookups(), 1);
			expect(r.errors).toContain(E.campusNotFound);
		});
		it('curso', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ courseCodeFull: 'NOPE' }), makeLookups(), 1);
			expect(r.errors).toContain(E.courseNotFound);
		});
		it('docente', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ professorCode: 'X' }), makeLookups(), 1);
			expect(r.errors).toContain(E.professorNotFound);
		});
		it('modalidad graduación', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ graduationModalityCode: 'X' }), makeLookups(), 1);
			expect(r.errors).toContain(E.graduationModalityInvalid);
		});
		it('modalidad enrollment', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ enrollmentModalityCode: 'X' }), makeLookups(), 1);
			expect(r.errors).toContain(E.enrollmentModalityInvalid);
		});
		it('sectionCode vacío', () => {
			const r = ScrapingBannerUploadValidation.validateRow(makeRow({ sectionCode: '' }), makeLookups(), 1);
			expect(r.errors).toContain(E.sectionCodeEmpty);
		});
	});

	describe('validateAll', () => {
		it('conserva rowNumber', () => {
			const results = ScrapingBannerUploadValidation.validateAll(
				[makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, courseCodeFull: 'NOPE' })],
				makeLookups(),
				1,
			);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.courseNotFound);
		});
	});
});
