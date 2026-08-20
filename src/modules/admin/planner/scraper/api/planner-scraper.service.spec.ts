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
import { isFatalScrapeError, PlannerScraperService } from './planner-scraper.service';

const PERIODO = '202510';

const mockScrapeRunRepository = {
	createRun: jest.fn(),
	finish: jest.fn(),
	findById: jest.fn(),
	deleteRun: jest.fn(),
	deleteOtherRunsForPeriodo: jest.fn(),
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

const buildService = () =>
	new PlannerScraperService(
		mockScrapeRunRepository as unknown as PlannerScrapeRunRepository,
		mockSeccionRepository as unknown as RawPlannerSeccionRepository,
		mockEvaluacionRepository as unknown as RawPlannerEvaluacionRepository,
		mockNotaRepository as unknown as RawPlannerNotaRepository,
		mockSourceRepository as unknown as PlannerSourceRepository,
		mockHttp as unknown as PlannerHttpClient,
		mockExportGenerationService as unknown as ScrapingExportGenerationService,
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
		mockSourceRepository.findAcademicPeriodCode.mockResolvedValue(PERIODO);
		mockSourceRepository.findActiveCourseCodes.mockResolvedValue(['CS101']);
		mockScrapeRunRepository.createRun.mockResolvedValue(undefined);
		mockScrapeRunRepository.finish.mockResolvedValue(undefined);
		mockScrapeRunRepository.deleteRun.mockResolvedValue(undefined);
		mockScrapeRunRepository.deleteOtherRunsForPeriodo.mockResolvedValue(undefined);
		mockExportGenerationService.triggerForPlannerRun.mockResolvedValue(undefined);
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
			expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).not.toHaveBeenCalled();
		});

		it('deletes only its own leftovers when a run expires end-to-end', async () => {
			mockHttp.get.mockRejectedValue(new PlannerLoginRejectedError('401'));

			await runAndSettle(buildService());

			const runId = mockScrapeRunRepository.finish.mock.calls[0]?.[0] as string;
			expect(finishedStatus()).toBe('expired');
			expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith(runId);
			expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).not.toHaveBeenCalled();
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
				PERIODO,
				'completed',
				{},
			);

			expect(mockScrapeRunRepository.finish).toHaveBeenCalledWith('run-1', 'completed', {});
			expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).toHaveBeenCalledWith(
				PERIODO,
				'run-1',
			);
			expect(mockScrapeRunRepository.deleteRun).not.toHaveBeenCalled();
		});

		it('triggers export generation for the periodo when the run completed', async () => {
			const service = buildService();

			await (service as unknown as { finalizeRun: Function }).finalizeRun(
				'run-1',
				PERIODO,
				'completed',
				{},
			);
			await flush();

			expect(mockExportGenerationService.triggerForPlannerRun).toHaveBeenCalledWith(
				PERIODO,
				'run-1',
			);
		});

		it('does not let a rejected export-generation trigger propagate out of finalizeRun', async () => {
			mockExportGenerationService.triggerForPlannerRun.mockRejectedValue(new Error('boom'));
			const service = buildService();

			await expect(
				(service as unknown as { finalizeRun: Function }).finalizeRun(
					'run-1',
					PERIODO,
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
					PERIODO,
					status,
					{},
				);
				await flush();

				expect(mockScrapeRunRepository.deleteRun).toHaveBeenCalledWith('run-1');
				expect(mockScrapeRunRepository.deleteOtherRunsForPeriodo).not.toHaveBeenCalled();
				expect(mockExportGenerationService.triggerForPlannerRun).not.toHaveBeenCalled();
			},
		);

		// Regression test for AF-5: a transient retention-delete failure must not propagate out of
		// finalizeRun (and, by extension, out of execute()), unlike finish()'s own failure which is
		// deliberately left uncaught.
		it('logs and swallows a retention-delete failure instead of propagating it', async () => {
			mockScrapeRunRepository.deleteOtherRunsForPeriodo.mockRejectedValue(new Error('db down'));
			const service = buildService();

			await expect(
				(service as unknown as { finalizeRun: Function }).finalizeRun(
					'run-1',
					PERIODO,
					'completed',
					{},
				),
			).resolves.toBeUndefined();
			expect(mockScrapeRunRepository.finish).toHaveBeenCalledWith('run-1', 'completed', {});
		});
	});
});
