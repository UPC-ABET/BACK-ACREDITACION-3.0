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
import { UserRepository } from 'src/modules/organization/users/core/users.repository';
import { ScraperService } from './scraper.service';

const PERIOD = '202610';

const mockScrapeRunRepository = {
	createRun: jest.fn(),
	finish: jest.fn(),
	findById: jest.fn(),
	findByPeriod: jest.fn(),
	deleteRun: jest.fn(),
	deleteOtherRunsForPeriod: jest.fn(),
	updatePhase: jest.fn(),
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
const mockUserRepository = { findDisplayNamesByIds: jest.fn() };

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
		mockUserRepository as unknown as UserRepository,
	);

const flush = async () => {
	for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
};

beforeEach(() => {
	jest.clearAllMocks();
	mockScrapeRunRepository.deleteRun.mockResolvedValue(undefined);
	mockScrapeRunRepository.deleteOtherRunsForPeriod.mockResolvedValue(undefined);
	mockScrapeRunRepository.updatePhase.mockResolvedValue(undefined);
	mockExportGenerationService.triggerForBannerRun.mockResolvedValue(undefined);
	mockUserRepository.findDisplayNamesByIds.mockResolvedValue(new Map());
});

describe('ScraperService finalizeRun wiring', () => {
	/**
	 * `finalizeRun` is exercised directly (as a private method, via `as any`, the same pattern
	 * used elsewhere in this codebase e.g. `users.service.spec.ts`) rather than only through
	 * `run()`/`execute()`. `execute()` unconditionally reaches `scrapeMatricula`'s
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

		await (service as any).finalizeRun('run-1', PERIOD, 'completed', {});

		expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).toHaveBeenCalledWith(PERIOD, 'run-1');
		expect(mockScrapeRunRepository.deleteRun).not.toHaveBeenCalled();
	});

	it('triggers export generation for the periodo with the completed run id', async () => {
		const service = buildService();

		await (service as any).finalizeRun('run-1', PERIOD, 'completed', {});
		await flush();

		expect(mockExportGenerationService.triggerForBannerRun).toHaveBeenCalledWith(PERIOD, 'run-1');
	});

	it('does not trigger export generation when the run did not complete', async () => {
		const service = buildService();

		await (service as any).finalizeRun('run-1', PERIOD, 'partial', {});
		await flush();

		expect(mockExportGenerationService.triggerForBannerRun).not.toHaveBeenCalled();
	});

	it('does not let a rejected export-generation trigger propagate out of finalizeRun', async () => {
		mockExportGenerationService.triggerForBannerRun.mockRejectedValue(new Error('boom'));
		const service = buildService();

		await expect(
			(service as any).finalizeRun('run-1', PERIOD, 'completed', {}),
		).resolves.toBeUndefined();
		await flush();
	});

	it('deletes only its own run when the run finished partial', async () => {
		const service = buildService();

		await (service as any).finalizeRun('run-1', PERIOD, 'partial', {});

		expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith('run-1');
		expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).not.toHaveBeenCalled();
	});

	it('deletes only its own run when the run failed', async () => {
		const service = buildService();

		await (service as any).finalizeRun('run-1', PERIOD, 'failed', {});

		expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith('run-1');
		expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).not.toHaveBeenCalled();
	});

	it('deletes only its own run when the run expired', async () => {
		const service = buildService();

		await (service as any).finalizeRun('run-1', PERIOD, 'expired', {});

		expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith('run-1');
		expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).not.toHaveBeenCalled();
	});

	// Regression test for AF-5: a transient retention-delete failure must not propagate out of
	// finalizeRun (and, by extension, out of execute()), unlike finish()'s own failure which is
	// deliberately left uncaught.
	it('logs and swallows a retention-delete failure instead of propagating it', async () => {
		mockScrapeRunRepository.deleteOtherRunsForPeriod.mockRejectedValue(new Error('db down'));
		const service = buildService();

		await expect(
			(service as any).finalizeRun('run-1', PERIOD, 'completed', {}),
		).resolves.toBeUndefined();
		expect(mockScrapeRunRepository.finish).toHaveBeenCalledWith('run-1', 'completed', {});
	});
});

describe('ScraperService.execute end-to-end wiring (reachable branch only)', () => {
	beforeEach(() => {
		mockDepartmentSourceRepository.findAcademicPeriodCode.mockResolvedValue(PERIOD);
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

	/**
	 * `scrapeHorario` now also takes a `p-limit`-created limiter (see AC-4), so it is no longer
	 * reachable end-to-end here without hitting the same `module: nodenext` dynamic-import
	 * limitation this file already documents above (`await import('p-limit')` throws under jest
	 * regardless of what's mocked). `SessionExpiredError` is injected by stubbing `scrapeHorario`
	 * itself instead of via `mockHttp.get`, so `execute()`'s own try/catch classification is still
	 * exercised for real, just without depending on `scrapeHorario`'s internals (including its
	 * limiter) actually running.
	 */
	it('on an expired run (session expired during horario), cleans up only its own run', async () => {
		const service = buildService();
		jest.spyOn(service as any, 'scrapeHorario').mockRejectedValue(new SessionExpiredError());

		await runAndSettle(service);

		expect(finishedStatus()).toBe('expired');
		const runId = mockScrapeRunRepository.createRun.mock.calls[0][0].id;
		expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith(runId);
		expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).not.toHaveBeenCalled();
	});

	it('updates phase to schedule before the horario stage runs', async () => {
		const service = buildService();
		jest.spyOn(service as any, 'scrapeHorario').mockRejectedValue(new SessionExpiredError());

		await runAndSettle(service);

		const runId = mockScrapeRunRepository.createRun.mock.calls[0][0].id;
		expect(mockScrapeRunRepository.updatePhase).toHaveBeenCalledWith(runId, 'schedule');
	});
});

