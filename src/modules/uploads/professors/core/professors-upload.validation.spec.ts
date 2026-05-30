import { ProfessorsUploadValidation, ProfessorsLookups } from './professors-upload.validation';
import { ProfessorRow } from '../model/professors-upload.types';
import { professorsUploadStrings } from '../config/strings/professors-upload.validation';

const E = professorsUploadStrings.error;

function makeLookups(overrides: Partial<ProfessorsLookups> = {}): ProfessorsLookups {
	return {
		positionTypeIdDocente: 11,
		existingStaffCodes: new Set<string>(),
		existingStaffEmails: new Set<string>(),
		...overrides,
	};
}

function makeRow(overrides: Partial<ProfessorRow> = {}): ProfessorRow {
	return {
		rowNumber: 2,
		userName: 'juan.perez@upc.edu.pe',
		name: 'Juan Perez Gomez',
		...overrides,
	};
}

describe('ProfessorsUploadValidation (paridad con USP_DocenteCargaMasiva)', () => {
	describe('happy path', () => {
		it('fila válida → sin errores y con userName resuelto', () => {
			const result = ProfessorsUploadValidation.validateRow(makeRow(), makeLookups());
			expect(result.errors).toEqual([]);
			expect(result.userName).toBe('juan.perez@upc.edu.pe');
		});
	});

	describe('regla 1 — userName no vacío', () => {
		it('vacío → userNameEmpty', () => {
			const result = ProfessorsUploadValidation.validateRow(makeRow({ userName: '   ' }), makeLookups());
			expect(result.errors).toContain(E.userNameEmpty);
		});
	});

	describe('regla 2 — name no vacío', () => {
		it('vacío → nameEmpty', () => {
			const result = ProfessorsUploadValidation.validateRow(makeRow({ name: '' }), makeLookups());
			expect(result.errors).toContain(E.nameEmpty);
		});
	});

	describe('regla 3 — dedup', () => {
		it('userName ya en staff.code → professorAlreadyExists', () => {
			const lookups = makeLookups({ existingStaffCodes: new Set(['juan.perez@upc.edu.pe']) });
			const result = ProfessorsUploadValidation.validateRow(makeRow(), lookups);
			expect(result.errors).toContain(E.professorAlreadyExists);
		});
		it('userName ya en staff.staff_email → professorAlreadyExists', () => {
			const lookups = makeLookups({ existingStaffEmails: new Set(['juan.perez@upc.edu.pe']) });
			const result = ProfessorsUploadValidation.validateRow(makeRow(), lookups);
			expect(result.errors).toContain(E.professorAlreadyExists);
		});
		it('userName vacío NO dispara dedup', () => {
			const lookups = makeLookups({ existingStaffCodes: new Set(['']) });
			const result = ProfessorsUploadValidation.validateRow(makeRow({ userName: '' }), lookups);
			expect(result.errors).not.toContain(E.professorAlreadyExists);
		});
	});

	describe('regla 4 — catálogo DOCENTE', () => {
		it('positionTypeIdDocente undefined → positionTypeMissing', () => {
			const result = ProfessorsUploadValidation.validateRow(makeRow(), makeLookups({ positionTypeIdDocente: undefined }));
			expect(result.errors).toContain(E.positionTypeMissing);
		});
	});

	describe('múltiples errores', () => {
		it('acumula todos los aplicables', () => {
			const result = ProfessorsUploadValidation.validateRow(
				makeRow({ userName: '', name: '' }),
				makeLookups({ positionTypeIdDocente: undefined }),
			);
			expect(result.errors).toEqual(expect.arrayContaining([E.userNameEmpty, E.nameEmpty, E.positionTypeMissing]));
		});
	});

	describe('validateAll', () => {
		it('conserva el rowNumber de cada fila', () => {
			const rows = [makeRow({ rowNumber: 2 }), makeRow({ rowNumber: 3, userName: '' })];
			const results = ProfessorsUploadValidation.validateAll(rows, makeLookups());
			expect(results).toHaveLength(2);
			expect(results[0].errors).toEqual([]);
			expect(results[1].rowNumber).toBe(3);
			expect(results[1].errors).toContain(E.userNameEmpty);
		});
	});
});
