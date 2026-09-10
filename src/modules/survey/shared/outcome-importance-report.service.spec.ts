// Same reason as perception-report.service.spec.ts: createConcurrencyLimiter wraps the ESM-only
// `p-limit` behind a real dynamic import, so the wrapper module is what gets mocked.
jest.mock('src/libs/reporting/concurrency-limit', () => ({
	createConcurrencyLimiter: async () => (fn: (...args: any[]) => any) => fn(),
}));

import {
	OutcomeImportanceReportService,
	type OutcomeImportanceReportRequest,
} from './outcome-importance-report.service';

const repo = {
	getSurveyTypeId: jest.fn(),
	getScoreRows: jest.fn(),
	getAcceptanceLevels: jest.fn(),
	getProgramName: jest.fn(),
	getCommissionName: jest.fn(),
	getPeriodCode: jest.fn(),
	getConfiguredOutcomes: jest.fn(),
};
const chart = { buildGroupedBarChart: jest.fn().mockReturnValue('<svg></svg>') };
const generator = { generateDocument: jest.fn(), archivePdfFiles: jest.fn() };

const service = new OutcomeImportanceReportService(repo as any, chart as any, generator as any);

const baseRequest: OutcomeImportanceReportRequest = {
	surveyTypeCode: 'TG601-T001',
	fileLabel: 'GRA',
	reportName: { es: 'Informe de Importancia por Outcome', en: 'Outcome Importance Report' },
	academicPeriodId: 1,
	programId: 7,
	commissionId: 3,
	lang: 'es',
};

const scoreRow = (
	score: string,
	count: number,
	overrides: Partial<{
		outcomeId: number;
		outcomeCode: string;
		campusId: number;
		campusName: string;
	}> = {},
) => ({
	outcomeId: 1,
	outcomeCode: 'EAC-SI-1',
	outcomeName: { es: 'Outcome 1', en: 'Outcome 1' },
	campusId: 1,
	campusName: { es: 'Lima', en: 'Lima' },
	commissionId: 3,
	commissionName: { es: 'COMPUTACIÓN', en: 'COMPUTING' },
	surveyNumber: null,
	score,
	count,
	courseId: null,
	courseName: null,
	courseCode: null,
	...overrides,
});

const configuredOutcome = (outcomeId: number, outcomeCode: string) => ({
	outcomeId,
	outcomeCode,
	outcomeName: { es: `Outcome ${outcomeId}`, en: `Outcome ${outcomeId}` },
	commissionId: 3,
	commissionName: { es: 'COMPUTACIÓN', en: 'COMPUTING' },
});

/** Deficiente [0-3.25>, Esperado [3.25-4.25>, Óptimo <4.25-5] — the shape GRA configures. */
const bands = [
	{ name: { es: 'Deficiente', en: 'Poor' }, uniqueValue: '1', minScore: '0', maxScore: '3.25' },
	{
		name: { es: 'Esperado', en: 'Expected' },
		uniqueValue: '2',
		minScore: '3.25',
		maxScore: '4.25',
	},
	{ name: { es: 'Óptimo', en: 'Optimal' }, uniqueValue: '3', minScore: '4.25', maxScore: '5' },
];

/** The TOTALES row's cells. It carries a class, so tableRows above (bare `<tr>`) skips it. */
function totalsRow(html: string): string[] {
	const row = /<tr class="totals-row">([\s\S]*?)<\/tr>/.exec(html);
	if (!row) return [];
	return [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1].trim());
}

/** The results table's per-outcome rows, stripped of tags. */
function tableRows(html: string): string[][] {
	const table = /<tbody>([\s\S]*?)<\/tbody>/.exec(html);
	if (!table) return [];
	return [...table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
		[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1].trim()),
	);
}

function generatedHtml(callIndex = 0): string {
	return generator.generateDocument.mock.calls[callIndex][0].bodyHtml;
}

