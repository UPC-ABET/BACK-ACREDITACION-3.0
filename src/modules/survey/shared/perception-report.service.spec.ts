// `generate()`/`generateOutcomeReport()` throttle PDF rendering via createConcurrencyLimiter,
// which wraps the ESM-only `p-limit` package. Mock the wrapper (not `p-limit` itself) since
// `await import('p-limit')` is a real dynamic import under this project's `module: nodenext` —
// Jest's CJS transform can't intercept it directly, but it can mock this whole module.
jest.mock('src/libs/reporting/concurrency-limit', () => ({
	createConcurrencyLimiter: async () => (fn: (...args: any[]) => any) => fn(),
}));

import { PerceptionReportService, type PerceptionReportRequest } from './perception-report.service';

const repo = {
	getSurveyTypeId: jest.fn(),
	getScoreRows: jest.fn(),
	getAcceptanceLevels: jest.fn(),
	getProgramName: jest.fn(),
	getPeriodCode: jest.fn(),
	getCommissionName: jest.fn(),
	getConfiguredOutcomes: jest.fn(),
	getCourseSectionLabel: jest.fn(),
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
	overrides: Partial<{
		outcomeId: number;
		outcomeCode: string;
		surveyNumber: number;
		courseId: number;
		courseName: string;
		courseCode: string;
	}> = {},
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
	courseId: null,
	courseName: null,
	courseCode: null,
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
		repo.getCourseSectionLabel.mockResolvedValue(null);
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

	it('never auto-splits by course for GRA/PPP (showCourseFilters unset), even though every survey row carries a courseId', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([
			scoreRow(1, 'Lima', '4.5', 3, { courseId: 101, courseName: 'Curso A', courseCode: 'C-A' }),
			scoreRow(2, 'Arequipa', '2', 1, { courseId: 102, courseName: 'Curso B', courseCode: 'C-B' }),
		]);

		// baseRequest has no `showCourseFilters` (GRA/PPP shape) — course data on the rows must be
		// ignored entirely, or this would incorrectly fan out per course × campus.
		const result = await service.generate(baseRequest);

		expect(result.reports).toHaveLength(3);
		expect(result.reports.some((r) => r.filename.includes('C-A'))).toBe(false);
		expect(result.reports.some((r) => r.filename.includes('C-B'))).toBe(false);
	});

	it('uses a raw 1-5 score histogram and skips outcome zero-seeding when scoped to a specific curso', async () => {
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getScoreRows.mockResolvedValue([
			scoreRow(1, 'Lima', '2', 5, { courseId: 55, courseName: 'Curso X', courseCode: 'X-1' }),
			scoreRow(1, 'Lima', '4', 3, { courseId: 55, courseName: 'Curso X', courseCode: 'X-1' }),
		]);
		// An outcome configured for the program/commission but unrelated to this course — must NOT
		// be zero-seeded into the table once a specific curso narrows the scope.
		repo.getConfiguredOutcomes.mockResolvedValue([
			{
				outcomeId: 99,
				outcomeCode: 'EAC-XX-9',
				outcomeName: 'Outcome no relacionado',
				commissionId: null,
				commissionName: null,
			},
		]);
		repo.getCourseSectionLabel.mockResolvedValue({
			courseName: 'Curso X',
			sectionCode: null,
			professorName: null,
		});

		await service.generate({
			...baseRequest,
			fileLabel: 'LCFC',
			showCourseFilters: true,
			courseId: 55,
		});

		const chartArgs = chart.buildGroupedBarChart.mock.calls[0][0];
		expect(chartArgs.categories).toEqual(['1', '2', '3', '4', '5']);

		const doc = documentOf(0);
		expect(doc.bodyHtml).not.toContain('<td class="num">9</td>');
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
		repo.getScoreRows.mockResolvedValue([scoreRow(1, 'Lima', '5', 3), scoreRow(1, 'Lima', '3', 1)]);

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
