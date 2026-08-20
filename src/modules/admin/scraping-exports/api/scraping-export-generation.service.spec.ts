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
	findByPeriodo: jest.fn(),
};
const mockPlannerScrapeRunRepository = {
	findByPeriodo: jest.fn(),
};
const mockExportsService = {
	generateDocentes: jest.fn(),
	generateSecciones: jest.fn(),
	generateAlumnosMatriculados: jest.fn(),
	generateAlumnosSecciones: jest.fn(),
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

// Both trigger paths fire generate() without awaiting it, so tests have to let the microtask
// queue drain before asserting on what it did.
const flush = async () => {
	for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
};

const gradesRcCalls = () =>
	mockRunRepository.upsertByKey.mock.calls.filter(([exportType]) => exportType === 'gradesRc');

beforeEach(() => {
	jest.clearAllMocks();
	mockRunRepository.upsertByKey.mockResolvedValue({});
	mockExportsRepository.findAcademicPeriodIdByCode.mockResolvedValue(5);
	mockExportsService.generateDocentes.mockResolvedValue({
		buffer: Buffer.from('a'),
		fileName: 'Docentes.xlsx',
	});
	mockExportsService.generateSecciones.mockResolvedValue({
		buffer: Buffer.from('a'),
		fileName: 'Secciones.xlsx',
	});
	mockExportsService.generateAlumnosMatriculados.mockResolvedValue({
		buffer: Buffer.from('a'),
		fileName: 'Matriculados.xlsx',
	});
	mockExportsService.generateAlumnosSecciones.mockResolvedValue({
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
		mockPlannerScrapeRunRepository.findByPeriodo.mockResolvedValue([]);
		const service = buildService();

		await service.triggerForBannerRun(PERIODO);
		await flush();

		expect(mockExportsService.generateDocentes).toHaveBeenCalledWith(5, 'es');
		expect(mockExportsService.generateDocentes).toHaveBeenCalledWith(5, 'en');
		expect(mockExportsService.generateSecciones).toHaveBeenCalledTimes(2);
		expect(mockExportsService.generateAlumnosMatriculados).toHaveBeenCalledTimes(2);
		expect(mockExportsService.generateAlumnosSecciones).toHaveBeenCalledTimes(2);
	});

	it('does not trigger gradesRc when no completed Planner run exists for the periodo', async () => {
		mockPlannerScrapeRunRepository.findByPeriodo.mockResolvedValue([{ status: 'running' }]);
		const service = buildService();

		await service.triggerForBannerRun(PERIODO);
		await flush();

		expect(gradesRcCalls().length).toBe(0);
	});

	it('triggers gradesRc when a completed Planner run exists for the periodo', async () => {
		mockPlannerScrapeRunRepository.findByPeriodo.mockResolvedValue([{ status: 'completed' }]);
		const service = buildService();

		await service.triggerForBannerRun(PERIODO);
		await flush();

		expect(gradesRcCalls().length).toBeGreaterThan(0);
	});
});

describe('ScrapingExportGenerationService.triggerForPlannerRun', () => {
	it('triggers gradesRc only when a completed Banner run exists for the periodo', async () => {
		mockScrapeRunRepository.findByPeriodo.mockResolvedValue([{ status: 'completed' }]);
		const service = buildService();

		await service.triggerForPlannerRun(PERIODO);
		await flush();

		expect(gradesRcCalls().length).toBeGreaterThan(0);
	});

	it('does nothing when no completed Banner run exists for the periodo', async () => {
		mockScrapeRunRepository.findByPeriodo.mockResolvedValue([]);
		const service = buildService();

		await service.triggerForPlannerRun(PERIODO);
		await flush();

		expect(mockRunRepository.upsertByKey).not.toHaveBeenCalled();
	});
});

describe('ScrapingExportGenerationService.regenerate', () => {
	it('throws ConflictError when the current row is running and not stale', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'docentes',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.regenerate('docentes', PERIODO, 'es', 'user-1')).rejects.toThrow(
			ConflictError,
		);
		await expect(service.regenerate('docentes', PERIODO, 'es', 'user-1')).rejects.toMatchObject({
			messageKey: scrapingExportsValidationStrings.error.alreadyGenerating,
		});
	});

	it('upserts to running and returns the row when not currently running', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const runningRow = { exportType: 'docentes', periodo: PERIODO, lang: 'es', status: 'running' };
		mockRunRepository.upsertByKey.mockResolvedValueOnce(runningRow);
		const service = buildService();

		const result = await service.regenerate('docentes', PERIODO, 'es', 'user-1');

		expect(result).toEqual(runningRow);
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'docentes',
			PERIODO,
			'es',
			expect.objectContaining({ status: 'running', triggeredBy: 'user-1' }),
		);
	});

	it('reconciles a stale running row first, so a stale generation never blocks a new one', async () => {
		const staleDate = new Date(Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000);
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'docentes',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: staleDate,
		});
		// First upsertByKey call is reconcileIfStale flipping the stale row to 'failed'; the second
		// is regenerate's own transition to 'running' once it sees the row is no longer running.
		mockRunRepository.upsertByKey
			.mockResolvedValueOnce({
				exportType: 'docentes',
				periodo: PERIODO,
				lang: 'es',
				status: 'failed',
				errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
			})
			.mockResolvedValueOnce({
				exportType: 'docentes',
				periodo: PERIODO,
				lang: 'es',
				status: 'running',
				triggeredBy: 'user-1',
			});
		const service = buildService();

		await expect(service.regenerate('docentes', PERIODO, 'es', 'user-1')).resolves.toBeDefined();
	});
});