/**
 * `scrapeHorario`/`scrapeMatricula`/`scrapeAlumnos`/`scrapeNotas` are stubbed via spies here so
 * `execute()`'s phase-update call sites can be asserted in order without depending on
 * `createLimiter()`'s real `await import('p-limit')`, which is unusable under this file's
 * `module: nodenext` ts-jest setup (see the top-of-file comment). `execute()` itself still calls
 * `createLimiter(SCRAPE_CONCURRENCY)` directly between the matricula and alumnos/notas stages, so
 * even with every phase method stubbed, that call throws and is caught by `execute()`'s own
 * try/catch (recorded as a 'failed' finish, not asserted on here — that outcome is an artifact of
 * this jest limitation, not a phase-tracking behavior worth pinning to a test).
 */
describe('ScraperService.execute phase tracking', () => {
	beforeEach(() => {
		mockScrapeRunRepository.finish.mockResolvedValue(undefined);
		mockScrapeRunRepository.deleteRun.mockResolvedValue(undefined);
		mockScrapeRunRepository.deleteOtherRunsForPeriod.mockResolvedValue(undefined);
	});

	it('updates phase before each stage, in order', async () => {
		const service = buildService();
		jest
			.spyOn(service as any, 'scrapeHorario')
			.mockResolvedValue({ nrcs: [], courseByNrc: new Map() });
		jest
			.spyOn(service as any, 'scrapeMatricula')
			.mockResolvedValue({ studentCodes: [], enrollments: [] });

		await (service as any).execute('run-1', 'UG', PERIOD, ['DEPT1'], new Set(['CS101']));

		expect(mockScrapeRunRepository.updatePhase).toHaveBeenNthCalledWith(1, 'run-1', 'schedule');
		expect(mockScrapeRunRepository.updatePhase).toHaveBeenNthCalledWith(2, 'run-1', 'enrollment');
		expect(mockScrapeRunRepository.updatePhase).toHaveBeenNthCalledWith(
			3,
			'run-1',
			'studentsAndGrades',
		);
	});
});

