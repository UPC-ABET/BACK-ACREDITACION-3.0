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
import type { SemaphoreFilterDto } from '../model/semaphore-reports.dtos';

const CAMPUSES: SemaphoreCampusRow[] = [
	{ id: 1, code: 'LIM', name: 'Lima' },
	{ id: 2, code: 'ARE', name: 'Arequipa' },
	{ id: 3, code: 'TRU', name: 'Trujillo' },
];

type CampusPlan = { mode: 'all' } | { mode: 'single' | 'zip'; campuses: SemaphoreCampusRow[] };

interface RenderReportDto {
	redDetail: Array<{ courseCode: string }>;
	yellowDetail: Array<{ courseCode: string }>;
	greenDetail: Array<{ courseCode: string }>;
}

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
		generateZip: jest.fn().mockResolvedValue({ zip: Buffer.from('zip'), filename: 'r.zip' }),
		archivePdfFiles: jest.fn().mockResolvedValue({ zip: Buffer.from('zip'), filename: 'r.zip' }),
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
		buildZipFilename: (type: 'rc' | 'rv', lang: 'es' | 'en') => string;
		fetchPerCampusRenderData: (
			dto: SemaphoreFilterDto,
			academicPeriodId: number,
			instrument: 'rc' | 'rv',
			campuses: SemaphoreCampusRow[],
		) => Promise<Array<{ campus: SemaphoreCampusRow; data: RenderReportDto }>>;
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

		it('resolves to "all" when the selection covers every active campus, in any order', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan([3, 1, 2], 'es')).resolves.toEqual({ mode: 'all' });
		});

		it('resolves to "single" when exactly one campus is requested', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan([2], 'es')).resolves.toEqual({
				mode: 'single',
				campuses: [CAMPUSES[1]],
			});
		});

		it('resolves to "zip" for a proper subset of more than one campus', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan([1, 3], 'es')).resolves.toEqual({
				mode: 'zip',
				campuses: [CAMPUSES[0], CAMPUSES[2]],
			});
		});

		it('ignores duplicate ids in the request instead of miscounting the selection', async () => {
			const service = makeService();

			await expect(service.resolveCampusPlan([1, 1], 'es')).resolves.toEqual({
				mode: 'single',
				campuses: [CAMPUSES[0]],
			});
		});

		it('throws 404/noData when every requested id is unknown', async () => {
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

		it('never includes a campus code in the zip filename', () => {
			const service = makeService();

			expect(service.buildZipFilename('rc', 'es')).toBe('Reporte_Control_RC.zip');
		});
	});

	describe('fetchPerCampusRenderData', () => {
		const legendRows: SemaphoreLevelLegendRow[] = [
			{ name: 'Necesita mejora', minScore: 0, maxScore: 13, color: '#e30613' },
			{ name: 'Esperado', minScore: 13, maxScore: 16, color: '#f4c20d' },
			{ name: 'Sobresaliente', minScore: 16, maxScore: 20, color: '#16a34a' },
		];
		const metadata: MetadataRow = {
			programName: 'P',
			commissionName: 'C',
			academicPeriodCode: '202510',
			accreditorCode: 'ABET',
		};

		// Row shapes only need `campusId` (the field the split groups by) and `levelRank`/`courseCode`
		// (asserted below) to be realistic -- the rest just has to satisfy the row types.
		const detailRow = (
			campusId: number,
			courseCode: string,
			levelRank: number,
		): SemaphoreDetailRow => ({
			courseCode,
			courseName: courseCode,
			outcomeCode: '1',
			outcomeName: 'Outcome 1',
			levelRank,
			quantity: 5,
			totalStudents: 20,
			percentage: 25,
			campusId,
			campus: `campus-${campusId}`,
			academicPeriodCycle: '202510',
		});
		const summaryRow = (campusId: number): SemaphoreSummaryRow => ({
			outcomeCode: '1',
			outcomeName: 'Outcome 1',
			levelRank: 1,
			quantity: 5,
			totalStudents: 20,
			percentage: 25,
			campusId,
			campus: `campus-${campusId}`,
		});
		const screenRow = (campusId: number): SemaphoreCourseOutcomeRow => ({
			courseCode: `C${campusId}`,
			courseName: `Course ${campusId}`,
			outcomeCode: '1',
			outcomeName: 'Outcome 1',
			outcomeDescription: 'Outcome 1 description',
			totalStudents: 20,
			studentsRed: 5,
			studentsYellow: 0,
			studentsGreen: 15,
			campusId,
			campus: `campus-${campusId}`,
			academicPeriodCycle: '202510',
		});

		const makeRepositoryMocks = (
			detailRows: SemaphoreDetailRow[],
			summaryRows: SemaphoreSummaryRow[],
			screenRows: SemaphoreCourseOutcomeRow[],
		) => ({
			getRcDetail: jest.fn().mockResolvedValue(detailRows),
			getRcSummary: jest.fn().mockResolvedValue(summaryRows),
			getRcScreen: jest.fn().mockResolvedValue(screenRows),
			getLevelsLegend: jest.fn().mockResolvedValue(legendRows),
			getMetadata: jest.fn().mockResolvedValue(metadata),
		});

		it('fetches every selected campus in ONE call, then splits the result per campus', async () => {
			const repositoryMocks = makeRepositoryMocks(
				[detailRow(1, 'C1', 1), detailRow(2, 'C2', 3)],
				[summaryRow(1), summaryRow(2)],
				[screenRow(1), screenRow(2)],
			);
			const service = makeService(repositoryMocks);

			const results = await service.fetchPerCampusRenderData({}, 10, 'rc', [
				CAMPUSES[0],
				CAMPUSES[1],
			]);

			// One shared call carrying both campus ids -- not one call per campus.
			expect(repositoryMocks.getRcDetail).toHaveBeenCalledTimes(1);
			expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, [1, 2], 'es');

			expect(results).toHaveLength(2);
			const [lima, arequipa] = results;
			expect(lima.campus.id).toBe(1);
			expect(lima.data.redDetail.map((r) => r.courseCode)).toEqual(['C1']);
			expect(lima.data.greenDetail).toHaveLength(0);
			expect(arequipa.campus.id).toBe(2);
			expect(arequipa.data.greenDetail.map((r) => r.courseCode)).toEqual(['C2']);
			expect(arequipa.data.redDetail).toHaveLength(0);
		});

		it('skips a selected campus with no rows instead of failing the whole batch', async () => {
			const repositoryMocks = makeRepositoryMocks(
				[detailRow(1, 'C1', 1)],
				[summaryRow(1)],
				[screenRow(1)],
			);
			const service = makeService(repositoryMocks);

			const results = await service.fetchPerCampusRenderData({}, 10, 'rc', [
				CAMPUSES[0],
				CAMPUSES[1],
			]);

			expect(results).toHaveLength(1);
			expect(results[0].campus.id).toBe(1);
		});

		it('throws 404/noData when none of the selected campuses have data', async () => {
			const repositoryMocks = makeRepositoryMocks([], [], []);
			const service = makeService(repositoryMocks);

			await expect(
				service.fetchPerCampusRenderData({}, 10, 'rc', [CAMPUSES[0], CAMPUSES[1]]),
			).rejects.toMatchObject({
				status: HttpStatus.NOT_FOUND,
				response: {
					message: semaphoreReportsValidationStrings.result.generateFailed,
					errors: [semaphoreReportsValidationStrings.error.noData],
				},
			});
		});
	});

	describe('generatePdfDownload / generateExcelDownload dispatch', () => {
		const legendRows: SemaphoreLevelLegendRow[] = [
			{ name: 'Necesita mejora', minScore: 0, maxScore: 13, color: '#e30613' },
			{ name: 'Esperado', minScore: 13, maxScore: 16, color: '#f4c20d' },
			{ name: 'Sobresaliente', minScore: 16, maxScore: 20, color: '#16a34a' },
		];
		const metadata: MetadataRow = {
			programName: 'P',
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
		const summaryRow = (campusId: number): SemaphoreSummaryRow => ({
			outcomeCode: '1',
			outcomeName: 'Outcome 1',
			levelRank: 1,
			quantity: 5,
			totalStudents: 20,
			percentage: 25,
			campusId,
			campus: `campus-${campusId}`,
		});

		// screenRows stays empty: buildOutcomeChartData then yields no categories, which skips the
		// chart-rendering branch in buildDocument and its ReportChartService dependency (unmocked here).
		const makeRepositoryMocks = (
			detailRows: SemaphoreDetailRow[],
			summaryRows: SemaphoreSummaryRow[],
		) => ({
			getRcDetail: jest.fn().mockResolvedValue(detailRows),
			getRcSummary: jest.fn().mockResolvedValue(summaryRows),
			getRcScreen: jest.fn().mockResolvedValue([]),
			getLevelsLegend: jest.fn().mockResolvedValue(legendRows),
			getMetadata: jest.fn().mockResolvedValue(metadata),
		});

		describe('generatePdfDownload', () => {
			it('mode "all": fetches an unfiltered report and renders one PDF', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(1), detailRow(2)], []);
				const reportGeneratorMocks = {
					generateDocument: jest.fn().mockResolvedValue({ pdf: Buffer.from('pdf'), filename: 'x' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);

				const result = await service.generatePdfDownload({}, 10, 'rc');

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, null, 'es');
				expect(reportGeneratorMocks.generateDocument).toHaveBeenCalledTimes(1);
				expect(reportGeneratorMocks.generateDocument.mock.calls[0][1]).toBe(
					'Reporte_Control_RC.pdf',
				);
				expect(result).toEqual({
					buffer: Buffer.from('pdf'),
					filename: 'x',
					contentType: 'application/pdf',
				});
			});

			it('mode "single": scopes the fetch to the one selected campus and names the file after it', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(2)], []);
				const reportGeneratorMocks = {
					generateDocument: jest.fn().mockResolvedValue({ pdf: Buffer.from('pdf'), filename: 'x' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);

				const result = await service.generatePdfDownload(
					{ campusIds: [2] } as SemaphoreFilterDto,
					10,
					'rc',
				);

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, [2], 'es');
				expect(reportGeneratorMocks.generateDocument.mock.calls[0][1]).toBe(
					'Reporte_Control_RC_ARE.pdf',
				);
				expect(result.contentType).toBe('application/pdf');
			});

			it('mode "zip": fetches every selected campus once and zips one PDF per campus', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(1), detailRow(3)], []);
				const reportGeneratorMocks = {
					generateZip: jest.fn().mockResolvedValue({ zip: Buffer.from('zip'), filename: 'x' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);

				const result = await service.generatePdfDownload(
					{ campusIds: [1, 3] } as SemaphoreFilterDto,
					10,
					'rc',
				);

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledTimes(1);
				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, [1, 3], 'es');
				expect(reportGeneratorMocks.generateZip).toHaveBeenCalledTimes(1);
				const reports = reportGeneratorMocks.generateZip.mock.calls[0][0];
				expect(reports.map((r: { filename: string }) => r.filename)).toEqual([
					'Reporte_Control_RC_LIM.pdf',
					'Reporte_Control_RC_TRU.pdf',
				]);
				expect(result).toEqual({
					buffer: Buffer.from('zip'),
					filename: 'x',
					contentType: 'application/zip',
				});
			});
		});

		describe('generateExcelDownload', () => {
			it('mode "all": fetches an unfiltered report and renders one workbook', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(1)], []);
				const service = makeService(repositoryMocks);
				jest.spyOn(service, 'renderExcel').mockResolvedValue(Buffer.from('xlsx'));

				const result = await service.generateExcelDownload({}, 10, 'rc');

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledWith(10, null, null, 'es');
				expect(result.contentType).toBe(
					'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				);
				expect(result.filename).toMatch(/^Reporte_Control_RC_\d+\.xlsx$/);
			});

			it('mode "zip": fetches every selected campus once and zips one workbook per campus', async () => {
				const repositoryMocks = makeRepositoryMocks([detailRow(1), detailRow(3)], []);
				const reportGeneratorMocks = {
					archivePdfFiles: jest.fn().mockResolvedValue({ zip: Buffer.from('zip'), filename: 'x' }),
				};
				const service = makeService(repositoryMocks, reportGeneratorMocks);
				jest.spyOn(service, 'renderExcel').mockResolvedValue(Buffer.from('xlsx'));

				const result = await service.generateExcelDownload(
					{ campusIds: [1, 3] } as SemaphoreFilterDto,
					10,
					'rc',
				);

				expect(repositoryMocks.getRcDetail).toHaveBeenCalledTimes(1);
				expect(reportGeneratorMocks.archivePdfFiles).toHaveBeenCalledTimes(1);
				const files = reportGeneratorMocks.archivePdfFiles.mock.calls[0][0];
				expect(files).toHaveLength(2);
				expect(result).toEqual({
					buffer: Buffer.from('zip'),
					filename: 'x',
					contentType: 'application/zip',
				});
			});
		});

		describe('public entry points', () => {
			it('dispatches RC/RV PDF and Excel requests to the right instrument and generator', async () => {
				const service = makeService();
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

				expect(pdfSpy).toHaveBeenNthCalledWith(1, dto, 10, 'rc');
				expect(pdfSpy).toHaveBeenNthCalledWith(2, dto, 10, 'rv');
				expect(excelSpy).toHaveBeenNthCalledWith(1, dto, 10, 'rc');
				expect(excelSpy).toHaveBeenNthCalledWith(2, dto, 10, 'rv');
			});
		});
	});
});
