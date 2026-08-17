import { DomainError } from 'src/commons/domain-error';
import { PppValidation, type PppExcelRow } from './ppp.validation';
import { pppValidationStrings } from '../config/strings/ppp.validation';

const mockRepo = {
	existsPpp: jest.fn(),
	findOnePpp: jest.fn(),
};

describe('PppValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreateConfig', () => {
		const dto = { outcomeId: 1, programId: 2, academicPeriodId: 3 } as any;

		it('passes when no config exists for the (outcome, program, period)', async () => {
			mockRepo.existsPpp.mockResolvedValue(false);
			await expect(
				PppValidation.validateCreateConfig(mockRepo as any, dto),
			).resolves.toBeUndefined();
		});

		it('throws when a config already exists', async () => {
			mockRepo.existsPpp.mockResolvedValue(true);
			await expect(PppValidation.validateCreateConfig(mockRepo as any, dto)).rejects.toThrow(
				DomainError,
			);
		});
	});

	describe('validateUpdateConfig', () => {
		it('passes when the config exists', async () => {
			mockRepo.findOnePpp.mockResolvedValue({ id: 1 });
			await expect(PppValidation.validateUpdateConfig(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws 404 when the config does not exist', async () => {
			mockRepo.findOnePpp.mockResolvedValue(null);
			let caught: DomainError | undefined;
			try {
				await PppValidation.validateUpdateConfig(mockRepo as any, 999);
			} catch (e) {
				caught = e as DomainError;
			}
			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('notFound');
		});
	});

	describe('validateDeleteConfig', () => {
		it('passes when the config exists', async () => {
			mockRepo.findOnePpp.mockResolvedValue({ id: 1 });
			await expect(PppValidation.validateDeleteConfig(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws 404 when the config does not exist', async () => {
			mockRepo.findOnePpp.mockResolvedValue(null);
			await expect(PppValidation.validateDeleteConfig(mockRepo as any, 999)).rejects.toThrow(
				DomainError,
			);
		});
	});

	describe('validateCreateSurvey', () => {
		const validDto = { practiceNumber: 1, scores: [{ outcomeId: 1, score: 3 }] } as any;

		it('passes for a valid survey payload', () => {
			expect(() => PppValidation.validateCreateSurvey(validDto)).not.toThrow();
		});

		it('passes when a valid 11-digit RUC is provided', () => {
			expect(() =>
				PppValidation.validateCreateSurvey({ ...validDto, ruc: '12345678901' }),
			).not.toThrow();
		});

		it('throws when the practice number is not 1 or 2', () => {
			expect(() => PppValidation.validateCreateSurvey({ ...validDto, practiceNumber: 3 })).toThrow(
				DomainError,
			);
		});

		it('throws when the scores list is empty', () => {
			expect(() => PppValidation.validateCreateSurvey({ ...validDto, scores: [] })).toThrow(
				DomainError,
			);
		});

		it('throws when a score is out of range', () => {
			expect(() =>
				PppValidation.validateCreateSurvey({
					...validDto,
					scores: [{ outcomeId: 1, score: 6 }],
				}),
			).toThrow(DomainError);
		});

		it('throws when the RUC is malformed', () => {
			expect(() => PppValidation.validateCreateSurvey({ ...validDto, ruc: '123' })).toThrow(
				DomainError,
			);
		});
	});

	describe('validateExcelRow', () => {
		const excelRow = (overrides: Partial<PppExcelRow> = {}): PppExcelRow => ({
			studentCode: 'EST-1',
			practiceNumber: 1,
			totalHours: 200,
			companyName: 'ACME',
			bossName: 'Ana',
			startDate: null,
			endDate: null,
			...overrides,
		});

		it('returns valid for a well-formed row', () => {
			const result = PppValidation.validateExcelRow(excelRow());
			expect(result.valid).toBe(true);
			expect(result.errors).toEqual([]);
		});

		it('collects i18n keys, not rendered text, for a missing code and a bad practice number', () => {
			const result = PppValidation.validateExcelRow(
				excelRow({ studentCode: '', practiceNumber: 9 }),
			);
			expect(result.valid).toBe(false);
			expect(result.errors).toEqual([
				{ key: pppValidationStrings.error.upload.studentCodeRequired },
				{ key: pppValidationStrings.error.upload.invalidPracticeNumber },
			]);
		});
	});

	describe('validateExcelScore', () => {
		it('accepts a score inside 1..5', () => {
			expect(PppValidation.validateExcelScore('4.5', 'CE1')).toEqual({ score: 4.5, error: null });
		});

		it('treats a blank cell as unanswered rather than invalid', () => {
			expect(PppValidation.validateExcelScore('', 'CE1')).toEqual({ score: null, error: null });
		});

		it.each([
			['out of range above', '7'],
			['out of range below', '0'],
			['not a number at all', 'cuatro'],
			// parseFloat would read this as 4 and save it; the whole point of the check is
			// that a filled cell we cannot read becomes a reported error, never a silent 4.
			['a number with trailing text', '4abc'],
		])('rejects a filled cell that is %s', (_case, raw) => {
			const { score, error } = PppValidation.validateExcelScore(raw, 'CG2');

			expect(score).toBeNull();
			expect(error).toEqual({
				key: pppValidationStrings.error.upload.invalidScore,
				args: { label: 'CG2', value: raw },
			});
		});

		it('carries the column label so the message can point at the offending column', () => {
			expect(PppValidation.validateExcelScore('9', 'CE3').error?.args).toEqual({
				label: 'CE3',
				value: '9',
			});
		});
	});

	describe('classifyScore', () => {
		it('classifies below 2.5 as ROJO', () => {
			expect(PppValidation.classifyScore(2.4)).toBe('ROJO');
		});

		it('classifies [2.5, 3.2) as AMARILLO', () => {
			expect(PppValidation.classifyScore(2.5)).toBe('AMARILLO');
			expect(PppValidation.classifyScore(3.19)).toBe('AMARILLO');
		});

		it('classifies 3.2 and above as VERDE', () => {
			expect(PppValidation.classifyScore(3.2)).toBe('VERDE');
		});
	});
});
