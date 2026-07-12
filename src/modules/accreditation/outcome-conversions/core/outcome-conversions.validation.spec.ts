import { DomainError } from 'src/commons/domain-error';
import { OutcomeConversionValidation } from './outcome-conversions.validation';

const conversionRepo = { findOneByCondition: jest.fn() };
const programCommissionRepo = { findOneById: jest.fn() };
const outcomeRepo = { findOneById: jest.fn(), findByCondition: jest.fn() };

const EAC = { id: 1, programId: 7, academicPeriodId: 3 };
const CAC = { id: 2, programId: 7, academicPeriodId: 3 };

const validInput = {
	sourceProgramCommissionId: EAC.id,
	targetProgramCommissionId: CAC.id,
	targetOutcomeId: 50,
	formula: '([6] + [7]) / 2',
};

const run = (input = validInput, currentId?: number) =>
	OutcomeConversionValidation.validateUpsert(
		conversionRepo as any,
		programCommissionRepo as any,
		outcomeRepo as any,
		input,
		currentId,
	);

describe('OutcomeConversionValidation.validateUpsert', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		programCommissionRepo.findOneById.mockImplementation(async (id: number) =>
			id === EAC.id ? EAC : id === CAC.id ? CAC : null,
		);
		outcomeRepo.findOneById.mockResolvedValue({ id: 50, programCommissionId: CAC.id });
		outcomeRepo.findByCondition.mockResolvedValue([
			{ outcomeCode: '6' },
			{ outcomeCode: '7' },
			{ outcomeCode: 'A' },
		]);
		conversionRepo.findOneByCondition.mockResolvedValue(null);
	});

	it('passes for a well-formed conversion', async () => {
		await expect(run()).resolves.toBeUndefined();
	});

	it('rejects a conversion whose source and target are the same commission', async () => {
		await expect(run({ ...validInput, targetProgramCommissionId: EAC.id })).rejects.toThrow(
			DomainError,
		);
	});

	it('rejects when the commissions belong to different academic periods', async () => {
		programCommissionRepo.findOneById.mockImplementation(async (id: number) =>
			id === EAC.id ? EAC : { ...CAC, academicPeriodId: 99 },
		);
		await expect(run()).rejects.toThrow(DomainError);
	});

	it('rejects when the commissions belong to different programs', async () => {
		programCommissionRepo.findOneById.mockImplementation(async (id: number) =>
			id === EAC.id ? EAC : { ...CAC, programId: 99 },
		);
		await expect(run()).rejects.toThrow(DomainError);
	});

	it('rejects when the target outcome belongs to another commission', async () => {
		outcomeRepo.findOneById.mockResolvedValue({ id: 50, programCommissionId: 999 });
		await expect(run()).rejects.toThrow(DomainError);
	});

	it('rejects an unparseable formula', async () => {
		await expect(run({ ...validInput, formula: '([6] + ' })).rejects.toThrow(DomainError);
	});

	it('rejects a formula referencing an outcome the source commission does not have', async () => {
		await expect(run({ ...validInput, formula: '([6] + [Z]) / 2' })).rejects.toThrow(DomainError);
	});

	it('rejects a second conversion for the same source and target outcome', async () => {
		conversionRepo.findOneByCondition.mockResolvedValue({ id: 77 });
		await expect(run()).rejects.toThrow(DomainError);
	});

	it('allows updating the conversion that already owns the source/target pair', async () => {
		conversionRepo.findOneByCondition.mockResolvedValue({ id: 77 });
		await expect(run(validInput, 77)).resolves.toBeUndefined();
	});

	it('throws when the source program commission does not exist', async () => {
		programCommissionRepo.findOneById.mockImplementation(async (id: number) =>
			id === CAC.id ? CAC : null,
		);
		await expect(run()).rejects.toThrow(DomainError);
	});
});
