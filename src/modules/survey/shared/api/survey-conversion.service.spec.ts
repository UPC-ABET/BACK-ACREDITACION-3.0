import { SurveyConversionService } from './survey-conversion.service';
import type { SurveyNonConvertedScoreRow } from '../core/survey-conversion.repository';

const EAC = 1;
const CAC = 2;
const ICT = 3;

const LCFC_SCALE = { min: 1, max: 10 };
const PPP_SCALE = { min: 1, max: 5 };

const repo = {
	getNonConvertedScoresBySurvey: jest.fn(),
	getSurveyIdsForConversion: jest.fn(),
	upsertConvertedScore: jest.fn(),
	runInTransaction: jest.fn(),
};

const conversionsRepository = {
	getActiveRulesBySources: jest.fn(),
};

const manager = {} as never;

const scoreRow = (
	surveyId: number,
	outcomeId: number,
	outcomeCode: string,
	score: number,
	programCommissionId = EAC,
): SurveyNonConvertedScoreRow => ({ surveyId, outcomeId, outcomeCode, programCommissionId, score });

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

describe('SurveyConversionService', () => {
	let service: SurveyConversionService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new SurveyConversionService(repo as never, conversionsRepository as never);
	});

	it('derives a target outcome by averaging two source outcomes', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 85, 'EAC-SI-6', 4),
			scoreRow(500, 86, 'EAC-SI-7', 2),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(104, 'CAC-SI-6', '([EAC-SI-6]+[EAC-SI-7])/2'),
		]);

		const result = await service.convertSurveys([500], PPP_SCALE, manager);

		expect(result).toEqual({ surveysProcessed: 1, convertedRows: 1, skippedConversions: 0 });
		expect(repo.upsertConvertedScore).toHaveBeenCalledWith(
			500,
			104,
			3,
			EAC,
			'([EAC-SI-6]+[EAC-SI-7])/2',
			manager,
		);
	});

	it('applies a straight passthrough conversion', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 80, 'EAC-SI-1', 9)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(99, 'CAC-SI-1', '[EAC-SI-1]'),
		]);

		await service.convertSurveys([500], LCFC_SCALE, manager);

		expect(repo.upsertConvertedScore).toHaveBeenCalledWith(500, 99, 9, EAC, '[EAC-SI-1]', manager);
	});

	it('skips a conversion whose formula references a missing source outcome', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 85, 'EAC-SI-6', 8)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(104, 'CAC-SI-6', '([EAC-SI-6]+[EAC-SI-7])/2'),
		]);

		const result = await service.convertSurveys([500], LCFC_SCALE, manager);

		expect(result).toEqual({ surveysProcessed: 1, convertedRows: 0, skippedConversions: 1 });
		expect(repo.upsertConvertedScore).not.toHaveBeenCalled();
	});

	it('clamps a converted score to the top of the PPP scale (5), not the LCFC scale', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 80, 'EAC-SI-1', 5),
			scoreRow(500, 81, 'EAC-SI-2', 5),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(1, 'ICT-SI-A', '([EAC-SI-1]+[EAC-SI-2])*2', EAC, ICT),
		]);

		await service.convertSurveys([500], PPP_SCALE, manager);

		expect(repo.upsertConvertedScore).toHaveBeenCalledWith(
			500,
			1,
			5,
			EAC,
			expect.any(String),
			manager,
		);
	});

	it('clamps a converted score to the bottom of the scale (1)', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 80, 'EAC-SI-1', 1)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(1, 'ICT-SI-A', '[EAC-SI-1]-5', EAC, ICT),
		]);

		await service.convertSurveys([500], PPP_SCALE, manager);

		expect(repo.upsertConvertedScore).toHaveBeenCalledWith(
			500,
			1,
			1,
			EAC,
			expect.any(String),
			manager,
		);
	});

	it('never overwrites a directly-answered score even when a rule targets that outcome', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 80, 'EAC-SI-1', 4),
			scoreRow(500, 99, 'CAC-SI-1', 2),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(99, 'CAC-SI-1', '[EAC-SI-1]'),
		]);

		const result = await service.convertSurveys([500], PPP_SCALE, manager);

		expect(result.convertedRows).toBe(0);
		expect(repo.upsertConvertedScore).not.toHaveBeenCalled();
	});

	it('keeps the scope of a multi-commission survey grouped, never flattened', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 80, '1', 4, EAC),
			scoreRow(500, 200, '1', 2, ICT),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(99, 'CAC-SI-1', '[1]', EAC, CAC),
			rule(150, 'DERIVED-ICT', '[1]', ICT, CAC),
		]);

		await service.convertSurveys([500], PPP_SCALE, manager);

		expect(repo.upsertConvertedScore).toHaveBeenCalledWith(500, 99, 4, EAC, '[1]', manager);
		expect(repo.upsertConvertedScore).toHaveBeenCalledWith(500, 150, 2, ICT, '[1]', manager);
	});

	it('returns zero conversions when no rules are active for the source commission', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([scoreRow(500, 80, 'EAC-SI-1', 4)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([]);

		const result = await service.convertSurveys([500], PPP_SCALE, manager);

		expect(result).toEqual({ surveysProcessed: 1, convertedRows: 0, skippedConversions: 0 });
	});

	it('skips a rule whose formula throws instead of aborting the batch', async () => {
		repo.getNonConvertedScoresBySurvey.mockResolvedValue([
			scoreRow(500, 80, 'EAC-SI-1', 4),
			scoreRow(500, 81, 'EAC-SI-2', 3),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(1, 'BAD', '[EAC-SI-1]/0', EAC, ICT),
			rule(2, 'GOOD', '[EAC-SI-2]', EAC, ICT),
		]);

		const result = await service.convertSurveys([500], PPP_SCALE, manager);

		expect(result).toEqual({ surveysProcessed: 1, convertedRows: 1, skippedConversions: 1 });
		expect(repo.upsertConvertedScore).toHaveBeenCalledWith(500, 2, 3, EAC, '[EAC-SI-2]', manager);
	});

	it('returns immediately for an empty survey batch', async () => {
		const result = await service.convertSurveys([], PPP_SCALE, manager);

		expect(result).toEqual({ surveysProcessed: 0, convertedRows: 0, skippedConversions: 0 });
		expect(repo.getNonConvertedScoresBySurvey).not.toHaveBeenCalled();
	});

	describe('rebuildForSurveyType', () => {
		it('chunks surveys and aggregates results across chunks', async () => {
			const surveyIds = Array.from({ length: 250 }, (_, i) => i + 1);
			repo.getSurveyIdsForConversion.mockResolvedValue(surveyIds);
			repo.runInTransaction.mockImplementation((work: (m: unknown) => Promise<unknown>) =>
				work(manager),
			);
			repo.getNonConvertedScoresBySurvey.mockResolvedValue([]);

			const result = await service.rebuildForSurveyType('TG601-T002', 1, PPP_SCALE);

			expect(repo.runInTransaction).toHaveBeenCalledTimes(2);
			expect(result.surveysProcessed).toBe(250);
			expect(repo.getSurveyIdsForConversion).toHaveBeenCalledWith('TG601-T002', 1);
		});
	});
});
