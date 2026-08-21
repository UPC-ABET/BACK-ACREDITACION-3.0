import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { PlannerScrapeRunRepository } from '../../raw/core/planner-scrape-run.repository';
import { RawPlannerSeccionRepository } from '../../raw/core/raw-planner-seccion.repository';
import { RawPlannerEvaluacionRepository } from '../../raw/core/raw-planner-evaluacion.repository';
import { RawPlannerNotaRepository } from '../../raw/core/raw-planner-nota.repository';
import { PlannerSourceRepository } from '../core/planner-source.repository';
import { PlannerHttpClient } from '../core/planner-http.client';
import {
	PlannerLoginRejectedError,
	PlannerLoginUnreachableError,
	PlannerSessionExpiredError,
} from '../../planner-token/model/planner-session.errors';
import { ScrapingExportGenerationService } from '../../../scraping-exports/api/scraping-export-generation.service';
import { UserRepository } from 'src/modules/organization/users/core/users.repository';
import { isFatalScrapeError, PlannerScraperService } from './planner-scraper.service';

const PERIOD = '202510';

const mockScrapeRunRepository = {
	createRun: jest.fn(),
	finish: jest.fn(),
	findById: jest.fn(),
	findByPeriod: jest.fn(),
	deleteRun: jest.fn(),
	deleteOtherRunsForPeriod: jest.fn(),
	updatePhase: jest.fn(),
};
const mockSeccionRepository = { bulkInsert: jest.fn() };
const mockEvaluacionRepository = { bulkInsert: jest.fn() };
const mockNotaRepository = { bulkInsert: jest.fn() };
const mockSourceRepository = {
	findAcademicPeriodCode: jest.fn(),
	findActiveCourseCodes: jest.fn(),
};
const mockHttp = { get: jest.fn() };
const mockExportGenerationService = { triggerForPlannerRun: jest.fn() };
const mockUserRepository = { findDisplayNamesByIds: jest.fn() };

const buildService = () =>
	new PlannerScraperService(
		mockScrapeRunRepository as unknown as PlannerScrapeRunRepository,
		mockSeccionRepository as unknown as RawPlannerSeccionRepository,
		mockEvaluacionRepository as unknown as RawPlannerEvaluacionRepository,
		mockNotaRepository as unknown as RawPlannerNotaRepository,
		mockSourceRepository as unknown as PlannerSourceRepository,
		mockHttp as unknown as PlannerHttpClient,
		mockExportGenerationService as unknown as ScrapingExportGenerationService,
		mockUserRepository as unknown as UserRepository,
	);

const flush = async () => {
	for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
};

// `run()` detaches `execute()` deliberately, so the assertions have to wait for the detached chain.
const runAndSettle = async (service: PlannerScraperService) => {
	await service.run(1, {}, 'tester');
	for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
};

const finishedStatus = () => mockScrapeRunRepository.finish.mock.calls[0]?.[1] as string;

