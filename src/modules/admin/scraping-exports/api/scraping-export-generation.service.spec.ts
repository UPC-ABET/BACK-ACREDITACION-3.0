import { Logger } from '@nestjs/common';

import { ConflictError } from 'src/commons/domain-error';

import { ScrapeRunRepository } from '../../banner/raw/core/scrape-run.repository';
import { PlannerScrapeRunRepository } from '../../planner/raw/core/planner-scrape-run.repository';
import { ScrapingExportRunRepository } from '../core/scraping-export-run.repository';
import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';
import { getDefaultExportFileName } from '../model/scraping-exports.labels';
import { ScrapingExportsService } from './scraping-exports.service';
import {
	GENERATION_STALE_TIMEOUT_MS,
	GRADES_RC_ROW_COUNT_WARNING_THRESHOLD,
	ScrapingExportGenerationService,
} from './scraping-export-generation.service';

const PERIOD = '202610';

const mockRunRepository = {
	findByKey: jest.fn(),
	upsertByKey: jest.fn(),
};
const mockExportsRepository = {
	findAcademicPeriodIdByCode: jest.fn(),
};
const mockScrapeRunRepository = {
	findByPeriod: jest.fn(),
};
const mockPlannerScrapeRunRepository = {
	findByPeriod: jest.fn(),
};
const mockExportsService = {
	fetchStaffRows: jest.fn(),
	fetchSectionRows: jest.fn(),
	fetchEnrolledStudentRows: jest.fn(),
	fetchStudentSectionRows: jest.fn(),
	renderStaffExcel: jest.fn(),
	renderSectionsExcel: jest.fn(),
	renderEnrolledStudentsExcel: jest.fn(),
	renderStudentSectionsExcel: jest.fn(),
	fetchGradesRcRows: jest.fn(),
	renderGradesRc: jest.fn(),
};

const buildService = () =>
	new ScrapingExportGenerationService(
		mockRunRepository as unknown as ScrapingExportRunRepository,
		mockExportsRepository as unknown as ScrapingExportsRepository,
		mockScrapeRunRepository as unknown as ScrapeRunRepository,
		mockPlannerScrapeRunRepository as unknown as PlannerScrapeRunRepository,
		mockExportsService as unknown as ScrapingExportsService,
	);

// Both trigger paths fire generation without awaiting it, so tests have to let the microtask
// queue drain before asserting on what it did.
const flush = async () => {
	for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
};

const upsertCallsFor = (exportType: string, period: string) =>
	mockRunRepository.upsertByKey.mock.calls.filter(
		([callExportType, callPeriod]) => callExportType === exportType && callPeriod === period,
	);

// Reaches the private fire-and-forget entry point the two auto-trigger call sites use, so a
// single key's duplicate-trigger scenario can be exercised without going through the full
// multi-export-type fan-out.
const callFireAndForgetGenerate = (
	service: ScrapingExportGenerationService,
	...args: unknown[]
): void => {
	(
		service as unknown as { fireAndForgetGenerate: (...callArgs: unknown[]) => void }
	).fireAndForgetGenerate(...args);
};

let nextRunId = 1;

beforeEach(() => {
	jest.clearAllMocks();
	nextRunId = 1;
	mockRunRepository.upsertByKey.mockImplementation(async (exportType, period, patch) => ({
		id: nextRunId++,
		exportType,
		period,
		...patch,
	}));
	mockExportsRepository.findAcademicPeriodIdByCode.mockResolvedValue(5);
	mockScrapeRunRepository.findByPeriod.mockResolvedValue([]);
	mockPlannerScrapeRunRepository.findByPeriod.mockResolvedValue([]);
	mockExportsService.fetchStaffRows.mockResolvedValue([{ professorCode: 'N001' }]);
	mockExportsService.fetchSectionRows.mockResolvedValue([{ sectionCode: 'NRC1' }]);
	mockExportsService.fetchEnrolledStudentRows.mockResolvedValue([{ studentCode: 'A1' }]);
	mockExportsService.fetchStudentSectionRows.mockResolvedValue([{ sectionCode: 'NRC1' }]);
	mockExportsService.fetchGradesRcRows.mockResolvedValue([]);
	mockExportsService.renderGradesRc.mockResolvedValue({
		buffer: Buffer.from('rc'),
		fileName: 'NotasRC.xlsx',
	});
});