describe('ScraperService.scrapeHorario concurrency', () => {
	const STATS = () => ({
		departments: { requested: ['DEPT_SLOW', 'DEPT_FAST', 'DEPT_BAD'], succeeded: [], failed: [] },
		counts: { horario: 0, matricula: 0, alumno: 0, nota: 0 },
		uniqueStudents: 0,
		errors: [] as Array<{ step: string; key: string; message: string }>,
	});

	// A department is not blocked behind another still-in-flight department, and one department's
	// plain (non-SessionExpiredError) failure does not abort the others. This is the regression test
	// for AC-4: under the old sequential for-of loop, DEPT_FAST/DEPT_BAD could never settle while
	// DEPT_SLOW's request was still pending, since the loop awaited each department in turn.
	it('processes departments independently: out-of-order resolution and isolated per-department failure', async () => {
		const service = buildService();
		const stats = STATS();

		let resolveSlow!: (value: { detalle: unknown[] }) => void;
		const slowPromise = new Promise<{ detalle: unknown[] }>((resolve) => {
			resolveSlow = resolve;
		});

		mockHttp.get.mockImplementation((_path: string, query: Record<string, string>) => {
			if (query.codigoDepartamento === 'DEPT_SLOW') return slowPromise;
			if (query.codigoDepartamento === 'DEPT_FAST') return Promise.resolve({ detalle: [] });
			return Promise.reject(new Error('upstream 500'));
		});

		// Real `scrapeHorario` runs; only its limiter creation (a real `await import('p-limit')`,
		// unusable under jest here) is stubbed with a synchronous passthrough.
		jest
			.spyOn(service as any, 'createHorarioLimit')
			.mockResolvedValue((fn: () => Promise<unknown>) => fn());

		const resultPromise = (service as any).scrapeHorario(
			'run-1',
			'UG',
			PERIOD,
			['DEPT_SLOW', 'DEPT_FAST', 'DEPT_BAD'],
			new Set(['CS101']),
			stats,
		);

		await flush();
		expect(stats.departments.succeeded).toContain('DEPT_FAST');
		expect(stats.departments.failed).toContain('DEPT_BAD');
		expect(stats.departments.succeeded).not.toContain('DEPT_SLOW');

		resolveSlow({ detalle: [] });
		await resultPromise;

		expect(stats.departments.succeeded).toEqual(expect.arrayContaining(['DEPT_FAST', 'DEPT_SLOW']));
		expect(stats.departments.failed).toEqual(['DEPT_BAD']);
	});

	// Regression for AF-3: the pre-parallelization sequential `scrapeHorario` let a real
	// `SessionExpiredError` propagate straight out (the department loop's own `throw error`).
	// Parallelizing it must preserve that — a fatal session error is not a per-department fault
	// and must not be swallowed into `stats.departments.failed` like `DEPT_BAD`'s ordinary error
	// above. This exercises the real `scrapeHorario`/limiter/scheduling logic, only stubbing
	// `createHorarioLimit()` past the `p-limit` dynamic import that's unusable under jest here.
	it('propagates a real SessionExpiredError out of the parallelized department loop', async () => {
		const service = buildService();
		const stats = STATS();

		mockHttp.get.mockImplementation((_path: string, query: Record<string, string>) => {
			if (query.codigoDepartamento === 'DEPT_BAD') return Promise.reject(new SessionExpiredError());
			return Promise.resolve({ detalle: [] });
		});

		jest
			.spyOn(service as any, 'createHorarioLimit')
			.mockResolvedValue((fn: () => Promise<unknown>) => fn());

		await expect(
			(service as any).scrapeHorario(
				'run-1',
				'UG',
				PERIOD,
				['DEPT_SLOW', 'DEPT_FAST', 'DEPT_BAD'],
				new Set(['CS101']),
				stats,
			),
		).rejects.toBeInstanceOf(SessionExpiredError);

		expect(stats.departments.failed).not.toContain('DEPT_BAD');
	});
});

describe('ScraperService.getRun', () => {
	it('includes phase in the returned run status', async () => {
		mockScrapeRunRepository.findById.mockResolvedValue({
			status: 'running',
			phase: 'enrollment',
			stats: null,
		});
		const service = buildService();

		const result = await service.getRun('run-1');

		expect(result).toEqual({ status: 'running', phase: 'enrollment', stats: null });
	});
});

describe('ScraperService.listRuns', () => {
	const buildRun = (overrides: Partial<Record<string, unknown>> = {}) => ({
		id: 'run-1',
		level: 'UG',
		period: PERIOD,
		departments: ['DEPT1'],
		status: 'running',
		phase: 'schedule',
		startedAt: new Date('2026-08-20T10:00:00.000Z'),
		finishedAt: null,
		stats: null,
		triggeredBy: 'user:1',
		...overrides,
	});

	beforeEach(() => {
		mockDepartmentSourceRepository.findAcademicPeriodCode.mockResolvedValue(PERIOD);
	});

	it('includes phase in each run summary', async () => {
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([buildRun()]);
		const service = buildService();

		const [summary] = await service.listRuns(1);

		expect(summary.phase).toBe('schedule');
	});

	it('resolves triggeredBy to the display name looked up by id', async () => {
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([buildRun({ triggeredBy: 'user:12' })]);
		mockUserRepository.findDisplayNamesByIds.mockResolvedValue(new Map([[12, 'Jane Doe']]));
		const service = buildService();

		const [summary] = await service.listRuns(1);

		expect(mockUserRepository.findDisplayNamesByIds).toHaveBeenCalledWith([12]);
		expect(summary.triggeredByName).toBe('Jane Doe');
	});

	it('falls back to "-" when the triggering user no longer exists', async () => {
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([
			buildRun({ triggeredBy: 'user:999999' }),
		]);
		mockUserRepository.findDisplayNamesByIds.mockResolvedValue(new Map());
		const service = buildService();

		const [summary] = await service.listRuns(1);

		expect(summary.triggeredByName).toBe('-');
	});

	it('falls back to "-" when triggeredBy is null, without calling the user lookup', async () => {
		mockScrapeRunRepository.findByPeriod.mockResolvedValue([buildRun({ triggeredBy: null })]);
		const service = buildService();

		const [summary] = await service.listRuns(1);

		expect(summary.triggeredByName).toBe('-');
		expect(mockUserRepository.findDisplayNamesByIds).not.toHaveBeenCalled();
	});
});
