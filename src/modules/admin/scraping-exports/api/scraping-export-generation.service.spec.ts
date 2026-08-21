import { ConflictError } from 'src/commons/domain-error';

import { ScrapeRunRepository } from '../../banner/raw/core/scrape-run.repository';
import { PlannerScrapeRunRepository } from '../../planner/raw/core/planner-scrape-run.repository';
import { ScrapingExportRunRepository } from '../core/scraping-export-run.repository';
import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';
import { ScrapingExportsService } from './scraping-exports.service';
import {
	GENERATION_STALE_TIMEOUT_MS,
	ScrapingExportGenerationService,
} from './scraping-export-generation.service';

const PERIODO = '202610';

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
	generateStaff: jest.fn(),
	generateSections: jest.fn(),
	generateEnrolledStudents: jest.fn(),
	generateStudentSections: jest.fn(),
	generateGradesRc: jest.fn(),
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

const gradesRcCalls = () =>
	mockRunRepository.upsertByKey.mock.calls.filter(([exportType]) => exportType === 'gradesRc');

const upsertCallsFor = (exportType: string, periodo: string) =>
	mockRunRepository.upsertByKey.mock.calls.filter(
		([callExportType, callPeriodo]) => callExportType === exportType && callPeriodo === periodo,
	);

// Reaches the private fire-and-forget entry point the two auto-trigger call sites use, so a
// single key's duplicate-trigger scenario can be exercised without going through the full
// 8-way triggerForBannerRun fan-out.
const callFireAndForgetGenerate = (
	service: ScrapingExportGenerationService,
	...args: unknown[]
): void => {
	(
		service as unknown as { fireAndForgetGenerate: (...callArgs: unknown[]) => void }
	).fireAndForgetGenerate(...args);
};

beforeEach(() => {
	jest.clearAllMocks();
	mockRunRepository.upsertByKey.mockResolvedValue({});
	mockExportsRepository.findAcademicPeriodIdByCode.mockResolvedValue(5);
	mockScrapeRunRepository.findByPeriod.mockResolvedValue([]);
	mockPlannerScrapeRunRepository.findByPeriod.mockResolvedValue([]);
	mockExportsService.generateStaff.mockResolvedValue({
		buffer: Buffer.from('a'),
		fileName: 'Docentes.xlsx',
	});
	mockExportsService.generateSections.mockResolvedValue({
		buffer: Buffer.from('a'),
		fileName: 'Secciones.xlsx',
	});
	mockExportsService.generateEnrolledStudents.mockResolvedValue({
		buffer: Buffer.from('a'),
		fileName: 'Matriculados.xlsx',
	});
	mockExportsService.generateStudentSections.mockResolvedValue({
		buffer: Buffer.from('a'),
		fileName: 'AlumnoSeccion.xlsx',
	});
	mockExportsService.generateGradesRc.mockResolvedValue({
		buffer: Buffer.from('rc'),
		fileName: 'NotasRC.xlsx',
	});
});

describe('ScrapingExportGenerationService.triggerForBannerRun', () => {
	it('generates all four Banner exports for every supported lang', async () => {
		const service = buildService();

		await service.triggerForBannerRun(PERIODO, 'banner-run-1');
		await flush();

		expect(mockExportsService.generateStaff).toHaveBeenCalledWith(5, 'es');
		expect(mockExportsService.generateStaff).toHaveBeenCalledWith(5, 'en');
		expect(mockExportsService.generateSections).toHaveBeenCalledTimes(2);
		expect(mockExportsService.generateEnrolledStudents).toHaveBeenCalledTimes(2);
		expect(mockExportsService.generateStudentSections).toHaveBeenCalledTimes(2);
	});

	it('does not trigger gradesRc when no completed Planner run exists for the periodo', async () => {
		mockPlannerScrapeRunRepository.findByPeriod.mockResolvedValue([{ status: 'running' }]);
		const service = buildService();

		await service.triggerForBannerRun(PERIODO, 'banner-run-1');
		await flush();

		expect(gradesRcCalls().length).toBe(0);
	});

	it('triggers gradesRc when a completed Planner run exists for the periodo', async () => {
		mockPlannerScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'planner-run-1' },
		]);
		const service = buildService();

		await service.triggerForBannerRun(PERIODO, 'banner-run-1');
		await flush();

		expect(gradesRcCalls().length).toBeGreaterThan(0);
	});
});

