import { PerceptionReportService, type PerceptionReportRequest } from './perception-report.service';

const repo = {
	getSurveyTypeId: jest.fn(),
	getScoreRows: jest.fn(),
	getAcceptanceLevels: jest.fn(),
	getProgramName: jest.fn(),
	getPeriodCode: jest.fn(),
	getCommissionName: jest.fn(),
	getConfiguredOutcomes: jest.fn(),
};
const chart = { buildGroupedBarChart: jest.fn().mockReturnValue('<svg></svg>') };
const generator = { generateDocument: jest.fn(), archivePdfFiles: jest.fn() };

const service = new PerceptionReportService(repo as any, chart as any, generator as any);

const baseRequest: PerceptionReportRequest = {
	surveyTypeCode: 'TG601-T001',
	fileLabel: 'GRA',
	reportName: { es: 'Informe', en: 'Report' },
	academicPeriodId: 1,
	lang: 'es',
};

const scoreRow = (campusId: number, campusName: string, score: string, count: number) => ({
	outcomeId: 1,
	outcomeCode: 'O1',
	outcomeName: 'Outcome 1',
	campusId,
	campusName,
	score,
	count,
});

describe('PerceptionReportService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		generator.generateDocument.mockResolvedValue({ pdf: Buffer.from('pdf') });
		generator.archivePdfFiles.mockResolvedValue({
			filename: 'reports.zip',
			zip: Buffer.from('zip'),
		});
		repo.getAcceptanceLevels.mockResolvedValue([
			{
				name: { es: 'Necesita mejora', en: 'Needs improvement' },
				uniqueValue: '1',
				minScore: '0',
				maxScore: '3.25',
			},
			{
				name: { es: 'Esperado', en: 'Expected' },
				uniqueValue: '2',
				minScore: '3.25',
				maxScore: '4.25',
			},
			{
				name: { es: 'Sobresaliente', en: 'Outstanding' },
				uniqueValue: '3',
				minScore: '4.25',
				maxScore: '5',
			},
		]);
		repo.getPeriodCode.mockResolvedValue('20251');
		repo.getProgramName.mockResolvedValue(null);
		repo.getCommissionName.mockResolvedValue(null);
		repo.getConfiguredOutcomes.mockResolvedValue([]);
	});

	it('returns an empty result when the survey type code is unknown', async () => {
		repo.getSurveyTypeId.mockResolvedValue(null);
		await expect(service.generate(baseRequest)).resolves.toEqual({ reports: [], zip: null });
		expect(repo.getScoreRows).not.toHaveBeenCalled();
	});

	it('returns an empty result when there are no score rows', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([]);
		await expect(service.generate(baseRequest)).resolves.toEqual({ reports: [], zip: null });
		expect(generator.generateDocument).not.toHaveBeenCalled();
	});

	it('rejects when no acceptance levels are configured for the survey type/period', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([scoreRow(1, 'Lima', '4.5', 3)]);
		repo.getAcceptanceLevels.mockResolvedValue([]);

		await expect(service.generate(baseRequest)).rejects.toThrow(
			'error.survey.perceptionReport.acceptanceLevelsMissing',
		);
		expect(generator.generateDocument).not.toHaveBeenCalled();
	});

	it('builds an all-sedes report plus one per sede and a zip for multiple campuses', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([
			scoreRow(1, 'Lima', '4.5', 3),
			scoreRow(2, 'Arequipa', '2', 1),
		]);

		const result = await service.generate(baseRequest);

		expect(result.reports).toHaveLength(3);
		expect(result.reports[0].campusId).toBeNull();
		expect(result.zip).not.toBeNull();
		expect(generator.archivePdfFiles).toHaveBeenCalledTimes(1);
	});

	it('builds a single report and no zip when filtered to one campus', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([scoreRow(1, 'Lima', '4.5', 3)]);

		const result = await service.generate({ ...baseRequest, campusId: 1 });

		expect(result.reports).toHaveLength(1);
		expect(result.reports[0].campusId).toBe(1);
		expect(result.zip).toBeNull();
		expect(generator.archivePdfFiles).not.toHaveBeenCalled();
	});

	it('localizes acceptance band names to the requested language', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([scoreRow(1, 'Lima', '4.5', 3)]);
		repo.getAcceptanceLevels.mockResolvedValue([
			{ name: { es: 'Esperado', en: 'Expected' }, uniqueValue: '1', minScore: '0', maxScore: '5' },
		]);

		await service.generate({ ...baseRequest, campusId: 1, lang: 'en' });

		const series = chart.buildGroupedBarChart.mock.calls[0][0].series;
		expect(series[0].label).toBe('Expected');
	});

	it('includes configured outcomes with zero responses instead of omitting them', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([scoreRow(1, 'Lima', '4.5', 3)]);
		repo.getConfiguredOutcomes.mockResolvedValue([
			{
				outcomeId: 1,
				outcomeCode: 'O1',
				outcomeName: 'Outcome 1',
				commissionId: 1,
				commissionName: 'EAC',
			},
			{
				outcomeId: 2,
				outcomeCode: 'O2',
				outcomeName: 'Outcome 2',
				commissionId: 2,
				commissionName: 'CAC',
			},
		]);

		await service.generate({ ...baseRequest, campusId: 1 });

		const categories = chart.buildGroupedBarChart.mock.calls[0][0].categories;
		expect(categories).toEqual(['O1', 'O2']);
	});
});
