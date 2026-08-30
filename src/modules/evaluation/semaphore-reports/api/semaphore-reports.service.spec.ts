import { HttpStatus } from '@nestjs/common';
import { SemaphoreReportsService } from './semaphore-reports.service';
import { semaphoreReportsValidationStrings } from '../config/strings/semaphore-reports.validation';
import type {
	SemaphoreCampusRow,
	SemaphoreDetailRow,
	SemaphoreSummaryRow,
	SemaphoreCourseOutcomeRow,
	SemaphoreLevelLegendRow,
	MetadataRow,
} from '../core/semaphore-reports.repository';
import type {
	SemaphoreConsolidatedGroupDto,
	SemaphoreFilterDto,
	SemaphoreLevelLegendDto,
} from '../model/semaphore-reports.dtos';
import type { ReportDocument } from 'src/libs/reporting/report.types';

const CAMPUSES: SemaphoreCampusRow[] = [
	{ id: 1, code: 'LIM', name: 'Lima' },
	{ id: 2, code: 'ARE', name: 'Arequipa' },
	{ id: 3, code: 'TRU', name: 'Trujillo' },
];

// The real RC rows: closed ranges whose maximum is the next level's minimum minus an epsilon.
const RC_LEGEND: SemaphoreLevelLegendDto[] = [
	{ name: 'Necesita Mejora', minScore: 0, maxScore: 12.999999, color: '#e30613' },
	{ name: 'Esperado', minScore: 13, maxScore: 15.999999, color: '#f4c20d' },
	{ name: 'Sobresaliente', minScore: 16, maxScore: 20, color: '#16a34a' },
];

type CampusPlan = { mode: 'all' } | { mode: 'single'; campus: SemaphoreCampusRow };

interface Download {
	buffer: Buffer;
	filename: string;
	contentType: string;
}

const makeService = (
	repositoryOverrides: Record<string, unknown> = {},
	reportGeneratorOverrides: Record<string, unknown> = {},
) => {
	const repository = { getCampuses: jest.fn().mockResolvedValue(CAMPUSES), ...repositoryOverrides };
	const reportGenerator = {
		generateDocument: jest.fn().mockResolvedValue({ pdf: Buffer.from('pdf'), filename: 'r.pdf' }),
		...reportGeneratorOverrides,
	};
	return new SemaphoreReportsService(
		repository as any,
		reportGenerator as any,
		{} as any,
	) as unknown as {
		runQuery: <T>(read: () => Promise<T>) => Promise<T>;
		renderExcel: (
			data: unknown,
			type: 'rc' | 'rv',
			lang: 'es' | 'en',
			campusLabel: string,
		) => Promise<Buffer>;
		buildExcel: (
			data: unknown,
			type: 'rc' | 'rv',
			lang: 'es' | 'en',
			campusLabel: string,
		) => Promise<Buffer>;
		toSheetName: (label: string, taken: Set<string>) => string;
		resolveCampusPlan: (campusIds: number[] | undefined, lang: string) => Promise<CampusPlan>;
		buildFilename: (type: 'rc' | 'rv', lang: 'es' | 'en', campusCode?: string) => string;
		buildExcelFilename: (type: 'rc' | 'rv', lang: 'es' | 'en', campusCode?: string) => string;
		buildConsolidatedGroups: (rows: SemaphoreCourseOutcomeRow[]) => SemaphoreConsolidatedGroupDto[];
		formatLevelRange: (legend: SemaphoreLevelLegendDto[], index: number) => string;
		contrastText: (hex: string) => string;
		generatePdfDownload: (
			dto: SemaphoreFilterDto,
			academicPeriodId: number,
			instrument: 'rc' | 'rv',
		) => Promise<Download>;
		generateExcelDownload: (
			dto: SemaphoreFilterDto,
			academicPeriodId: number,
			instrument: 'rc' | 'rv',
		) => Promise<Download>;
		generateRcZipDownload: (dto: SemaphoreFilterDto, academicPeriodId: number) => Promise<Download>;
		generateRcPdf: (dto: SemaphoreFilterDto, academicPeriodId: number) => Promise<Download>;
		generateRvPdf: (dto: SemaphoreFilterDto, academicPeriodId: number) => Promise<Download>;
		generateRcExcel: (dto: SemaphoreFilterDto, academicPeriodId: number) => Promise<Download>;
		generateRvExcel: (dto: SemaphoreFilterDto, academicPeriodId: number) => Promise<Download>;
	};
};