describe('ScrapingExportGenerationService.triggerForBannerRun', () => {
	it('generates each of the four Banner exports exactly once, regardless of how many languages exist', async () => {
		const service = buildService();

		await service.triggerForBannerRun(PERIOD, 'banner-run-1');
		await flush();

		expect(mockExportsService.fetchStaffRows).toHaveBeenCalledTimes(1);
		expect(mockExportsService.fetchSectionRows).toHaveBeenCalledTimes(1);
		expect(mockExportsService.fetchEnrolledStudentRows).toHaveBeenCalledTimes(1);
		expect(mockExportsService.fetchStudentSectionRows).toHaveBeenCalledTimes(1);
	});

	it('does not trigger gradesRc when no completed Planner run exists for the period', async () => {
		mockPlannerScrapeRunRepository.findByPeriod.mockResolvedValue([{ status: 'running' }]);
		const service = buildService();

		await service.triggerForBannerRun(PERIOD, 'banner-run-1');
		await flush();

		expect(mockExportsService.fetchGradesRcRows).not.toHaveBeenCalled();
	});

	it('triggers gradesRc exactly once when a completed Planner run exists for the period', async () => {
		mockPlannerScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'planner-run-1' },
		]);
		const service = buildService();

		await service.triggerForBannerRun(PERIOD, 'banner-run-1');
		await flush();

		expect(mockExportsService.fetchGradesRcRows).toHaveBeenCalledTimes(1);
	});
});

describe('ScrapingExportGenerationService.triggerForPlannerRun', () => {
	it('triggers gradesRc exactly once when a completed Banner run exists for the period', async () => {
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'banner-run-1' },
		]);
		const service = buildService();

		await service.triggerForPlannerRun(PERIOD, 'planner-run-1');
		await flush();

		expect(mockExportsService.fetchGradesRcRows).toHaveBeenCalledTimes(1);
	});

	it('does nothing when no completed Banner run exists for the period', async () => {
		const service = buildService();

		await service.triggerForPlannerRun(PERIOD, 'planner-run-1');
		await flush();

		expect(mockRunRepository.upsertByKey).not.toHaveBeenCalled();
	});
});

describe('ScrapingExportGenerationService AF-1 Banner period-not-found guard', () => {
	it('fails loud instead of generating with a null academicPeriodId for a Banner export type', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockExportsRepository.findAcademicPeriodIdByCode.mockResolvedValue(null);
		const service = buildService();

		await service.regenerate('staff', PERIOD, 'user-1');
		await flush();

		expect(mockExportsService.fetchStaffRows).not.toHaveBeenCalled();
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIOD,
			expect.objectContaining({ status: 'failed', errorMessage: expect.any(String) }),
		);
	});
});

describe('ScrapingExportGenerationService AC-4 sync export generation persists rowsData', () => {
	it('upserts the completed row with the fetched rowsData, and no fileBytes/fileName', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const rows = [{ professorCode: 'N001' }];
		mockExportsService.fetchStaffRows.mockResolvedValue(rows);
		const service = buildService();

		await service.regenerate('staff', PERIOD, 'user-1');
		await flush();

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIOD,
			expect.objectContaining({ status: 'completed', rowsData: rows }),
		);
		const completedCall = mockRunRepository.upsertByKey.mock.calls.find(
			([, , patch]) => (patch as { status?: string }).status === 'completed',
		);
		expect(completedCall?.[2]).not.toHaveProperty('fileBytes');
		expect(completedCall?.[2]).not.toHaveProperty('fileName');
	});
});

