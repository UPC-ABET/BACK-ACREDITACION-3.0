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
	totalLabel: { es: 'Total de graduandos', en: 'Total graduating students' },
	academicPeriodId: 1,
	lang: 'es',
};

const scoreRow = (
	campusId: number,
	campusName: string,
	score: string,
	count: number,
	overrides: Partial<{ outcomeId: number; outcomeCode: string; surveyNumber: number }> = {},
) => ({
	outcomeId: 1,
	outcomeCode: 'EAC-BIO-1',
	outcomeName: 'Outcome 1',
	campusId,
	campusName,
	commissionId: null,
	commissionName: null,
	surveyNumber: null,
	score,
	count,
	...overrides,
});

const documentOf = (callIndex: number) =>
	generator.generateDocument.mock.calls[callIndex][0] as { bodyHtml: string; metadata: unknown[] };

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
				outcomeCode: 'EAC-BIO-1',
				outcomeName: 'Outcome 1',
				commissionId: 1,
				commissionName: 'EAC',
			},
			{
				outcomeId: 2,
				outcomeCode: 'EAC-BIO-2',
				outcomeName: 'Outcome 2',
				commissionId: 2,
				commissionName: 'CAC',
			},
		]);

		await service.generate({ ...baseRequest, campusId: 1 });

		const categories = chart.buildGroupedBarChart.mock.calls[0][0].categories;
		expect(categories).toEqual(['1', '2']);
	});

	it('labels the results table with the band names, the average and the caller total label', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([
			scoreRow(1, 'Lima', '5', 3),
			scoreRow(1, 'Lima', '3', 1),
		]);

		await service.generate({ ...baseRequest, campusId: 1 });

		const { bodyHtml } = documentOf(0);
		expect(bodyHtml).toContain('Necesita mejora');
		expect(bodyHtml).toContain('Sobresaliente');
		expect(bodyHtml).toContain('Promedio');
		expect(bodyHtml).toContain('Total de graduandos');
		expect(bodyHtml).not.toContain('1 Punto');
		expect(bodyHtml).not.toContain('Modalidad de Estudio</th>');
		// (5 x 3 + 3 x 1) / 4
		expect(bodyHtml).toContain('4.50');
	});

	it('splits into one report per survey number when the survey type asks for it', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([
			scoreRow(1, 'Lima', '5', 3, { surveyNumber: 1 }),
			scoreRow(1, 'Lima', '2', 1, { surveyNumber: 2 }),
		]);

		const result = await service.generate({
			...baseRequest,
			fileLabel: 'PPP',
			campusId: 1,
			surveyNumberSplit: {
				label: { es: 'Práctica', en: 'Internship' },
				valueLabels: {
					1: { es: 'Primera Práctica Preprofesional', en: 'First' },
					2: { es: 'Segunda Práctica Preprofesional', en: 'Second' },
				},
			},
		});

		expect(result.reports).toHaveLength(2);
		expect(result.reports[0].filename).toContain('Primera_Practica_Preprofesional');
		expect(result.reports[1].filename).toContain('Segunda_Practica_Preprofesional');
		expect(documentOf(0).metadata).toContainEqual({
			label: 'Práctica',
			value: 'Primera Práctica Preprofesional',
		});
	});

	it('keeps a single report when the split is requested but no survey number is recorded', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([scoreRow(1, 'Lima', '4.5', 3)]);

		const result = await service.generate({
			...baseRequest,
			campusId: 1,
			surveyNumberSplit: { label: { es: 'Práctica', en: 'Internship' }, valueLabels: {} },
		});

		expect(result.reports).toHaveLength(1);
		expect(documentOf(0).metadata).toHaveLength(4);
	});
});