describe('SemaphoreReportsService', () => {
	describe('runQuery', () => {
		it('passes through the resolved value on success', async () => {
			const service = makeService();

			await expect(service.runQuery(() => Promise.resolve('ok'))).resolves.toBe('ok');
		});

		it('maps a statement_timeout cancellation (57014) to a 503 with the queryTimeout key', async () => {
			const service = makeService();
			const pgError = Object.assign(new Error('canceling statement due to statement timeout'), {
				code: '57014',
			});

			await expect(service.runQuery(() => Promise.reject(pgError))).rejects.toMatchObject({
				status: HttpStatus.SERVICE_UNAVAILABLE,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.queryTimeout],
				},
			});
		});

		it('maps any other query failure to a 500 with the queryFailed key', async () => {
			const service = makeService();

			await expect(
				service.runQuery(() => Promise.reject(new Error('connection reset'))),
			).rejects.toMatchObject({
				status: HttpStatus.INTERNAL_SERVER_ERROR,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.queryFailed],
				},
			});
		});
	});

	describe('renderExcel', () => {
		it('returns the workbook buffer on success', async () => {
			const service = makeService();
			const buffer = Buffer.from('xlsx');
			jest.spyOn(service, 'buildExcel').mockResolvedValue(buffer);

			await expect(service.renderExcel({} as never, 'rc', 'es', 'Todas')).resolves.toBe(buffer);
		});

		it('maps a workbook build failure to a 500 with the excelFailed key', async () => {
			const service = makeService();
			jest.spyOn(service, 'buildExcel').mockRejectedValue(new Error('duplicate sheet name'));

			await expect(service.renderExcel({} as never, 'rc', 'es', 'Todas')).rejects.toMatchObject({
				status: HttpStatus.INTERNAL_SERVER_ERROR,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.excelFailed],
				},
			});
		});
	});

	describe('toSheetName', () => {
		it('returns the label unchanged when it fits and is not taken', () => {
			const service = makeService();

			expect(service.toSheetName('Red', new Set())).toBe('Red');
		});

		it('strips characters Excel rejects in a sheet name', () => {
			const service = makeService();

			expect(service.toSheetName('Red/Yellow:Green', new Set())).toBe('Red Yellow Green');
		});

		it('truncates to the 31-character Excel limit', () => {
			const service = makeService();
			const long = 'A'.repeat(50);

			const name = service.toSheetName(long, new Set());

			expect(name).toHaveLength(31);
			expect(name).toBe('A'.repeat(31));
		});

		it('suffixes a collision instead of reusing a taken name', () => {
			const service = makeService();
			const taken = new Set<string>();

			const first = service.toSheetName('Red', taken);
			const second = service.toSheetName('Red', taken);

			expect(first).toBe('Red');
			expect(second).toBe('Red 2');
			expect(taken).toEqual(new Set(['Red', 'Red 2']));
		});

		it('keeps every suffixed collision within the 31-character limit', () => {
			const service = makeService();
			const long = 'B'.repeat(31);
			const taken = new Set<string>([long]);

			const name = service.toSheetName(long, taken);

			expect(name.length).toBeLessThanOrEqual(31);
			expect(name).toBe(`${'B'.repeat(29)} 2`);
		});
	});

	describe('resolveCampusPlan', () => {
		it('resolves to "all" when no campus is requested', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan(undefined, 'es')).resolves.toEqual({ mode: 'all' });
			await expect(service.resolveCampusPlan([], 'es')).resolves.toEqual({ mode: 'all' });
		});

		it('resolves to "single" when exactly one campus is requested', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan([2], 'es')).resolves.toEqual({
				mode: 'single',
				campus: CAMPUSES[1],
			});
		});

		it('ignores duplicate ids instead of reading them as a multi-campus request', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan([1, 1], 'es')).resolves.toEqual({
				mode: 'single',
				campus: CAMPUSES[0],
			});
		});

		it('rejects more than one campus with 400/singleCampusRequired, without reading the catalog', async () => {
			const getCampuses = jest.fn().mockResolvedValue(CAMPUSES);
			const service = makeService({ getCampuses });

			await expect(service.resolveCampusPlan([1, 3], 'es')).rejects.toMatchObject({
				status: HttpStatus.BAD_REQUEST,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.singleCampusRequired],
				},
			});
			expect(getCampuses).not.toHaveBeenCalled();
		});

		it('rejects a selection naming every campus -- "all" is only ever the empty selection', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan([3, 1, 2], 'es')).rejects.toMatchObject({
				status: HttpStatus.BAD_REQUEST,
			});
		});

		it('throws 404/noData when the requested id is unknown', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan([999], 'es')).rejects.toMatchObject({
				status: HttpStatus.NOT_FOUND,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.noData],
				},
			});
		});
	});

	describe('filename builders', () => {
		it('appends a sanitized campus code to the PDF filename when given one', () => {
			const service = makeService();

			expect(service.buildFilename('rc', 'es')).toBe('Reporte_Control_RC.pdf');
			expect(service.buildFilename('rc', 'es', 'LIMA NORTE')).toBe(
				'Reporte_Control_RC_LIMA-NORTE.pdf',
			);
		});

		it('appends a sanitized campus code before the timestamp in the Excel filename', () => {
			const service = makeService();

			expect(service.buildExcelFilename('rv', 'en', 'AR/EQ')).toMatch(
				/^Report_Verification_RV_AR-EQ_\d+\.xlsx$/,
			);
		});
	});

	describe('formatLevelRange', () => {
		it("takes the lowest level's upper bound from the next level's minimum, not its own maximum", () => {
			const service = makeService();

			expect(service.formatLevelRange(RC_LEGEND, 0)).toBe('[0 - 13>');
		});

		it('closes a middle level on both its own minimum and maximum', () => {
			const service = makeService();

			expect(service.formatLevelRange(RC_LEGEND, 1)).toBe('[13 - 16]');
		});

		it("opens the top level on the previous level's maximum, closes on its own maximum", () => {
			const service = makeService();

			expect(service.formatLevelRange(RC_LEGEND, 2)).toBe('<16 - 20]');
		});

		it('trims the trailing zeros of a numeric(_, 6) score', () => {
			const service = makeService();
			const legend: SemaphoreLevelLegendDto[] = [
				{ name: 'Only', minScore: 0, maxScore: 20, color: '#000000' },
			];

			expect(service.formatLevelRange(legend, 0)).toBe('[0 - 20]');
		});
	});

	describe('contrastText', () => {
		it('darkens the label on a light segment and lightens it on a dark one', () => {
			const service = makeService();

			expect(service.contrastText('#f4c20d')).toBe('#18181b');
			expect(service.contrastText('#e30613')).toBe('#ffffff');
			expect(service.contrastText('#16a34a')).toBe('#ffffff');
		});

		it('falls back to white on a colour it cannot parse', () => {
			const service = makeService();

			expect(service.contrastText('not-a-colour')).toBe('#ffffff');
		});
	});

	describe('buildConsolidatedGroups', () => {
		const screenRow = (
			overrides: Partial<SemaphoreCourseOutcomeRow>,
		): SemaphoreCourseOutcomeRow => ({
			courseCode: 'C1',
			courseName: 'Course 1',
			outcomeCode: '1',
			outcomeName: 'Outcome 1',
			outcomeDescription: 'Outcome 1 description',
			totalStudents: 20,
			studentsRed: 5,
			studentsYellow: 0,
			studentsGreen: 15,
			campusId: 1,
			campus: 'Lima',
			academicPeriodCycle: '202510',
			...overrides,
		});

		it('sums a course across campuses and takes the percentage from the summed counts', () => {
			const service = makeService();

			const [group] = service.buildConsolidatedGroups([
				screenRow({ campusId: 1, totalStudents: 20, studentsRed: 5, studentsGreen: 15 }),
				screenRow({
					campusId: 2,
					totalStudents: 10,
					studentsRed: 3,
					studentsYellow: 2,
					studentsGreen: 5,
				}),
			]);

			expect(group.rows).toHaveLength(1);
			// 8/30, 2/30, 20/30 -- not the mean of the two campuses' own percentages.
			expect(group.rows[0].levels).toEqual([
				{ count: 8, percentage: 26.67 },
				{ count: 2, percentage: 6.67 },
				{ count: 20, percentage: 66.67 },
			]);
			expect(group.rows[0].totalStudents).toBe(30);
		});

		it('closes each outcome with its own totals across the courses in it', () => {
			const service = makeService();

			const [group] = service.buildConsolidatedGroups([
				screenRow({ courseCode: 'C1', totalStudents: 20, studentsRed: 5, studentsGreen: 15 }),
				screenRow({ courseCode: 'C2', totalStudents: 10, studentsRed: 1, studentsGreen: 9 }),
			]);

			expect(group.levelTotals).toEqual([6, 0, 24]);
			expect(group.totalStudents).toBe(30);
		});

		it('splits outcomes into their own groups', () => {
			const service = makeService();

			const groups = service.buildConsolidatedGroups([
				screenRow({ outcomeCode: '1', courseCode: 'C1' }),
				screenRow({ outcomeCode: '2', courseCode: 'C1' }),
			]);

			expect(groups.map((g) => g.outcomeCode)).toEqual(['1', '2']);
			expect(groups.every((g) => g.rows.length === 1)).toBe(true);
		});

		it('orders outcomes and courses numerically, so 2 comes before 10', () => {
			const service = makeService();

			const groups = service.buildConsolidatedGroups([
				screenRow({ outcomeCode: '10', courseCode: 'C10' }),
				screenRow({ outcomeCode: '2', courseCode: 'C2' }),
				screenRow({ outcomeCode: '10', courseCode: 'C2' }),
			]);

			expect(groups.map((g) => g.outcomeCode)).toEqual(['2', '10']);
			expect(groups[1].rows.map((r) => r.courseCode)).toEqual(['C2', 'C10']);
		});

		it('returns nothing when there are no screen rows', () => {
			const service = makeService();

			expect(service.buildConsolidatedGroups([])).toEqual([]);
		});
	});

	describe('generatePdfDownload / generateExcelDownload dispatch', () => {
		const legendRows: SemaphoreLevelLegendRow[] = RC_LEGEND;
		const metadata: MetadataRow = {
			programName: 'P',
			modalityName: 'Presencial',
			commissionName: 'C',
			academicPeriodCode: '202510',
			accreditorCode: 'ABET',
		};
		const detailRow = (campusId: number): SemaphoreDetailRow => ({
			courseCode: `C${campusId}`,
			courseName: `Course ${campusId}`,
			outcomeCode: '1',
			outcomeName: 'Outcome 1',
			levelRank: 1,
			quantity: 5,
			totalStudents: 20,
			percentage: 25,
			campusId,
			campus: `campus-${campusId}`,
			academicPeriodCycle: '202510',
		});

		// screenRows stays empty: buildOutcomeChartData then yields no categories, which skips the
		// chart-rendering branch in buildDocument and its ReportChartService dependency (unmocked here).
		const makeRepositoryMocks = (
			detailRows: SemaphoreDetailRow[],
			summaryRows: SemaphoreSummaryRow[] = [],
		) => ({
			getRcDetail: jest.fn().mockResolvedValue(detailRows),
			getRcSummary: jest.fn().mockResolvedValue(summaryRows),
			getRcScreen: jest.fn().mockResolvedValue([]),
			getLevelsLegend: jest.fn().mockResolvedValue(legendRows),
			getMetadata: jest.fn().mockResolvedValue(metadata),
		});

		const campusHeaderValue = (document: ReportDocument) =>
			document.metadata?.find((item) => item.label === 'Sede')?.value;

		describe('generatePdfDownload', () => {
			it('mode "all": fetches an unfiltered report and heads it "TODAS"', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(1), detailRow(2)]);
				const reportGeneratorMocks = {
					generateDocument: jest.fn().mockResolvedValue({ pdf: Buffer.from('pdf'), filename: 'x' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);

				const result = await service.generatePdfDownload({}, 10, 'rc');

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, null, 'es', null);
				expect(reportGeneratorMocks.generateDocument).toHaveBeenCalledTimes(1);
				const [document, filename] = reportGeneratorMocks.generateDocument.mock.calls[0];
				expect(filename).toBe('Reporte_Control_RC.pdf');
				expect(campusHeaderValue(document)).toBe('TODAS');
				expect(result).toEqual({
					buffer: Buffer.from('pdf'),
					filename: 'x',
					contentType: 'application/pdf',
				});
			});

			it('mode "single": scopes the fetch to the campus, and names both file and header after it', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(2)]);
				const reportGeneratorMocks = {
					generateDocument: jest.fn().mockResolvedValue({ pdf: Buffer.from('pdf'), filename: 'x' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);

				const result = await service.generatePdfDownload(
					{ campusIds: [2] } as SemaphoreFilterDto,
					10,
					'rc',
				);

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, [2], 'es', null);
				const [document, filename] = reportGeneratorMocks.generateDocument.mock.calls[0];
				expect(filename).toBe('Reporte_Control_RC_ARE.pdf');
				expect(campusHeaderValue(document)).toBe('Arequipa');
				expect(result.contentType).toBe('application/pdf');
			});

			it('rejects a multi-campus request before running any report query', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(1), detailRow(3)]);
				const service = makeService(repositoryMocks);

				await expect(
					service.generatePdfDownload({ campusIds: [1, 3] } as SemaphoreFilterDto, 10, 'rc'),
				).rejects.toMatchObject({
					status: HttpStatus.BAD_REQUEST,
					response: {
						errors: [semaphoreReportsValidationStrings.error.singleCampusRequired],
					},
				});
				expect(repositoryMocks.getRcDetail).not.toHaveBeenCalled();
			});

			it('renders the RC consolidated body and the RV pivoted body, neither with per-course listings', async () => {
				const screenRow: SemaphoreCourseOutcomeRow = {
					courseCode: 'C1',
					courseName: 'Course 1',
					outcomeCode: '1',
					outcomeName: 'Outcome 1',
					outcomeDescription: 'Outcome 1 description',
					totalStudents: 20,
					studentsRed: 5,
					studentsYellow: 0,
					studentsGreen: 15,
					campusId: 1,
					campus: 'Lima',
					academicPeriodCycle: '202510',
				};
				const repositoryMocks = {
					...makeRepositoryMocks([detailRow(1)]),
					getRvDetail: jest.fn().mockResolvedValue([detailRow(1)]),
					getRvSummary: jest.fn().mockResolvedValue([]),
					getRvScreen: jest.fn().mockResolvedValue([screenRow]),
					getRcScreen: jest.fn().mockResolvedValue([screenRow]),
				};
				const reportGeneratorMocks = {
					generateDocument: jest.fn().mockResolvedValue({ pdf: Buffer.from('pdf'), filename: 'x' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);
				(service as unknown as { reportChart: unknown }).reportChart = {
					buildGroupedBarChart: jest.fn().mockReturnValue('<svg />'),
				};

				await service.generatePdfDownload({}, 10, 'rc');
				await service.generatePdfDownload({}, 10, 'rv');

				const [rcDocument] = reportGeneratorMocks.generateDocument.mock.calls[0] as [
					ReportDocument,
				];
				const [rvDocument] = reportGeneratorMocks.generateDocument.mock.calls[1] as [
					ReportDocument,
				];

				expect(rcDocument.bodyHtml).toContain('Interpretación de Indicadores');
				expect(rcDocument.bodyHtml).toContain('Detalle de Cursos por Outcome');
				expect(rcDocument.bodyHtml).toContain('(5) 25%');
				expect(rcDocument.bodyHtml).not.toContain('Listado de Cursos con Nivel');

				// RV: chart (no legend of its own) + the "Interpretación de Indicadores" scale +
				// the pivoted outcome table -- no separate legend line, no per-course listings.
				expect(rvDocument.bodyHtml).toContain('Interpretación de Indicadores');
				expect(rvDocument.bodyHtml).not.toContain('Listado de Cursos con Nivel');
				expect(rvDocument.bodyHtml).not.toContain('Detalle de Cursos por Outcome');
				expect(rvDocument.bodyHtml).toContain('Outcome 1 description');
				expect(rvDocument.bodyHtml).toContain('(5) 25%');
				expect(rvDocument.bodyHtml).toContain('TOTALES');
			});
		});

		describe('generateExcelDownload', () => {
			it('mode "all": fetches an unfiltered report and renders one workbook', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(1)]);
				const service = makeService(repositoryMocks);
				jest.spyOn(service, 'renderExcel').mockResolvedValue(Buffer.from('xlsx'));

				const result = await service.generateExcelDownload({}, 10, 'rc');

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, null, 'es', null);
				expect(result.contentType).toBe(
					'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				);
				expect(result.filename).toMatch(/^Reporte_Control_RC_\d+\.xlsx$/);
			});

			it('mode "single": scopes the fetch and names the workbook after the campus', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(3)]);
				const service = makeService(repositoryMocks);
				jest.spyOn(service, 'renderExcel').mockResolvedValue(Buffer.from('xlsx'));

				const result = await service.generateExcelDownload(
					{ campusIds: [3] } as SemaphoreFilterDto,
					10,
					'rc',
				);

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, [3], 'es', null);
				expect(result.filename).toMatch(/^Reporte_Control_RC_TRU_\d+\.xlsx$/);
			});

			it('rejects a multi-campus request before running any report query', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(1)]);
				const service = makeService(repositoryMocks);

				await expect(
					service.generateExcelDownload({ campusIds: [1, 3] } as SemaphoreFilterDto, 10, 'rc'),
				).rejects.toMatchObject({
					status: HttpStatus.BAD_REQUEST,
					response: {
						errors: [semaphoreReportsValidationStrings.error.singleCampusRequired],
					},
				});
				expect(repositoryMocks.getRcDetail).not.toHaveBeenCalled();
			});
		});

		describe('generateRcZipDownload', () => {
			const makeZipRepositoryMocks = (outcomes: { id: number; outcomeCode: string }[]) => ({
				...makeRepositoryMocks([detailRow(1)]),
				getRcOutcomes: jest.fn().mockResolvedValue(outcomes),
			});

			it('generates one PDF per active outcome of the commission when none are selected', async () => {
				const repositoryMocks = makeZipRepositoryMocks([
					{ id: 1, outcomeCode: '1' },
					{ id: 2, outcomeCode: '2' },
				]);
				const reportGeneratorMocks = {
					generateZip: jest
						.fn()
						.mockResolvedValue({ zip: Buffer.from('zip'), filename: 'Reporte_Control_RC.zip' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);

				const result = await service.generateRcZipDownload({} as SemaphoreFilterDto, 10);

				expect(repositoryMocks.getRcOutcomes).toHaveBeenCalledWith(null, 'es');
				expect(repositoryMocks.getRcDetail).toHaveBeenCalledTimes(2);
				expect(repositoryMocks.getRcDetail).toHaveBeenNthCalledWith(1, 10, null, null, 'es', [1]);
				expect(repositoryMocks.getRcDetail).toHaveBeenNthCalledWith(2, 10, null, null, 'es', [2]);
				const [reports] = reportGeneratorMocks.generateZip.mock.calls[0];
				expect(reports).toHaveLength(2);
				expect(reports.map((r: { filename: string }) => r.filename)).toEqual([
					'Reporte_Control_RC_1.pdf',
					'Reporte_Control_RC_2.pdf',
				]);
				expect(result).toEqual({
					buffer: Buffer.from('zip'),
					filename: 'Reporte_Control_RC.zip',
					contentType: 'application/zip',
				});
			});

			it("narrows to the caller's selected outcome ids, dropping ones outside the commission", async () => {
				const repositoryMocks = makeZipRepositoryMocks([
					{ id: 1, outcomeCode: '1' },
					{ id: 2, outcomeCode: '2' },
				]);
				const reportGeneratorMocks = {
					generateZip: jest.fn().mockResolvedValue({ zip: Buffer.from('zip'), filename: 'z' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);

				// 99 doesn't belong to this commission's outcome list -- silently dropped, not an error.
				await service.generateRcZipDownload(
					{ outcomeIds: [2, 99] } as unknown as SemaphoreFilterDto,
					10,
				);

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledTimes(1);
				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, null, 'es', [2]);
			});

			it('skips an outcome with no data instead of failing the whole zip', async () => {
				const repositoryMocks = makeZipRepositoryMocks([
					{ id: 1, outcomeCode: '1' },
					{ id: 2, outcomeCode: '2' },
				]);
				repositoryMocks.getRcDetail = jest
					.fn()
					.mockResolvedValueOnce([]) // outcome 1: no data
					.mockResolvedValueOnce([detailRow(1)]); // outcome 2: has data
				const reportGeneratorMocks = {
					generateZip: jest.fn().mockResolvedValue({ zip: Buffer.from('zip'), filename: 'z' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);

				await service.generateRcZipDownload({} as SemaphoreFilterDto, 10);

				const [reports] = reportGeneratorMocks.generateZip.mock.calls[0];
				expect(reports).toHaveLength(1);
				expect(reports[0].filename).toBe('Reporte_Control_RC_2.pdf');
			});

			it('throws 404/noData when the commission has no active outcomes at all', async () => {
				const repositoryMocks = makeZipRepositoryMocks([]);
				const service = makeService(repositoryMocks);

				await expect(
					service.generateRcZipDownload({} as SemaphoreFilterDto, 10),
				).rejects.toMatchObject({
					status: HttpStatus.NOT_FOUND,
					response: { errors: [semaphoreReportsValidationStrings.error.noData] },
				});
			});
		});

		describe('public entry points', () => {
			it('dispatches RC/RV PDF and Excel requests to the right instrument and generator', async () => {
				const service = makeService();
				// RC's PDF download is one zip per commission (one PDF per outcome), RV's stays a
				// single PDF -- see SemaphoreReportsService.generateRcZipDownload.
				const rcZipSpy = jest.spyOn(service, 'generateRcZipDownload').mockResolvedValue({
					buffer: Buffer.from('z'),
					filename: 'z',
					contentType: 'application/zip',
				});
				const pdfSpy = jest.spyOn(service, 'generatePdfDownload').mockResolvedValue({
					buffer: Buffer.from('p'),
					filename: 'p',
					contentType: 'application/pdf',
				});
				const excelSpy = jest
					.spyOn(service, 'generateExcelDownload')
					.mockResolvedValue({ buffer: Buffer.from('x'), filename: 'x', contentType: 'xlsx' });
				const dto = {} as SemaphoreFilterDto;

				await service.generateRcPdf(dto, 10);
				await service.generateRvPdf(dto, 10);
				await service.generateRcExcel(dto, 10);
				await service.generateRvExcel(dto, 10);

				expect(rcZipSpy).toHaveBeenCalledWith(dto, 10);
				expect(pdfSpy).toHaveBeenCalledWith(dto, 10, 'rv');
				expect(excelSpy).toHaveBeenNthCalledWith(1, dto, 10, 'rc');
				expect(excelSpy).toHaveBeenNthCalledWith(2, dto, 10, 'rv');
			});
		});
	});
});