describe('ScrapingExportGenerationService AF-3 source run id wiring', () => {
	it('writes sourceBannerRunId on the four Banner exports triggered from a Banner run', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await service.triggerForBannerRun(PERIOD, 'banner-run-1');
		await flush();

		for (const exportType of ['staff', 'sections', 'enrolledStudents', 'studentSections']) {
			expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
				exportType,
				PERIOD,
				expect.objectContaining({ status: 'running', sourceBannerRunId: 'banner-run-1' }),
			);
		}
	});

	it('writes both source ids on gradesRc triggered from a Banner run when a completed Planner run exists', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockPlannerScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'planner-run-1' },
		]);
		const service = buildService();

		await service.triggerForBannerRun(PERIOD, 'banner-run-1');
		await flush();

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIOD,
			expect.objectContaining({
				status: 'running',
				sourceBannerRunId: 'banner-run-1',
				sourcePlannerRunId: 'planner-run-1',
			}),
		);
	});

	it('writes both source ids on gradesRc triggered from a Planner run when a completed Banner run exists', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'banner-run-1' },
		]);
		const service = buildService();

		await service.triggerForPlannerRun(PERIOD, 'planner-run-1');
		await flush();

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIOD,
			expect.objectContaining({
				status: 'running',
				sourceBannerRunId: 'banner-run-1',
				sourcePlannerRunId: 'planner-run-1',
			}),
		);
	});

	it('regenerate resolves the currently completed source run ids it can find', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'banner-run-9' },
		]);
		mockPlannerScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'planner-run-9' },
		]);
		const service = buildService();

		await service.regenerate('gradesRc', PERIOD, 'user-1');

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIOD,
			expect.objectContaining({
				status: 'running',
				sourceBannerRunId: 'banner-run-9',
				sourcePlannerRunId: 'planner-run-9',
			}),
		);
	});
});

describe('ScrapingExportGenerationService AF-6 same-key duplicate trigger guard', () => {
	it('does not run a full generation pass twice when a second auto-trigger lands for the same key while the first is still running', async () => {
		mockRunRepository.findByKey.mockResolvedValueOnce(null).mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			updatedAt: new Date(),
		});
		let releaseFirstGeneration!: () => void;
		const gate = new Promise<void>((resolve) => (releaseFirstGeneration = resolve));
		mockExportsService.fetchStaffRows.mockImplementationOnce(async () => {
			await gate;
			return [{ professorCode: 'N001' }];
		});
		const service = buildService();

		callFireAndForgetGenerate(service, 'staff', PERIOD);
		await flush();
		callFireAndForgetGenerate(service, 'staff', PERIOD);
		await flush();

		expect(mockExportsService.fetchStaffRows).toHaveBeenCalledTimes(1);

		releaseFirstGeneration();
		await flush();
	});
});

describe('ScrapingExportGenerationService.regenerate', () => {
	it('throws ConflictError when the current row is running and not stale', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.regenerate('staff', PERIOD, 'user-1')).rejects.toThrow(ConflictError);
		await expect(service.regenerate('staff', PERIOD, 'user-1')).rejects.toMatchObject({
			messageKey: scrapingExportsValidationStrings.error.alreadyGenerating,
		});
	});

	it('upserts to running and returns the row when not currently running', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		const result = await service.regenerate('staff', PERIOD, 'user-1');

		expect(result).toMatchObject({ status: 'running' });
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIOD,
			expect.objectContaining({ status: 'running', triggeredBy: 'user-1' }),
		);
	});

	it('calls upsertByKey to running exactly once per successful claim (AF-8)', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await service.regenerate('staff', PERIOD, 'user-1');

		const runningCalls = mockRunRepository.upsertByKey.mock.calls.filter(
			([, , patch]) => (patch as { status?: string }).status === 'running',
		);
		expect(runningCalls.length).toBe(1);
	});

	it('reconciles a stale running row first, so a stale generation never blocks a new one', async () => {
		const staleDate = new Date(Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000);
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			updatedAt: staleDate,
		});
		mockRunRepository.upsertByKey
			.mockResolvedValueOnce({
				id: 1,
				exportType: 'staff',
				period: PERIOD,
				status: 'failed',
				errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
			})
			.mockResolvedValueOnce({
				id: 1,
				exportType: 'staff',
				period: PERIOD,
				status: 'running',
				triggeredBy: 'user-1',
			});
		const service = buildService();

		await expect(service.regenerate('staff', PERIOD, 'user-1')).resolves.toMatchObject({
			status: 'running',
		});
		// Asserts the claim path's first two calls specifically (reconcile-to-failed, then
		// claim-to-running) rather than the total call count: `regenerate` also fires the actual
		// generation in the background (fireAndForgetRunGeneration), which lands its own
		// upsertByKey call independently of this assertion's timing.
		expect(mockRunRepository.upsertByKey).toHaveBeenNthCalledWith(
			1,
			'staff',
			PERIOD,
			expect.objectContaining({
				status: 'failed',
				errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
			}),
		);
		expect(mockRunRepository.upsertByKey).toHaveBeenNthCalledWith(
			2,
			'staff',
			PERIOD,
			expect.objectContaining({ status: 'running', triggeredBy: 'user-1' }),
		);
	});

	it('is not blocked on retry by anything language-related after a stale row is reconciled to failed', async () => {
		const staleDate = new Date(Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000);
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'gradesRc',
			period: PERIOD,
			status: 'running',
			updatedAt: staleDate,
		});
		const service = buildService();

		await expect(service.regenerate('gradesRc', PERIOD, 'user-1')).resolves.toMatchObject({
			status: 'running',
		});
	});
});

