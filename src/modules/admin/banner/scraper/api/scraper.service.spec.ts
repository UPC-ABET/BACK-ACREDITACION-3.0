jest.mock('p-limit', () => ({
	__esModule: true,
	default: () => (fn: () => any) => fn(),
}));

import { ScrapeRunRepository } from '../../raw/core/scrape-run.repository';
import { RawHorarioRepository } from '../../raw/core/raw-horario.repository';
import { RawMatriculaRepository } from '../../raw/core/raw-matricula.repository';
import { RawAlumnoRepository } from '../../raw/core/raw-alumno.repository';
import { RawNotasRepository } from '../../raw/core/raw-notas.repository';
import { DepartmentSourceRepository } from '../core/department-source.repository';
import { BannerHttpClient } from '../core/banner-http.client';
import { SessionExpiredError } from '../../banner-token/model/session-expired.error';
import { ScrapingExportGenerationService } from '../../../scraping-exports/api/scraping-export-generation.service';
import { ScraperService } from './scraper.service';

const PERIODO = '202610';

const mockScrapeRunRepository = {
	createRun: jest.fn(),
	finish: jest.fn(),
	findById: jest.fn(),
	findByPeriodo: jest.fn(),
	deleteRun: jest.fn(),
	deleteOtherRunsForPeriodo: jest.fn(),
};
const mockRawHorarioRepository = { bulkInsert: jest.fn() };
const mockRawMatriculaRepository = { bulkInsert: jest.fn() };
const mockRawAlumnoRepository = { bulkInsert: jest.fn() };
const mockRawNotasRepository = { bulkInsert: jest.fn() };
const mockDepartmentSourceRepository = {
	findAcademicPeriodCode: jest.fn(),
	findActiveDepartmentCodes: jest.fn(),
	findPeriodCourseCodes: jest.fn(),
};
const mockHttp = { get: jest.fn() };
const mockExportGenerationService = { triggerForBannerRun: jest.fn() };

const buildService = () =>
	new ScraperService(
		mockScrapeRunRepository as unknown as ScrapeRunRepository,
		mockRawHorarioRepository as unknown as RawHorarioRepository,
		mockRawMatriculaRepository as unknown as RawMatriculaRepository,
		mockRawAlumnoRepository as unknown as RawAlumnoRepository,
		mockRawNotasRepository as unknown as RawNotasRepository,
		mockDepartmentSourceRepository as unknown as DepartmentSourceRepository,
		mockHttp as unknown as BannerHttpClient,
		mockExportGenerationService as unknown as ScrapingExportGenerationService,
	);

const flush = async () => {
	for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
};

beforeEach(() => {
	jest.clearAllMocks();
	mockScrapeRunRepository.deleteRun.mockResolvedValue(undefined);
	mockScrapeRunRepository.deleteOtherRunsForPeriodo.mockResolvedValue(undefined);
	mockExportGenerationService.triggerForBannerRun.mockResolvedValue(undefined);
});

describe('ScraperService cleanupAfterFinish wiring', () => {
	/**
	 * `cleanupAfterFinish` is exercised directly (as a private method, via `as any`, the same
	 * pattern used elsewhere in this codebase e.g. `users.service.spec.ts`) rather than only
	 * through `run()`/`execute()`. `execute()` unconditionally reaches `scrapeMatricula`'s
	 * `await createLimiter(...)` — a real `await import('p-limit')` — for every outcome except an
	 * immediate `SessionExpiredError` in the horario phase. Under this repo's `module: nodenext`
	 * ts-jest setup that native dynamic import always throws ("invoked without
	 * --experimental-vm-modules"), the same limitation already documented in
	 * `planner-scraper.service.spec.ts`. That makes 'completed' and 'partial' unreachable via a
	 * genuine end-to-end `run()` call in this environment, so those two branches are covered here
	 * directly; 'expired' is additionally covered end-to-end below, since it is reachable (it
	 * short-circuits before `scrapeMatricula` is ever called).
	 */
	it('deletes every other run for the periodo when the run completed', async () => {
		const service = buildService();

		await (service as any).cleanupAfterFinish('completed', PERIODO, 'run-1');

		expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).toHaveBeenCalledWith(
			PERIODO,
			'run-1',
		);
		expect(mockScrapeRunRepository.deleteRun).not.toHaveBeenCalled();
	});

	it('triggers export generation for the periodo when the run completed', async () => {
		const service = buildService();

		await (service as any).cleanupAfterFinish('completed', PERIODO, 'run-1');
		await flush();

		expect(mockExportGenerationService.triggerForBannerRun).toHaveBeenCalledWith(PERIODO);
	});

	it('does not trigger export generation when the run did not complete', async () => {
		const service = buildService();

		await (service as any).cleanupAfterFinish('partial', PERIODO, 'run-1');
		await flush();

		expect(mockExportGenerationService.triggerForBannerRun).not.toHaveBeenCalled();
	});

	it('does not let a rejected export-generation trigger propagate out of cleanupAfterFinish', async () => {
		mockExportGenerationService.triggerForBannerRun.mockRejectedValue(new Error('boom'));
		const service = buildService();

		await expect(
			(service as any).cleanupAfterFinish('completed', PERIODO, 'run-1'),
		).resolves.toBeUndefined();
		await flush();
	});

	it('deletes only its own run when the run finished partial', async () => {
		const service = buildService();

		await (service as any).cleanupAfterFinish('partial', PERIODO, 'run-1');

		expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith('run-1');
		expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).not.toHaveBeenCalled();
	});

	it('deletes only its own run when the run failed', async () => {
		const service = buildService();

		await (service as any).cleanupAfterFinish('failed', PERIODO, 'run-1');

		expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith('run-1');
		expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).not.toHaveBeenCalled();
	});

	it('deletes only its own run when the run expired', async () => {
		const service = buildService();

		await (service as any).cleanupAfterFinish('expired', PERIODO, 'run-1');

		expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith('run-1');
		expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).not.toHaveBeenCalled();
	});
});

describe('ScraperService.execute end-to-end wiring (reachable branch only)', () => {
	beforeEach(() => {
		mockDepartmentSourceRepository.findAcademicPeriodCode.mockResolvedValue(PERIODO);
		mockDepartmentSourceRepository.findActiveDepartmentCodes.mockResolvedValue(['DEPT1']);
		mockDepartmentSourceRepository.findPeriodCourseCodes.mockResolvedValue(['CS101']);
		mockScrapeRunRepository.createRun.mockResolvedValue(undefined);
		mockScrapeRunRepository.finish.mockResolvedValue(undefined);
	});

	// `run()` detaches `execute()` deliberately, so the assertions have to wait for the detached chain.
	const runAndSettle = async (service: ScraperService) => {
		await service.run(1, {}, 'tester');
		for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
	};

	const finishedStatus = () => mockScrapeRunRepository.finish.mock.calls[0]?.[1] as string;

	it('on an expired run (session expired during horario), cleans up only its own run', async () => {
		mockHttp.get.mockRejectedValue(new SessionExpiredError());
		const service = buildService();

		await runAndSettle(service);

		expect(finishedStatus()).toBe('expired');
		const runId = mockScrapeRunRepository.createRun.mock.calls[0][0].id;
		expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith(runId);
		expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).not.toHaveBeenCalled();
	});
});
