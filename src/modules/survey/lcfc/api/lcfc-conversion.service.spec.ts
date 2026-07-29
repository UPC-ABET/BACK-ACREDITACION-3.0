import { LcfcConversionService } from './lcfc-conversion.service';
import type { LcfcNonConvertedScoreRow } from '../core/lcfc-notification.repository';

const EAC = 1;
const CAC = 2;
const ICT = 3;

const notifRepo = {
	getNonConvertedScoresBySurvey: jest.fn(),
	getClosedLcfcSurveyIdsForPeriod: jest.fn(),
	upsertConvertedScore: jest.fn(),
	runInTransaction: jest.fn(),
};

const conversionsRepository = {
	getActiveRulesBySources: jest.fn(),
};

const manager = {} as never;

/** One directly-answered outcome of a survey. */
const scoreRow = (
	surveyId: number,
	outcomeId: number,
	outcomeCode: string,
	score: number,
	programCommissionId = EAC,
): LcfcNonConvertedScoreRow => ({ surveyId, outcomeId, outcomeCode, programCommissionId, score });

const rule = (
	targetOutcomeId: number,
	targetOutcomeCode: string,
	formula: string,
	sourceProgramCommissionId = EAC,
	targetProgramCommissionId = CAC,
) => ({
	id: targetOutcomeId,
	sourceProgramCommissionId,
	targetProgramCommissionId,
	targetOutcomeId,
	targetOutcomeCode,
	formula,
});