describe('ScrapingExportGenerationService.getStatus', () => {
	it('returns notGenerated when no row exists', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await expect(service.getStatus('staff', PERIOD)).resolves.toEqual({ status: 'notGenerated' });
	});

	it('returns the row metadata, but never rowsData, and no lang field', async () => {
		const row = {
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'completed',
			rowsData: [{ should: 'not leak into the status response' }],
			errorMessage: null,
			startedAt: new Date('2026-08-20T09:00:00Z'),
			finishedAt: new Date('2026-08-20T09:05:00Z'),
			updatedAt: new Date(),
		};
		mockRunRepository.findByKey.mockResolvedValue(row);
		const service = buildService();

		const result = await service.getStatus('staff', PERIOD);

		expect(result).toEqual({
			exportType: 'staff',
			period: PERIOD,
			status: 'completed',
			fileName: getDefaultExportFileName('staff'),
			errorMessage: null,
			startedAt: row.startedAt,
			finishedAt: row.finishedAt,
		});
		expect(result).not.toHaveProperty('rowsData');
		expect(result).not.toHaveProperty('lang');
	});

	// Blocker fix: the frontend gates its download action on `fileName !== null`, so a row that has
	// never completed must report null even though it otherwise looks read-only-safe to serialize.
	it('reports fileName: null for a row that has never completed', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			rowsData: null,
			errorMessage: null,
			startedAt: new Date(),
			finishedAt: null,
			updatedAt: new Date(),
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIOD);

		expect(result).toMatchObject({ status: 'running', fileName: null });
	});
});

describe('ScrapingExportGenerationService.download', () => {
	it('returns null when no row exists', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await expect(service.download('staff', PERIOD, 'es')).resolves.toBeNull();
	});

	it('returns null when rowsData has never been written for a sync export', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'completed',
			rowsData: null,
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.download('staff', PERIOD, 'es')).resolves.toBeNull();
	});

	it('renders the stored rows even when status is running (stale-while-regenerating)', async () => {
		const rows = [{ professorCode: 'N001' }];
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			rowsData: rows,
			updatedAt: new Date(),
		});
		mockExportsService.renderStaffExcel.mockResolvedValue({
			buffer: Buffer.from('old'),
			fileName: 'Docentes.xlsx',
		});
		const service = buildService();

		await expect(service.download('staff', PERIOD, 'es')).resolves.toEqual({
			fileName: 'Docentes.xlsx',
			buffer: Buffer.from('old'),
		});
		expect(mockExportsService.renderStaffExcel).toHaveBeenCalledWith(rows, 'es');
	});

	it('renders a never-before-downloaded language from the same stored rows, without re-fetching', async () => {
		const rows = [{ professorCode: 'N001' }];
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'completed',
			rowsData: rows,
			updatedAt: new Date(),
		});
		mockExportsService.renderStaffExcel.mockResolvedValue({
			buffer: Buffer.from('en'),
			fileName: 'Professors.xlsx',
		});
		const service = buildService();

		await service.download('staff', PERIOD, 'en');

		expect(mockExportsService.fetchStaffRows).not.toHaveBeenCalled();
		expect(mockExportsService.renderStaffExcel).toHaveBeenCalledWith(rows, 'en');
	});

	it('gradesRc: returns null when rowsData has never been written', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'gradesRc',
			period: PERIOD,
			status: 'completed',
			rowsData: null,
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.download('gradesRc', PERIOD, 'es')).resolves.toBeNull();
		expect(mockExportsService.renderGradesRc).not.toHaveBeenCalled();
	});

	it('gradesRc: renders from the persisted rows without re-running the merge', async () => {
		const rows = [{ sectionCode: 'NRC1', studentCode: 'A1' }];
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'gradesRc',
			period: PERIOD,
			status: 'completed',
			rowsData: rows,
			updatedAt: new Date(),
		});
		const service = buildService();

		await service.download('gradesRc', PERIOD, 'en');

		expect(mockExportsService.fetchGradesRcRows).not.toHaveBeenCalled();
		expect(mockExportsService.renderGradesRc).toHaveBeenCalledWith(rows, 'en');
	});

	// Stale-while-regenerating, same as the sync exports: a single rowsData column update is one
	// row, so a concurrent read sees either the whole old array or the whole new one.
	it('gradesRc: renders the stored rows even when status is running (stale-while-regenerating)', async () => {
		const rows = [{ sectionCode: 'NRC1', studentCode: 'A1' }];
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'gradesRc',
			period: PERIOD,
			status: 'running',
			rowsData: rows,
			updatedAt: new Date(),
		});
		const service = buildService();

		await service.download('gradesRc', PERIOD, 'es');

		expect(mockExportsService.renderGradesRc).toHaveBeenCalledWith(rows, 'es');
	});
});