describe('ScrapingExportGenerationService.triggerForPlannerRun', () => {
	it('triggers gradesRc only when a completed Banner run exists for the periodo', async () => {
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([
			{ status: 'completed', id: 'banner-run-1' },
		]);
		const service = buildService();

		await service.triggerForPlannerRun(PERIODO, 'planner-run-1');
		await flush();

		expect(gradesRcCalls().length).toBeGreaterThan(0);
	});

	it('does nothing when no completed Banner run exists for the periodo', async () => {
		const service = buildService();

		await service.triggerForPlannerRun(PERIODO, 'planner-run-1');
		await flush();

		expect(mockRunRepository.upsertByKey).not.toHaveBeenCalled();
	});
});

describe('ScrapingExportGenerationService AF-1 Banner period-not-found guard', () => {
	it('fails loud instead of generating with a null academicPeriodId for a Banner export type', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockExportsRepository.findAcademicPeriodIdByCode.mockResolvedValue(null);
		const service = buildService();

		await service.regenerate('staff', PERIODO, 'es', 'user-1');
		await flush();

		expect(mockExportsService.generateStaff).not.toHaveBeenCalled();
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIODO,
			'es',
			expect.objectContaining({ status: 'failed', errorMessage: expect.any(String) }),
		);
	});
});

describe('ScrapingExportGenerationService AF-3 source run id wiring', () => {
	it('writes sourceBannerRunId on the four Banner exports triggered from a Banner run', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await service.triggerForBannerRun(PERIODO, 'banner-run-1');
		await flush();

		for (const exportType of ['staff', 'sections', 'enrolledStudents', 'studentSections']) {
			expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
				exportType,
				PERIODO,
				'es',
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

		await service.triggerForBannerRun(PERIODO, 'banner-run-1');
		await flush();

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIODO,
			'es',
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

		await service.triggerForPlannerRun(PERIODO, 'planner-run-1');
		await flush();

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIODO,
			'es',
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

		await service.regenerate('gradesRc', PERIODO, 'es', 'user-1');

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIODO,
			'es',
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
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: new Date(),
		});
		let releaseFirstGeneration!: () => void;
		const gate = new Promise<void>((resolve) => (releaseFirstGeneration = resolve));
		mockExportsService.generateStaff.mockImplementationOnce(async () => {
			await gate;
			return { buffer: Buffer.from('a'), fileName: 'Docentes.xlsx' };
		});
		const service = buildService();

		callFireAndForgetGenerate(service, 'staff', PERIODO, 'es');
		await flush();
		callFireAndForgetGenerate(service, 'staff', PERIODO, 'es');
		await flush();

		expect(mockExportsService.generateStaff).toHaveBeenCalledTimes(1);

		releaseFirstGeneration();
		await flush();
	});
});