describe('PlannerScraperService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockSourceRepository.findAcademicPeriodCode.mockResolvedValue(PERIOD);
		mockSourceRepository.findActiveCourseCodes.mockResolvedValue(['CS101']);
		mockScrapeRunRepository.createRun.mockResolvedValue(undefined);
		mockScrapeRunRepository.finish.mockResolvedValue(undefined);
		mockScrapeRunRepository.deleteRun.mockResolvedValue(undefined);
		mockScrapeRunRepository.deleteOtherRunsForPeriod.mockResolvedValue(undefined);
		mockScrapeRunRepository.updatePhase.mockResolvedValue(undefined);
		mockExportGenerationService.triggerForPlannerRun.mockResolvedValue(undefined);
		mockUserRepository.findDisplayNamesByIds.mockResolvedValue(new Map());
		mockHttp.get.mockResolvedValue([]);
	});

	/**
	 * The predicate the three per-item catches use to decide "abort the run" versus "record this
	 * course and continue". Each phase loop tolerates a per-course fault, which is right for a
	 * missing or malformed course and wrong for anything meaning no session can be obtained:
	 * `PlannerHttpClient` asks for a session on every request and that path has no cooldown, so
	 * continuing turns one outage into one institutional login attempt per remaining item and
	 * reports the result as `partial`.
	 *
	 * Detaching `PlannerLoginUnreachableError` from `PlannerSessionExpiredError` silently changed
	 * every site that had spelled this out as a bare `instanceof`, which is why it is a named
	 * predicate with its own test rather than an expression repeated three times.
	 */
	describe('isFatalScrapeError', () => {
		it.each([
			['an unreachable u-planner', new PlannerLoginUnreachableError('ECONNREFUSED')],
			['a refused login', new PlannerLoginRejectedError('401')],
			['an expired session', new PlannerSessionExpiredError()],
			[
				'a credential that will not decrypt',
				new ServiceUnavailableException('error.scraperCredential.decryptionFailed'),
			],
		])('aborts the run on %s', (_label, error) => {
			expect(isFatalScrapeError(error)).toBe(true);
		});

		it.each([
			['an ordinary upstream fault', new Error('502 from Planner')],
			['a bad request for one course', new HttpException('nope', 400)],
			['a non-error value', 'something threw a string'],
		])('records %s against the course and continues', (_label, error) => {
			expect(isFatalScrapeError(error)).toBe(false);
		});
	});

	/**
	 * Reached through phase 0, which resolves the academic period before any phase takes a
	 * concurrency limiter. That matters: `p-limit` is ESM and the service reaches it through a
	 * dynamic `import()` that jest cannot evaluate under `module: nodenext`, so every later phase is
	 * unreachable here. The per-course abort itself is therefore covered by the predicate above
	 * rather than end to end — recorded as a known gap in tasks.md, not an oversight.
	 */
	describe('run classification', () => {
		it('records an unreachable u-planner as failed, not as an expired session', async () => {
			mockHttp.get.mockRejectedValue(new PlannerLoginUnreachableError('ECONNREFUSED'));

			await runAndSettle(buildService());

			// `expired` would send the operator to re-enter credentials that were never wrong.
			expect(finishedStatus()).toBe('failed');
		});

		it('records a refused login as expired', async () => {
			mockHttp.get.mockRejectedValue(new PlannerLoginRejectedError('401'));

			await runAndSettle(buildService());

			expect(finishedStatus()).toBe('expired');
		});

		it('records an undecryptable credential as failed', async () => {
			mockHttp.get.mockRejectedValue(new ServiceUnavailableException('decryptionFailed'));

			await runAndSettle(buildService());

			expect(finishedStatus()).toBe('failed');
		});

		/**
		 * Retention cleanup rides along the same catch branch that already reaches `finish()` in
		 * these tests. Phases past resolving the period id are unreachable under jest (see the
		 * `p-limit dynamic import` note above), so the `completed`/`partial` branch is covered at
		 * the `finalizeRun` unit level instead, below.
		 */
		it('deletes only its own leftovers when a run fails end-to-end', async () => {
			mockHttp.get.mockRejectedValue(new PlannerLoginUnreachableError('ECONNREFUSED'));

			await runAndSettle(buildService());

			const runId = mockScrapeRunRepository.finish.mock.calls[0]?.[0] as string;
			expect(finishedStatus()).toBe('failed');
			expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith(runId);
			expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).not.toHaveBeenCalled();
		});

		it('deletes only its own leftovers when a run expires end-to-end', async () => {
			mockHttp.get.mockRejectedValue(new PlannerLoginRejectedError('401'));

			await runAndSettle(buildService());

			const runId = mockScrapeRunRepository.finish.mock.calls[0]?.[0] as string;
			expect(finishedStatus()).toBe('expired');
			expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith(runId);
			expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).not.toHaveBeenCalled();
		});
	});

	/**
	 * `finalizeRun` is the private helper both the success and catch branches of `execute()` call
	 * right after computing their status, so it carries the retention branch that `finish()` used
	 * to be followed by directly. Exercised through reflection because the `completed`/`partial`
	 * branch is only reachable by actually finishing all three scrape phases, which needs
	 * `p-limit`'s dynamic import — unusable under jest here (see above).
	 */
	describe('finalizeRun', () => {
		it('deletes every other run for the periodo when the run completed', async () => {
			const service = buildService();

			await (service as unknown as { finalizeRun: Function }).finalizeRun(
				'run-1',
				PERIOD,
				'completed',
				{},
			);

			expect(mockScrapeRunRepository.finish).toHaveBeenCalledWith('run-1', 'completed', {});
			expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).toHaveBeenCalledWith(
				PERIOD,
				'run-1',
			);
			expect(mockScrapeRunRepository.deleteRun).not.toHaveBeenCalled();
		});

		it('triggers export generation for the periodo when the run completed', async () => {
			const service = buildService();

			await (service as unknown as { finalizeRun: Function }).finalizeRun(
				'run-1',
				PERIOD,
				'completed',
				{},
			);
			await flush();

			expect(mockExportGenerationService.triggerForPlannerRun).toHaveBeenCalledWith(
				PERIOD,
				'run-1',
			);
		});

		it('does not let a rejected export-generation trigger propagate out of finalizeRun', async () => {
			mockExportGenerationService.triggerForPlannerRun.mockRejectedValue(new Error('boom'));
			const service = buildService();

			await expect(
				(service as unknown as { finalizeRun: Function }).finalizeRun(
					'run-1',
					PERIOD,
					'completed',
					{},
				),
			).resolves.toBeUndefined();
			await flush();
		});

		it.each(['partial', 'failed', 'expired'])(
			'deletes only its own row when the run is %s',
			async (status) => {
				const service = buildService();

				await (service as unknown as { finalizeRun: Function }).finalizeRun(
					'run-1',
					PERIOD,
					status,
					{},
				);
				await flush();

				expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith('run-1');
				expect(mockScrapeRunRepository.deleteOtherRunsForPeriod).not.toHaveBeenCalled();
				expect(mockExportGenerationService.triggerForPlannerRun).not.toHaveBeenCalled();
			},
		);

		// Regression test for AF-5: a transient retention-delete failure must not propagate out of
		// finalizeRun (and, by extension, out of execute()), unlike finish()'s own failure which is
		// deliberately left uncaught.
		it('logs and swallows a retention-delete failure instead of propagating it', async () => {
			mockScrapeRunRepository.deleteOtherRunsForPeriod.mockRejectedValue(new Error('db down'));
			const service = buildService();

			await expect(
				(service as unknown as { finalizeRun: Function }).finalizeRun(
					'run-1',
					PERIOD,
					'completed',
					{},
				),
			).resolves.toBeUndefined();
			expect(mockScrapeRunRepository.finish).toHaveBeenCalledWith('run-1', 'completed', {});
		});
	});

	/**
	 * Milestone 5: `execute()` no longer calls three separate sequential phase methods — it runs
	 * one pipeline where a section's evaluaciones fetch is scheduled the moment that section is
	 * discovered, not after every course's secciones search has finished (see design.md § AC-6).
	 * `createLimiters()` is stubbed with pass-through limiters so these tests exercise the real
	 * scheduling/dedup logic without touching `createLimiter()`'s real `await import('p-limit')`,
	 * which is unusable under this repo's `module: nodenext` jest setup (same constraint as the
	 * `run classification` describe block above, and as Banner's `scraper.service.spec.ts`).
	 */
	describe('execute pipeline (Milestone 5)', () => {
		const passthrough = (fn: () => Promise<unknown>) => fn();

		const stubLimiters = (service: PlannerScraperService) =>
			jest
				.spyOn(service as unknown as { createLimiters: Function }, 'createLimiters')
				.mockResolvedValue({ section: passthrough, evaluation: passthrough, grade: passthrough });

		const respondByPath = (
			handlers: Record<string, (query: Record<string, string>) => unknown>,
		) => {
			mockHttp.get.mockImplementation(async (path: string, query: Record<string, string>) => {
				const handler = handlers[path];
				return handler ? handler(query) : [];
			});
		};

		const PERIODS_HANDLER = () => [{ periodCode: `UG-${PERIOD}`, periodId: 'period-1' }];

		it('fetches a section reachable from two courses only once (seenSections dedup)', async () => {
			const service = buildService();
			stubLimiters(service);
			respondByPath({
				'/api/core-api/academic-periods/list': PERIODS_HANDLER,
				'/api/core-api/sections': () => [{ sectionId: 'SEC-SHARED' }],
				'/api/class-api/evaluations/structure': () => [
					{ structure: [{ evalComponentId: 'COMP-1' }] },
				],
				'/api/class-api/grades': () => [{ grades: [], approvalCategories: [] }],
			});

			await (service as unknown as { execute: Function }).execute('run-1', 'UG', PERIOD, [
				'CS101',
				'CS102',
			]);

			const evaluacionCalls = mockHttp.get.mock.calls.filter(
				([path]) => path === '/api/class-api/evaluations/structure',
			);
			expect(evaluacionCalls).toHaveLength(1);
			expect(evaluacionCalls[0][1]).toEqual({ sectionId: 'SEC-SHARED' });
		});

		it('fetches a duplicate (evalComponentId, sectionId) pair only once (seenPairs dedup)', async () => {
			const service = buildService();
			stubLimiters(service);
			respondByPath({
				'/api/core-api/academic-periods/list': PERIODS_HANDLER,
				'/api/core-api/sections': () => [{ sectionId: 'SEC-1' }],
				'/api/class-api/evaluations/structure': () => [
					{ structure: [{ evalComponentId: 'COMP-1' }, { evalComponentId: 'COMP-1' }] },
				],
				'/api/class-api/grades': () => [{ grades: [], approvalCategories: [] }],
			});

			await (service as unknown as { execute: Function }).execute('run-1', 'UG', PERIOD, ['CS101']);

			const notaCalls = mockHttp.get.mock.calls.filter(
				([path]) => path === '/api/class-api/grades',
			);
			expect(notaCalls).toHaveLength(1);
			expect(notaCalls[0][1]).toEqual({ evalComponentId: 'COMP-1', sectionId: 'SEC-1' });
		});

		it('fires secciones, evaluaciones and notas exactly once each, in order, even when multiple sections enter concurrently', async () => {
			const service = buildService();
			stubLimiters(service);
			respondByPath({
				'/api/core-api/academic-periods/list': PERIODS_HANDLER,
				'/api/core-api/sections': (q) => [{ sectionId: `SEC-${q.text}` }],
				'/api/class-api/evaluations/structure': (q) => [
					{ structure: [{ evalComponentId: `COMP-${q.sectionId}` }] },
				],
				'/api/class-api/grades': () => [{ grades: [], approvalCategories: [] }],
			});

			await (service as unknown as { execute: Function }).execute('run-1', 'UG', PERIOD, [
				'CS101',
				'CS102',
			]);

			const phaseCalls = mockScrapeRunRepository.updatePhase.mock.calls.map(([, phase]) => phase);
			expect(phaseCalls).toEqual(['sections', 'evaluations', 'grades']);
			expect(finishedStatus()).toBe('completed');
		});

		// Regression for AF-1: `scheduleNota`/`scheduleEvaluacion` fire `updatePhase` in the
		// background (not awaited, since awaiting it would block the pipeline on a progress write).
		// Before the fix, a rejection there had no `.catch()` — on this repo's Node version, an
		// unhandled rejection crashes the whole process, not just this scrape run. This test proves
		// the fix by listening for a real `unhandledRejection` event: with the bug present, this
		// test fails because that event fires; with the fix, `updatePhaseInBackground` catches the
		// rejection and logs it instead.
		it('does not produce an unhandled rejection when a mid-pipeline phase update fails', async () => {
			const service = buildService();
			stubLimiters(service);
			respondByPath({
				'/api/core-api/academic-periods/list': PERIODS_HANDLER,
				'/api/core-api/sections': () => [{ sectionId: 'SEC-1' }],
				'/api/class-api/evaluations/structure': () => [
					{ structure: [{ evalComponentId: 'COMP-1' }] },
				],
				'/api/class-api/grades': () => [{ grades: [], approvalCategories: [] }],
			});
			mockScrapeRunRepository.updatePhase.mockImplementation((_id: string, phase: string) =>
				phase === 'evaluations'
					? Promise.reject(new Error('transient db blip'))
					: Promise.resolve(undefined),
			);

			const unhandled: unknown[] = [];
			const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
			process.on('unhandledRejection', onUnhandledRejection);

			try {
				await (service as unknown as { execute: Function }).execute('run-1', 'UG', PERIOD, [
					'CS101',
				]);
				await flush();
			} finally {
				process.off('unhandledRejection', onUnhandledRejection);
			}

			expect(unhandled).toHaveLength(0);
			expect(finishedStatus()).toBe('completed');
		});

		it('still aborts the whole run on a fatal error raised mid-pipeline (evaluaciones phase)', async () => {
			const service = buildService();
			stubLimiters(service);
			mockHttp.get.mockImplementation(async (path: string) => {
				if (path === '/api/core-api/academic-periods/list') return PERIODS_HANDLER({});
				if (path === '/api/core-api/sections') return [{ sectionId: 'SEC-1' }];
				if (path === '/api/class-api/evaluations/structure') {
					throw new PlannerSessionExpiredError();
				}
				return [];
			});

			await (service as unknown as { execute: Function }).execute('run-1', 'UG', PERIOD, ['CS101']);

			expect(finishedStatus()).toBe('expired');
		});

		// Regression for AF-7: pipelining means a course's `fetchSeccion` can still be in flight
		// (awaiting its own HTTP response) when a fatal error from a *different* course has
		// already aborted the run — before pipelining, the barrier model made this impossible,
		// since no course's next phase could start until every course's current phase finished.
		// CS102's `/api/core-api/sections` call is deliberately left pending so it resolves only
		// after `execute()` has already settled via CS101's fatal error, simulating exactly that
		// race. Without the `abortState` guard, CS102's late-arriving sections would still get
		// scheduled into `scheduleEvaluacion` and fetch/insert against an already-finalized run.
		it('stops scheduling new work for a course still in flight when a fatal error aborts the run elsewhere', async () => {
			const service = buildService();
			stubLimiters(service);
			let resolveCs102Sections: (value: unknown) => void = () => {};
			const cs102SectionsPromise = new Promise((resolve) => {
				resolveCs102Sections = resolve;
			});
			mockHttp.get.mockImplementation(async (path: string, query: Record<string, string>) => {
				if (path === '/api/core-api/academic-periods/list') return PERIODS_HANDLER({});
				if (path === '/api/core-api/sections') {
					if (query.text === 'CS102') return cs102SectionsPromise;
					return [{ sectionId: 'SEC-101' }];
				}
				if (path === '/api/class-api/evaluations/structure') {
					throw new PlannerSessionExpiredError();
				}
				return [];
			});

			await (service as unknown as { execute: Function }).execute('run-1', 'UG', PERIOD, [
				'CS101',
				'CS102',
			]);
			expect(finishedStatus()).toBe('expired');

			// CS102's secciones call only resolves now, after the run has already been finalized.
			resolveCs102Sections([{ sectionId: 'SEC-102' }]);
			await flush();

			const evaluacionCallsForCs102 = mockHttp.get.mock.calls.filter(
				([path, query]) =>
					path === '/api/class-api/evaluations/structure' && query.sectionId === 'SEC-102',
			);
			expect(evaluacionCallsForCs102).toHaveLength(0);
			expect(mockEvaluacionRepository.bulkInsert).not.toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ sectionId: 'SEC-102' })]),
			);

			// Regression for the skipped-work-is-unaccounted gap the AF-7 fix itself introduced:
			// the persisted `stats` object (captured by reference via the `finish` mock) must record
			// CS102's late skip, not silently drop it — otherwise a reader of the persisted row sees
			// `requested.length` exceed `succeeded + failed + errors`, with no trace of why.
			const persistedStats = mockScrapeRunRepository.finish.mock.calls[0]?.[2] as {
				errors: Array<{ step: string; key: string; message: string }>;
			};
			expect(persistedStats.errors).toContainEqual({
				step: 'evaluacion',
				key: 'SEC-102',
				message: 'skipped: run aborted',
			});
		});

		// Regression for AF-9: a non-fatal, per-course error must not abort sibling courses —
		// the pipeline restructure changed *how* work is scheduled, not the per-item error
		// contract `fetchSeccion`'s own try/catch already enforced.
		it('records a non-fatal per-course error and still completes the other course', async () => {
			const service = buildService();
			stubLimiters(service);
			respondByPath({
				'/api/core-api/academic-periods/list': PERIODS_HANDLER,
				'/api/core-api/sections': (q) =>
					q.text === 'CS101'
						? Promise.reject(new Error('502 from Planner'))
						: [{ sectionId: 'SEC-102' }],
				'/api/class-api/evaluations/structure': () => [
					{ structure: [{ evalComponentId: 'COMP-102' }] },
				],
				'/api/class-api/grades': () => [
					{ grades: [{ studentCode: 'S1' }], approvalCategories: [] },
				],
			});

			await (service as unknown as { execute: Function }).execute('run-1', 'UG', PERIOD, [
				'CS101',
				'CS102',
			]);

			expect(finishedStatus()).toBe('partial');
			const stats = mockScrapeRunRepository.finish.mock.calls[0]?.[2];
			expect(stats.courses.failed).toEqual(['CS101']);
			expect(stats.courses.succeeded).toEqual(['CS102']);
			expect(mockNotaRepository.bulkInsert).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ sectionId: 'SEC-102' })]),
			);
		});

		// Regression for AF-14: a course with no matching sections must not advance `phase` past
		// `'secciones'`, and the run must still complete cleanly rather than hang or error —
		// `evaluacionesStarted`/`notasStarted` should simply never flip.
		it('stays at the secciones phase and still completes when a course has no sections', async () => {
			const service = buildService();
			stubLimiters(service);
			respondByPath({
				'/api/core-api/academic-periods/list': PERIODS_HANDLER,
				'/api/core-api/sections': () => [],
			});

			await (service as unknown as { execute: Function }).execute('run-1', 'UG', PERIOD, ['CS101']);

			const phaseCalls = mockScrapeRunRepository.updatePhase.mock.calls.map(([, phase]) => phase);
			expect(phaseCalls).toEqual(['sections']);
			expect(finishedStatus()).toBe('completed');
		});
	});

	describe('getRun', () => {
		it('includes phase in the returned run status', async () => {
			mockScrapeRunRepository.findById.mockResolvedValue({
				status: 'running',
				phase: 'evaluations',
				stats: null,
			});
			const service = buildService();

			const result = await service.getRun('run-1');

			expect(result).toEqual({ status: 'running', phase: 'evaluations', stats: null });
		});
	});

	describe('listRuns', () => {
		const buildRun = (overrides: Partial<Record<string, unknown>> = {}) => ({
			id: 'run-1',
			period: PERIOD,
			school: null,
			status: 'running',
			phase: 'sections',
			startedAt: new Date('2026-08-20T10:00:00.000Z'),
			finishedAt: null,
			stats: null,
			triggeredBy: 'user:1',
			...overrides,
		});

		beforeEach(() => {
			mockSourceRepository.findAcademicPeriodCode.mockResolvedValue(PERIOD);
		});

		it('includes phase in each run summary', async () => {
			mockScrapeRunRepository.findByPeriod.mockResolvedValue([buildRun()]);
			const service = buildService();

			const [summary] = await service.listRuns(1);

			expect(summary.phase).toBe('sections');
		});

		it('resolves triggeredBy to the display name looked up by id', async () => {
			mockScrapeRunRepository.findByPeriod.mockResolvedValue([
				buildRun({ triggeredBy: 'user:12' }),
			]);
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

		it('falls back to "-" when triggeredBy is malformed, without calling the user lookup', async () => {
			mockScrapeRunRepository.findByPeriod.mockResolvedValue([buildRun({ triggeredBy: 'admin' })]);
			const service = buildService();

			const [summary] = await service.listRuns(1);

			expect(summary.triggeredByName).toBe('-');
			expect(mockUserRepository.findDisplayNamesByIds).not.toHaveBeenCalled();
		});

		it('resolves multiple runs with one deduped batched lookup call', async () => {
			mockScrapeRunRepository.findByPeriod.mockResolvedValue([
				buildRun({ id: 'run-1', triggeredBy: 'user:12' }),
				buildRun({ id: 'run-2', triggeredBy: 'user:999999' }),
				buildRun({ id: 'run-3', triggeredBy: 'user:12' }),
			]);
			mockUserRepository.findDisplayNamesByIds.mockResolvedValue(new Map([[12, 'Jane Doe']]));
			const service = buildService();

			const summaries = await service.listRuns(1);

			expect(mockUserRepository.findDisplayNamesByIds).toHaveBeenCalledTimes(1);
			expect(mockUserRepository.findDisplayNamesByIds).toHaveBeenCalledWith([12, 999999]);
			expect(summaries.map((s) => s.triggeredByName)).toEqual(['Jane Doe', '-', 'Jane Doe']);
		});

		it('falls back to "-" for every run when the user lookup fails, without throwing', async () => {
			mockScrapeRunRepository.findByPeriod.mockResolvedValue([
				buildRun({ triggeredBy: 'user:12' }),
			]);
			mockUserRepository.findDisplayNamesByIds.mockRejectedValue(new Error('db down'));
			const service = buildService();

			const [summary] = await service.listRuns(1);

			expect(summary.triggeredByName).toBe('-');
		});
	});
});