describe('ScrapingExportGenerationService reconcileIfStale (exercised through getStatus)', () => {
	it('flips a running row older than the stale timeout to failed', async () => {
		const staleDate = new Date(Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000);
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			updatedAt: staleDate,
		});
		mockRunRepository.upsertByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'failed',
			errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIOD);

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIOD,
			expect.objectContaining({
				status: 'failed',
				errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
			}),
		);
		expect((result as { status: string }).status).toBe('failed');
	});

	it('leaves a recent running row untouched', async () => {
		const recentDate = new Date(Date.now() - 1000);
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			updatedAt: recentDate,
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIOD);

		expect(mockRunRepository.upsertByKey).not.toHaveBeenCalled();
		expect((result as { status: string }).status).toBe('running');
	});
});

describe('ScrapingExportGenerationService reconcileIfStale boundary (AF-13)', () => {
	const FIXED_NOW = 1_700_000_000_000;

	afterEach(() => {
		jest.useRealTimers();
	});

	it('does not flip a running row exactly (GENERATION_STALE_TIMEOUT_MS - 1)ms old', async () => {
		jest.useFakeTimers({ now: FIXED_NOW });
		const updatedAt = new Date(FIXED_NOW - (GENERATION_STALE_TIMEOUT_MS - 1));
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			updatedAt,
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIOD);

		expect(mockRunRepository.upsertByKey).not.toHaveBeenCalled();
		expect((result as { status: string }).status).toBe('running');
	});

	it('flips a running row exactly GENERATION_STALE_TIMEOUT_MS old to failed', async () => {
		jest.useFakeTimers({ now: FIXED_NOW });
		const updatedAt = new Date(FIXED_NOW - GENERATION_STALE_TIMEOUT_MS);
		mockRunRepository.findByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'running',
			updatedAt,
		});
		mockRunRepository.upsertByKey.mockResolvedValue({
			id: 1,
			exportType: 'staff',
			period: PERIOD,
			status: 'failed',
			errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIOD);

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIOD,
			expect.objectContaining({ status: 'failed' }),
		);
		expect((result as { status: string }).status).toBe('failed');
	});
});