describe('ScrapingExportGenerationService.regenerate', () => {
	it('throws ConflictError when the current row is running and not stale', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.regenerate('staff', PERIODO, 'es', 'user-1')).rejects.toThrow(
			ConflictError,
		);
		await expect(service.regenerate('staff', PERIODO, 'es', 'user-1')).rejects.toMatchObject({
			messageKey: scrapingExportsValidationStrings.error.alreadyGenerating,
		});
	});

	it('upserts to running and returns the row when not currently running', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const runningRow = { exportType: 'staff', periodo: PERIODO, lang: 'es', status: 'running' };
		mockRunRepository.upsertByKey.mockResolvedValueOnce(runningRow);
		const service = buildService();

		const result = await service.regenerate('staff', PERIODO, 'es', 'user-1');

		expect(result).toEqual(runningRow);
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIODO,
			'es',
			expect.objectContaining({ status: 'running', triggeredBy: 'user-1' }),
		);
	});

	it('calls upsertByKey to running exactly once per successful claim (AF-8)', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await service.regenerate('staff', PERIODO, 'es', 'user-1');

		const runningCalls = mockRunRepository.upsertByKey.mock.calls.filter(
			([, , , patch]) => (patch as { status?: string }).status === 'running',
		);
		expect(runningCalls.length).toBe(1);
	});

	it('reconciles a stale running row first, so a stale generation never blocks a new one', async () => {
		const staleDate = new Date(Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000);
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: staleDate,
		});
		// First upsertByKey call is reconcileIfStale flipping the stale row to 'failed'; the second
		// is the claim's own transition to 'running' once it sees the row is no longer running.
		mockRunRepository.upsertByKey
			.mockResolvedValueOnce({
				exportType: 'staff',
				periodo: PERIODO,
				lang: 'es',
				status: 'failed',
				errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
			})
			.mockResolvedValueOnce({
				exportType: 'staff',
				periodo: PERIODO,
				lang: 'es',
				status: 'running',
				triggeredBy: 'user-1',
			});
		const service = buildService();

		// `toStatusResponse` never includes `triggeredBy` (see ScrapingExportStatusResponse's own
		// comment on why fileBytes/internal-only fields never leak into it), so the response is
		// checked for the transitioned status, and the claim's own upsert call is checked directly
		// for triggeredBy plus the exact call count (once to reconcile-and-fail, once to claim).
		await expect(service.regenerate('staff', PERIODO, 'es', 'user-1')).resolves.toMatchObject({
			status: 'running',
		});
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledTimes(2);
		expect(mockRunRepository.upsertByKey).toHaveBeenNthCalledWith(
			2,
			'staff',
			PERIODO,
			'es',
			expect.objectContaining({ status: 'running', triggeredBy: 'user-1' }),
		);
	});
});

describe('ScrapingExportGenerationService.getStatus', () => {
	it('returns notGenerated when no row exists', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await expect(service.getStatus('staff', PERIODO, 'es')).resolves.toEqual({
			status: 'notGenerated',
		});
	});

	it('returns the row metadata, but never fileBytes, when it is not a stale running row', async () => {
		const row = {
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'completed',
			fileName: 'Docentes.xlsx',
			fileBytes: Buffer.from('should not leak into the status response'),
			errorMessage: null,
			startedAt: new Date('2026-08-20T09:00:00Z'),
			finishedAt: new Date('2026-08-20T09:05:00Z'),
			updatedAt: new Date(),
		};
		mockRunRepository.findByKey.mockResolvedValue(row);
		const service = buildService();

		const result = await service.getStatus('staff', PERIODO, 'es');

		expect(result).toEqual({
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'completed',
			fileName: 'Docentes.xlsx',
			errorMessage: null,
			startedAt: row.startedAt,
			finishedAt: row.finishedAt,
		});
		expect(result).not.toHaveProperty('fileBytes');
	});
});

describe('ScrapingExportGenerationService.download', () => {
	it('returns null when no row exists', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await expect(service.download('staff', PERIODO, 'es')).resolves.toBeNull();
	});

	it('returns null when fileBytes have never been written', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			status: 'completed',
			fileBytes: null,
			fileName: null,
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.download('staff', PERIODO, 'es')).resolves.toBeNull();
	});

	it('serves the stored bytes even when status is running (stale-while-regenerating)', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			fileBytes: Buffer.from('old'),
			fileName: 'Docentes.xlsx',
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.download('staff', PERIODO, 'es')).resolves.toEqual({
			fileName: 'Docentes.xlsx',
			fileBytes: Buffer.from('old'),
		});
	});
});

describe('ScrapingExportGenerationService reconcileIfStale (exercised through getStatus)', () => {
	it('flips a running row older than the stale timeout to failed', async () => {
		const staleDate = new Date(Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000);
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: staleDate,
		});
		mockRunRepository.upsertByKey.mockResolvedValue({
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'failed',
			errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIODO, 'es');

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIODO,
			'es',
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
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: recentDate,
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIODO, 'es');

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
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt,
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIODO, 'es');

		expect(mockRunRepository.upsertByKey).not.toHaveBeenCalled();
		expect((result as { status: string }).status).toBe('running');
	});

	it('flips a running row exactly GENERATION_STALE_TIMEOUT_MS old to failed', async () => {
		jest.useFakeTimers({ now: FIXED_NOW });
		const updatedAt = new Date(FIXED_NOW - GENERATION_STALE_TIMEOUT_MS);
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt,
		});
		mockRunRepository.upsertByKey.mockResolvedValue({
			exportType: 'staff',
			periodo: PERIODO,
			lang: 'es',
			status: 'failed',
			errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
		});
		const service = buildService();

		const result = await service.getStatus('staff', PERIODO, 'es');

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'staff',
			PERIODO,
			'es',
			expect.objectContaining({ status: 'failed' }),
		);
		expect((result as { status: string }).status).toBe('failed');
	});
});

