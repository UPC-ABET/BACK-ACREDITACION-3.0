import { RvGradeProcessingService } from './rv-grade-processing.service';
import type { RvSourceGradeRow } from '../core/processed-rv-grades.repository';

const EAC = 1;
const CAC = 2;
const PERIOD = 10;

/** Bands the legacy `NivelAceptacionReporte` used for RV: red / yellow / green on the 20-point scale. */
const LEVELS = [
	{ id: 100, minScore: 0, maxScore: 12.99, levelRank: 1 },
	{ id: 101, minScore: 13, maxScore: 16, levelRank: 2 },
	{ id: 102, minScore: 16.001, maxScore: 20, levelRank: 3 },
];

const processedRepository = {
	getSourceGrades: jest.fn(),
	getRvPerformanceLevels: jest.fn(),
	getEvaluationIdsForPeriod: jest.fn(),
	replaceForEvaluations: jest.fn(),
	runInTransaction: jest.fn(),
};

const conversionsRepository = {
	getActiveRulesBySources: jest.fn(),
};

/** One graded outcome of evaluation 500: raw score `grade` out of `maxOutcome`. */
const sourceGrade = (
	outcomeId: number,
	outcomeCode: string,
	grade: number,
	maxOutcome: number | null = 20,
): RvSourceGradeRow => ({
	evaluationId: 500,
	studentSectionEnrollmentId: 900,
	outcomeId,
	outcomeCode,
	programCommissionId: EAC,
	grade,
	maxOutcome,
	courseSectionId: 70,
	academicPeriodId: PERIOD,
});

const rule = (targetOutcomeId: number, targetOutcomeCode: string, formula: string) => ({
	id: targetOutcomeId,
	sourceProgramCommissionId: EAC,
	targetProgramCommissionId: CAC,
	targetOutcomeId,
	targetOutcomeCode,
	formula,
});

const writtenRows = () => processedRepository.replaceForEvaluations.mock.calls[0][1];

describe('RvGradeProcessingService', () => {
	let service: RvGradeProcessingService;

	beforeEach(() => {
		jest.clearAllMocks();
		processedRepository.getRvPerformanceLevels.mockResolvedValue(LEVELS);
		processedRepository.replaceForEvaluations.mockResolvedValue(undefined);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([]);
		service = new RvGradeProcessingService(
			processedRepository as any,
			conversionsRepository as any,
		);
	});

	it('scales a raw outcome grade onto the 20-point scale and classifies it', async () => {
		processedRepository.getSourceGrades.mockResolvedValue([sourceGrade(11, '6', 9, 12)]);

		const result = await service.processEvaluations([500]);

		const [row] = writtenRows();
		expect(row.grade).toBe(9);
		expect(row.scaledGrade).toBe(15);
		expect(row.levelRank).toBe(2);
		expect(row.performanceLevelId).toBe(101);
		expect(row.isConverted).toBe(false);
		expect(result.gradedRows).toBe(1);
	});

	it('falls back to the raw grade when max_outcome is missing', async () => {
		processedRepository.getSourceGrades.mockResolvedValue([sourceGrade(11, '6', 18, null)]);

		await service.processEvaluations([500]);

		expect(writtenRows()[0].scaledGrade).toBe(18);
	});

	it('derives a target-commission outcome by averaging two source outcomes', async () => {
		processedRepository.getSourceGrades.mockResolvedValue([
			sourceGrade(11, '6', 20, 20),
			sourceGrade(12, '7', 10, 20),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(60, 'B', '([6] + [7]) / 2'),
		]);

		const result = await service.processEvaluations([500]);

		const converted = writtenRows().find((row: any) => row.isConverted);
		expect(converted.outcomeId).toBe(60);
		expect(converted.programCommissionId).toBe(CAC);
		expect(converted.sourceProgramCommissionId).toBe(EAC);
		expect(converted.scaledGrade).toBe(15);
		expect(converted.levelRank).toBe(2);
		expect(converted.formula).toBe('([6] + [7]) / 2');
		expect(result.convertedRows).toBe(1);
	});

	it('applies a weighted conversion formula', async () => {
		processedRepository.getSourceGrades.mockResolvedValue([
			sourceGrade(11, 'A', 20, 20),
			sourceGrade(12, 'I', 10, 20),
			sourceGrade(13, 'K', 8, 20),
		]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(60, 'J', '(0.5 * [A]) + (0.25 * [I]) + (0.25 * [K])'),
		]);

		await service.processEvaluations([500]);

		expect(writtenRows().find((row: any) => row.isConverted).scaledGrade).toBe(14.5);
	});

	it('skips a conversion whose formula references an outcome the evaluation did not grade', async () => {
		processedRepository.getSourceGrades.mockResolvedValue([sourceGrade(11, '6', 20, 20)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([
			rule(60, 'B', '([6] + [7]) / 2'),
		]);

		const result = await service.processEvaluations([500]);

		expect(writtenRows().every((row: any) => !row.isConverted)).toBe(true);
		expect(result.convertedRows).toBe(0);
		expect(result.skippedConversions).toBe(1);
	});

	it('clamps a converted grade to the top of the 20-point scale', async () => {
		processedRepository.getSourceGrades.mockResolvedValue([sourceGrade(11, 'A', 20, 20)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([rule(60, 'J', '[A] * 2')]);

		await service.processEvaluations([500]);

		expect(writtenRows().find((row: any) => row.isConverted).scaledGrade).toBe(20);
	});

	it('never overwrites a directly graded outcome with a converted one', async () => {
		processedRepository.getSourceGrades.mockResolvedValue([sourceGrade(11, 'A', 20, 20)]);
		conversionsRepository.getActiveRulesBySources.mockResolvedValue([rule(11, 'A', '[A] / 2')]);

		await service.processEvaluations([500]);

		const rows = writtenRows();
		expect(rows).toHaveLength(1);
		expect(rows[0].isConverted).toBe(false);
		expect(rows[0].scaledGrade).toBe(20);
	});

	it('clears processed rows when the evaluation no longer has outcome grades', async () => {
		processedRepository.getSourceGrades.mockResolvedValue([]);

		const result = await service.processEvaluations([500]);

		expect(processedRepository.replaceForEvaluations).toHaveBeenCalledWith([500], [], undefined);
		expect(result.gradedRows).toBe(0);
	});

	it('does nothing when given no evaluations', async () => {
		const result = await service.processEvaluations([]);

		expect(processedRepository.replaceForEvaluations).not.toHaveBeenCalled();
		expect(result.evaluationsProcessed).toBe(0);
	});
});