describe('LcfcConversionService', () => {
	let service: LcfcConversionService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new LcfcConversionService(notifRepo as never, conversionsRepository as never);
	});

	it('derives a target outcome by averaging two source outcomes', async () => {
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 85, 'EAC-SI-6', 8),
			scoreRow(500, 86, 'EAC-SI-7', 6),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(104, 'CAC-SI-6', '([EAC-SI-6]+[EAC-SI-7])/2'),
		]);

		const result = await service.convertSurveys([500], manager);

		expect(result).toEqual({ surveysProcessed: 1, convertedRows: 1, skippedConversions: 0 });
		expect(notifRepo.upsertConvertedScore).toHaveBeenCalledWith(
			500,
			104,
			7,
			EAC,
			'([EAC-SI-6]+[EAC-SI-7])/2',
			manager,
		);
	});

	it('applies a straight passthrough conversion', async () => {
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 80, 'EAC-SI-1', 9)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(99, 'CAC-SI-1', '[EAC-SI-1]'),
		]);

		await service.convertSurveys([500], manager);

		expect(notifRepo.upsertConvertedScore).toHaveBeenCalledWith(
			500,
			99,
			9,
			EAC,
			'[EAC-SI-1]',
			manager,
		);
	});

	it('skips a conversion whose formula references a missing source outcome', async () => {
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 85, 'EAC-SI-6', 8)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(104, 'CAC-SI-6', '([EAC-SI-6]+[EAC-SI-7])/2'),
		]);

		const result = await service.convertSurveys([500], manager);

		expect(result).toEqual({ surveysProcessed: 1, convertedRows: 0, skippedConversions: 1 });
		expect(notifRepo.upsertConvertedScore).not.toHaveBeenCalled();
	});

	it('clamps a converted score to the top of the LCFC scale (10)', async () => {
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 80, 'EAC-SI-1', 9),
			scoreRow(500, 81, 'EAC-SI-2', 9),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(1, 'ICT-SI-A', '([EAC-SI-1]+[EAC-SI-2])*2', EAC, ICT),
		]);

		await service.convertSurveys([500], manager);

		expect(notifRepo.upsertConvertedScore).toHaveBeenCalledWith(
			500,
			1,
			10,
			EAC,
			expect.any(String),
			manager,
		);
	});

	it('clamps a converted score to the bottom of the LCFC scale (1)', async () => {
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 80, 'EAC-SI-1', 1)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(1, 'ICT-SI-A', '[EAC-SI-1]-5', EAC, ICT),
		]);

		await service.convertSurveys([500], manager);

		expect(notifRepo.upsertConvertedScore).toHaveBeenCalledWith(
			500,
			1,
			1,
			EAC,
			expect.any(String),
			manager,
		);
	});

	it('never overwrites a directly-answered score even when a rule targets that outcome', async () => {
		// Outcome 99 is both a directly-answered row AND the target of a conversion rule.
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 80, 'EAC-SI-1', 9),
			scoreRow(500, 99, 'CAC-SI-1', 4),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(99, 'CAC-SI-1', '[EAC-SI-1]'),
		]);

		const result = await service.convertSurveys([500], manager);

		expect(result.convertedRows).toBe(0);
		expect(notifRepo.upsertConvertedScore).not.toHaveBeenCalled();
	});

	it('produces the same result on a second run (idempotent inputs/outputs)', async () => {
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 80, 'EAC-SI-1', 9)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(99, 'CAC-SI-1', '[EAC-SI-1]'),
		]);

		const first = await service.convertSurveys([500], manager);
		const second = await service.convertSurveys([500], manager);

		expect(first).toEqual(second);
		expect(notifRepo.upsertConvertedScore).toHaveBeenNthCalledWith(
			1,
			500,
			99,
			9,
			EAC,
			'[EAC-SI-1]',
			manager,
		);
		expect(notifRepo.upsertConvertedScore).toHaveBeenNthCalledWith(
			2,
			500,
			99,
			9,
			EAC,
			'[EAC-SI-1]',
			manager,
		);
	});

	it('keeps the scope of a multi-commission survey grouped, never flattened', async () => {
		// Same outcome_code ("1") reused by two different commissions of the same survey — if the
		// scope were flattened, one would silently clobber the other.
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 80, '1', 9, EAC),
			scoreRow(500, 200, '1', 3, ICT),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(99, 'CAC-SI-1', '[1]', EAC, CAC),
			rule(150, 'DERIVED-ICT', '[1]', ICT, CAC),
		]);

		await service.convertSurveys([500], manager);

		expect(notifRepo.upsertConvertedScore).toHaveBeenCalledWith(500, 99, 9, EAC, '[1]', manager);
		expect(notifRepo.upsertConvertedScore).toHaveBeenCalledWith(500, 150, 3, ICT, '[1]', manager);
	});

	it('returns zero conversions when no rules are active for the source commission', async () => {
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 80, 'EAC-SI-1', 9)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([]);

		const result = await service.convertSurveys([500], manager);

		expect(result).toEqual({ surveysProcessed: 1, convertedRows: 0, skippedConversions: 0 });
	});

	it('skips a rule whose formula throws instead of aborting the batch', async () => {
		notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 80, 'EAC-SI-1', 9),
			scoreRow(500, 81, 'EAC-SI-2', 8),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(1, 'BAD', '[EAC-SI-1]/0', EAC, ICT),
			rule(2, 'GOOD', '[EAC-SI-2]', EAC, ICT),
		]);

		const result = await service.convertSurveys([500], manager);

		expect(result).toEqual({ surveysProcessed: 1, convertedRows: 1, skippedConversions: 1 });
		expect(notifRepo.upsertConvertedScore).toHaveBeenCalledWith(
			500,
			2,
			8,
			EAC,
			'[EAC-SI-2]',
			manager,
		);
	});

	it('returns immediately for an empty survey batch', async () => {
		const result = await service.convertSurveys([], manager);

		expect(result).toEqual({ surveysProcessed: 0, convertedRows: 0, skippedConversions: 0 });
		expect(notifRepo.getNonConvertedScoresBySurvey).not.toHaveBeenCalled();
	});

	describe('rebuildPeriod', () => {
		it('chunks surveys and aggregates results across chunks', async () => {
			const surveyIds = Array.from({ length: 250 }, (_, i) => i + 1);
			notifRepo.getClosedLcfcSurveyIdsForPeriod.mockResolvedValue(surveyIds);
			notifRepo.runInTransaction.mockImplementation((work: (m: unknown) => Promise<unknown>) =>
				work(manager),
			);
			notifRepo.getNonConvertedScoresBySurvey.mockResolvedValue([]);

			const result = await service.rebuildPeriod(1);

			// 250 surveys / 200-per-chunk => 2 chunks/transactions.
			expect(notifRepo.runInTransaction).toHaveBeenCalledTimes(2);
			expect(result.surveysProcessed).toBe(250);
		});
	});
});