describe('ScrapingExportGenerationService.getStatus', () => {
	it('returns notGenerated when no row exists', async () => {
		mockRunRepository.findByKey.mockResolvedValue(null);
		const service = buildService();

		await expect(service.getStatus('docentes', PERIODO, 'es')).resolves.toEqual({
			status: 'notGenerated',
		});
	});

	it('returns the row metadata, but never fileBytes, when it is not a stale running row', async () => {
		const row = {
			exportType: 'docentes',
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

		const result = await service.getStatus('docentes', PERIODO, 'es');

		expect(result).toEqual({
			exportType: 'docentes',
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

		await expect(service.download('docentes', PERIODO, 'es')).resolves.toBeNull();
	});

	it('returns null when fileBytes have never been written', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			status: 'completed',
			fileBytes: null,
			fileName: null,
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.download('docentes', PERIODO, 'es')).resolves.toBeNull();
	});

	it('serves the stored bytes even when status is running (stale-while-regenerating)', async () => {
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'docentes',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			fileBytes: Buffer.from('old'),
			fileName: 'Docentes.xlsx',
			updatedAt: new Date(),
		});
		const service = buildService();

		await expect(service.download('docentes', PERIODO, 'es')).resolves.toEqual({
			fileName: 'Docentes.xlsx',
			fileBytes: Buffer.from('old'),
		});
	});
});

describe('ScrapingExportGenerationService reconcileIfStale (exercised through getStatus)', () => {
	it('flips a running row older than the stale timeout to failed', async () => {
		const staleDate = new Date(Date.now() - GENERATION_STALE_TIMEOUT_MS - 1000);
		mockRunRepository.findByKey.mockResolvedValue({
			exportType: 'docentes',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: staleDate,
		});
		mockRunRepository.upsertByKey.mockResolvedValue({
			exportType: 'docentes',
			periodo: PERIODO,
			lang: 'es',
			status: 'failed',
			errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
		});
		const service = buildService();

		const result = await service.getStatus('docentes', PERIODO, 'es');

		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'docentes',
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
			exportType: 'docentes',
			periodo: PERIODO,
			lang: 'es',
			status: 'running',
			updatedAt: recentDate,
		});
		const service = buildService();

		const result = await service.getStatus('docentes', PERIODO, 'es');

		expect(mockRunRepository.upsertByKey).not.toHaveBeenCalled();
		expect((result as { status: string }).status).toBe('running');
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
	it('does not run two gradesRc merges concurrently for different periods; the second becomes a failed row', async () => {
		// Goes through the auto-trigger path (triggerForPlannerRun), not regenerate(): regenerate()
		// has its own pre-check that 409s a caller before ever reaching generate(); this internal
		// guard exists specifically for the auto-trigger path, which has no caller to 409.
		mockRunRepository.findByKey.mockResolvedValue(null);
		mockScrapeRunRepository.findByPeriodo.mockResolvedValue([{ status: 'completed' }]);
		let releaseFirstMerge!: () => void;
		const firstMergeGate = new Promise<void>((resolve) => (releaseFirstMerge = resolve));
		mockExportsService.generateGradesRc.mockImplementationOnce(async () => {
			await firstMergeGate;
			return { buffer: Buffer.from('p1'), fileName: 'NotasRC.xlsx' };
		});
		const service = buildService();

		await service.triggerForPlannerRun('P1');
		// Let the first triggered generate() reach runGradesRcMerge and flip the flag before the
		// second period is triggered, without letting the first merge finish.
		await flush();

		await service.triggerForPlannerRun('P2');
		await flush();

		// The second period's merge must never have been attempted while the first was in flight.
		expect(mockExportsService.generateGradesRc).toHaveBeenCalledTimes(1);
		expect(mockRunRepository.upsertByKey).toHaveBeenCalledWith(
			'gradesRc',
			'P2',
			'es',
			expect.objectContaining({ status: 'failed', errorMessage: expect.any(String) }),
		);

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
		// Simulates the flag being held by an in-flight merge for an unrelated periodo/lang.
		(service as unknown as { gradesRcMergeInFlight: boolean }).gradesRcMergeInFlight = true;

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