describe('OutcomeImportanceReportService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		repo.getSurveyTypeId.mockResolvedValue(10);
		repo.getAcceptanceLevels.mockResolvedValue(bands);
		repo.getProgramName.mockResolvedValue({ es: 'Ingeniería de Sistemas', en: 'IS' });
		repo.getCommissionName.mockResolvedValue({ es: 'COMPUTACIÓN', en: 'COMPUTING' });
		repo.getPeriodCode.mockResolvedValue('202520');
		repo.getConfiguredOutcomes.mockResolvedValue([configuredOutcome(1, 'EAC-SI-1')]);
		repo.getScoreRows.mockResolvedValue([]);
		generator.generateDocument.mockResolvedValue({ pdf: Buffer.from('pdf') });
		generator.archivePdfFiles.mockResolvedValue({
			filename: 'reportes.zip',
			zip: Buffer.from('zip'),
		});
	});

	it('reports min, max, mode, mean and headcount per outcome', async () => {
		// 2 students at 3, 3 at 5 → min 3, max 5, mode 5, mean (6+15)/5 = 4.20, 5 students.
		// The outcome column carries the same number the chart's axis does, not the full name.
		repo.getScoreRows.mockResolvedValue([scoreRow('3', 2), scoreRow('5', 3)]);

		await service.generate(baseRequest);

		expect(tableRows(generatedHtml())).toEqual([['1', '3.00', '5.00', '5.00', '4.20', '5']]);
	});

	it('closes the table with a TOTALES row over every outcome at once', async () => {
		repo.getConfiguredOutcomes.mockResolvedValue([
			configuredOutcome(1, 'EAC-SI-1'),
			configuredOutcome(2, 'EAC-SI-2'),
		]);
		// Outcome 1: 8 responses at 5. Outcome 2: 2 at 1. Pooled: min 1, max 5, mode 5 (8 beats
		// 2), mean (40 + 2)/10 = 4.20 -- weighted, not the 3.00 the two row means would give.
		repo.getScoreRows.mockResolvedValue([
			scoreRow('5', 8),
			scoreRow('1', 2, { outcomeId: 2, outcomeCode: 'EAC-SI-2' }),
		]);

		await service.generate(baseRequest);

		expect(totalsRow(generatedHtml())).toEqual(['TOTALES', '1.00', '5.00', '5.00', '4.20', '10']);
	});

	it('breaks a tied mode towards the lower score', async () => {
		repo.getScoreRows.mockResolvedValue([scoreRow('2', 3), scoreRow('5', 3)]);

		await service.generate(baseRequest);

		expect(tableRows(generatedHtml())[0][3]).toBe('2.00');
	});

	it('sums a score across sedes before taking the mode', async () => {
		// 5 wins on headcount (2+2) even though 3 leads at any single sede (3).
		repo.getScoreRows.mockResolvedValue([
			scoreRow('3', 3, { campusId: 1 }),
			scoreRow('5', 2, { campusId: 1 }),
			scoreRow('5', 2, { campusId: 2, campusName: { es: 'Villa', en: 'Villa' } as any }),
		]);

		await service.generate(baseRequest);

		expect(tableRows(generatedHtml(0))[0][3]).toBe('5.00');
	});

	it('keeps a configured outcome with no responses instead of dropping it', async () => {
		repo.getConfiguredOutcomes.mockResolvedValue([
			configuredOutcome(1, 'EAC-SI-1'),
			configuredOutcome(2, 'EAC-SI-2'),
		]);
		repo.getScoreRows.mockResolvedValue([scoreRow('4', 1)]);

		await service.generate(baseRequest);

		expect(tableRows(generatedHtml())[1]).toEqual(['2', '—', '—', '—', '—', '0']);
	});

	it('colours each bar with the band its mean falls into', async () => {
		repo.getConfiguredOutcomes.mockResolvedValue([
			configuredOutcome(1, 'EAC-SI-1'),
			configuredOutcome(2, 'EAC-SI-2'),
		]);
		repo.getScoreRows.mockResolvedValue([
			scoreRow('2', 1), // mean 2.00 → Deficiente
			scoreRow('5', 1, { outcomeId: 2, outcomeCode: 'EAC-SI-2' }), // mean 5.00 → Óptimo
		]);

		await service.generate(baseRequest);

		// One series per band; only the matching band carries the outcome's mean.
		const series = chart.buildGroupedBarChart.mock.calls[0][0].series;
		expect(series.map((s: { values: number[] }) => s.values)).toEqual([
			[2, 0],
			[0, 0],
			[0, 5],
		]);
		expect(series[0].label).toBe('Deficiente ([ 0 - 3.25 >)');
	});

	it('puts a mean sitting exactly on a boundary in the lower band', async () => {
		// Mean 3.25 is Deficiente's ceiling, so it belongs to Deficiente, not Esperado.
		repo.getScoreRows.mockResolvedValue([scoreRow('3.25', 4)]);

		await service.generate(baseRequest);

		const series = chart.buildGroupedBarChart.mock.calls[0][0].series;
		expect(series[0].values).toEqual([3.25]);
		expect(series[1].values).toEqual([0]);
	});

	it('renders one PDF per sede plus a combined one, zipped together', async () => {
		repo.getScoreRows.mockResolvedValue([
			scoreRow('5', 1, { campusId: 1, campusName: { es: 'Lima', en: 'Lima' } as any }),
			scoreRow('3', 1, { campusId: 2, campusName: { es: 'Villa', en: 'Villa' } as any }),
		]);

		const result = await service.generate(baseRequest);

		expect(result.reports.map((report) => report.campusName)).toEqual(['TODAS', 'Lima', 'Villa']);
		expect(result.zip).not.toBeNull();
		// The combined section averages both sedes; each sede section only its own row.
		expect(tableRows(generatedHtml(0))[0][4]).toBe('4.00');
		expect(tableRows(generatedHtml(1))[0][4]).toBe('5.00');
		expect(tableRows(generatedHtml(2))[0][4]).toBe('3.00');
	});

	it('narrows the seeded outcomes to the one requested', async () => {
		repo.getConfiguredOutcomes.mockResolvedValue([
			configuredOutcome(1, 'EAC-SI-1'),
			configuredOutcome(2, 'EAC-SI-2'),
		]);
		repo.getScoreRows.mockResolvedValue([
			scoreRow('4', 1, { outcomeId: 2, outcomeCode: 'EAC-SI-2' }),
		]);

		await service.generate({ ...baseRequest, outcomeId: 2 });

		expect(repo.getScoreRows).toHaveBeenCalledWith(expect.objectContaining({ outcomeId: 2 }));
		expect(tableRows(generatedHtml())).toEqual([['2', '4.00', '4.00', '4.00', '4.00', '1']]);
	});

	it('returns nothing when the survey type has no configured outcomes and no scores', async () => {
		repo.getConfiguredOutcomes.mockResolvedValue([]);
		repo.getScoreRows.mockResolvedValue([]);

		await expect(service.generate(baseRequest)).resolves.toEqual({ reports: [], zip: null });
		expect(generator.generateDocument).not.toHaveBeenCalled();
	});
});