describe('ScrapingExportGenerationService gradesRc generation (Milestone 6)', () => {
	it('generates gradesRc via ScrapingExportsService.generateGradesRc and stores the result', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await service.regenerate('gradesRc', PERIODO, 'es', 'user-1');
		await flush();

		expect(mockExportsService.generateGradesRc).toHaveBeenCalledWith(5, 'es');
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIODO,
			'es',
			expect.objectContaining({
				status: 'completed',
				fileName: 'NotasRC.xlsx',
				fileBytes: Buffer.from('rc'),
			}),
		);
	});

	it('sets status failed with an errorMessage, not an unhandled rejection, when the merge fails', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockExportsService.generateGradesRc.mockRejectedValue(new Error('merge blew up'));
		const service = buildService();

		await expect(service.regenerate('gradesRc', PERIODO, 'es', 'user-1')).resolves.toBeDefined();
		await flush();

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			PERIODO,
			'es',
			expect.objectContaining({ status: 'failed', errorMessage: expect.any(String) }),
		);
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
		mockExportsService.generateGradesRc.mockImplementationOnce(async () => {
			await firstMergeGate;
			return { buffer: Buffer.from('p1'), fileName: 'NotasRC.xlsx' };
		});
		const service = buildService();

		await service.triggerForPlannerRun('P1', 'planner-run-1');
		// Let the first triggered generation reach runGradesRcMerge and flip the flag before the
		// second period is triggered, without letting the first merge finish.
		await flush();

		await service.triggerForPlannerRun('P2', 'planner-run-2');
		await flush();

		// The second period's merge must never have been attempted while the first was in flight,
		// and — unlike before the AF-6 fix — no row is written for it at all (it never gets past
		// the claim, so there is nothing "failed" to mislead a reader into thinking it ran).
		expect(mockExportsService.generateGradesRc).toHaveBeenCalledTimes(1);
		expect(upsertCallsFor('gradesRc', 'P2')).toHaveLength(0);

		releaseFirstMerge();
		await flush();
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			'P1',
			'es',
			expect.objectContaining({ status: 'completed' }),
		);
	});

	it('regenerate throws ConflictError when the gradesRc merge slot is held, even for a different periodo/lang', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();
		// Simulates the slot being held by an in-flight merge for an unrelated periodo/lang.
		(service as unknown as { gradesRcMergeStartedAt: number | null }).gradesRcMergeStartedAt =
			Date.now();

		await expect(
			service.regenerate('gradesRc', 'SOME-OTHER-PERIOD', 'en', 'user-1'),
		).rejects.toThrow(ConflictError);
		await expect(
			service.regenerate('gradesRc', 'SOME-OTHER-PERIOD', 'en', 'user-1'),
		).rejects.toMatchObject({
			messageKey: scrapingExportsValidationStrings.error.alreadyGenerating,
		});
	});
});

describe('ScrapingExportGenerationService gradesRc merge slot self-healing (AF-2)', () => {
	it('treats a gradesRcMergeStartedAt older than GENERATION_STALE_TIMEOUT_MS as not in-flight, unblocking a fresh merge', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockRunRepository.upsertByKey.mockResolvedValue({
			exportType: 'gradesRc',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
		});
		const service = buildService();
		(service as unknown as { gradesRcMergeStartedAt: number | null }).gradesRcMergeStartedAt =
			Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000;

		await expect(service.regenerate('gradesRc', PERIODO, 'es', 'user-1')).resolves.toMatchObject({
			status: 'running',
		});
	});

	it('still blocks regenerate when the merge slot was set recently', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();
		(service as unknown as { gradesRcMergeStartedAt: number | null }).gradesRcMergeStartedAt =
			Date.now() - 1000;

		await expect(service.regenerate('gradesRc', PERIODO, 'es', 'user-1')).rejects.toThrow(
			ConflictError,
		);
	});
});