describe('ScrapingExportGenerationService gradesRc generation', () => {
	it('fetches gradesRc rows via ScrapingExportsService.fetchGradesRcRows and stores completed status with rowsData', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const rows = [{ sectionCode: 'NRC1', studentCode: 'A1' }];
		mockExportsService.fetchGradesRcRows.mockResolvedValue(rows);
		const service = buildService();

		await service.regenerate('gradesRc', PERIOD, 'user-1');
		await flush();

		expect(mockExportsService.fetchGradesRcRows).toHaveBeenCalledWith(5);
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIOD,
			expect.objectContaining({ status: 'completed', rowsData: rows }),
		);
	});

	it('sets status failed with an errorMessage, not an unhandled rejection, when the merge fails', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockExportsService.fetchGradesRcRows.mockRejectedValue(new Error('merge blew up'));
		const service = buildService();

		await expect(service.regenerate('gradesRc', PERIOD, 'user-1')).resolves.toBeDefined();
		await flush();

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIOD,
			expect.objectContaining({ status: 'failed', errorMessage: expect.any(String) }),
		);
	});

	// ADR-004's accepted risk: a future period could grow past what a single jsonb value should
	// safely hold. This is a visibility net, not a cap -- generation still completes.
	it('logs a warning when the fetched row count exceeds the documented threshold, but still completes', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const rows = Array.from({ length: GRADES_RC_ROW_COUNT_WARNING_THRESHOLD + 1 }, (_, i) => ({
			sectionCode: `NRC${i}`,
		}));
		mockExportsService.fetchGradesRcRows.mockResolvedValue(rows);
		const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const service = buildService();

		await service.regenerate('gradesRc', PERIOD, 'user-1');
		await flush();

		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(String(rows.length)));
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIOD,
			expect.objectContaining({ status: 'completed', rowsData: rows }),
		);
		warnSpy.mockRestore();
	});

	it('does not log a warning when the row count is under the threshold', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockExportsService.fetchGradesRcRows.mockResolvedValue([{ sectionCode: 'NRC1' }]);
		const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const service = buildService();

		await service.regenerate('gradesRc', PERIOD, 'user-1');
		await flush();

		expect(warnSpy).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});

describe('ScrapingExportGenerationService gradesRc system-wide single-flight guard', () => {
	it('does not run two gradesRc merges concurrently for different periods; the second is skipped, not written as failed (AF-6)', async () => {
		// Goes through the auto-trigger path (triggerForPlannerRun), not regenerate(): regenerate()
		// has its own pre-check that 409s a caller before ever reaching generation; this guard
		// exists specifically for the auto-trigger path, which has no caller to 409.
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'banner-run-1' },
		]);
		let releaseFirstMerge!: () => void;
		const firstMergeGate = new Promise<void>((resolve) => (releaseFirstMerge = resolve));
		mockExportsService.fetchGradesRcRows.mockImplementationOnce(async () => {
			await firstMergeGate;
			return [];
		});
		const service = buildService();

		await service.triggerForPlannerRun('P1', 'planner-run-1');
		// Let the first triggered generation reach runGradesRcGeneration and flip the flag before
		// the second period is triggered, without letting the first merge finish.
		await flush();

		await service.triggerForPlannerRun('P2', 'planner-run-2');
		await flush();

		expect(mockExportsService.fetchGradesRcRows).toHaveBeenCalledTimes(1);
		expect(upsertCallsFor('gradesRc', 'P2')).toHaveLength(0);

		releaseFirstMerge();
		await flush();
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			'P1',
			expect.objectContaining({ status: 'completed' }),
		);
	});

	it('regenerate throws ConflictError when the gradesRc merge slot is held, even for a different period', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();
		(service as unknown as { gradesRcMergeStartedAt: number | null }).gradesRcMergeStartedAt =
			Date.now();

		await expect(service.regenerate('gradesRc', 'SOME-OTHER-PERIOD', 'user-1')).rejects.toThrow(
			ConflictError,
		);
		await expect(
			service.regenerate('gradesRc', 'SOME-OTHER-PERIOD', 'user-1'),
		).rejects.toMatchObject({
			messageKey: scrapingExportsValidationStrings.error.alreadyGenerating,
		});
	});
});

describe('ScrapingExportGenerationService gradesRc merge slot self-healing (AF-2)', () => {
	it('treats a gradesRcMergeStartedAt older than GENERATION_STALE_TIMEOUT_MS as not in-flight, unblocking a fresh merge', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();
		(service as unknown as { gradesRcMergeStartedAt: number | null }).gradesRcMergeStartedAt =
			Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000;

		await expect(service.regenerate('gradesRc', PERIOD, 'user-1')).resolves.toMatchObject({
			status: 'running',
		});
	});

	it('still blocks regenerate when the merge slot was set recently', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();
		(service as unknown as { gradesRcMergeStartedAt: number | null }).gradesRcMergeStartedAt =
			Date.now() - 1000;

		await expect(service.regenerate('gradesRc', PERIOD, 'user-1')).rejects.toThrow(ConflictError);
	});
});
