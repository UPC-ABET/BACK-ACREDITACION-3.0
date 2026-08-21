import {
	HttpException,
	HttpStatus,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PlannerScrapeRunRepository } from '../../raw/core/planner-scrape-run.repository';
import {
	RawPlannerSeccionInsert,
	RawPlannerSeccionRepository,
} from '../../raw/core/raw-planner-seccion.repository';
import {
	RawPlannerEvaluacionInsert,
	RawPlannerEvaluacionRepository,
} from '../../raw/core/raw-planner-evaluacion.repository';
import {
	RawPlannerNotaInsert,
	RawPlannerNotaRepository,
} from '../../raw/core/raw-planner-nota.repository';
import { PlannerSourceRepository } from '../core/planner-source.repository';
import { PlannerHttpClient } from '../core/planner-http.client';
import {
	isPlannerSessionFailure,
	PlannerSessionExpiredError,
} from '../../planner-token/model/planner-session.errors';
import {
	PlannerScraperPhase,
	PlannerScrapeRunStatus,
} from '../../raw/model/planner-scrape-run.entity';
import { RunPlannerScrapeDto } from '../model/planner-scraper.dtos';
import { plannerScraperValidationStrings } from '../config/strings/planner-scraper.validation';
import { ScrapingExportGenerationService } from '../../../scraping-exports/api/scraping-export-generation.service';
import { UserRepository } from 'src/modules/organization/users/core/users.repository';

/**
 * Aborts the whole run rather than being recorded against one course.
 *
 * The per-item catches continue on a missing or malformed course. They must not continue on "no
 * session can be obtained": the client asks for a session on every request and that path has no
 * cooldown, so one outage becomes one institutional login attempt per remaining item, and the run
 * reports `partial` — which reads as "we got most of it".
 */
export const isFatalScrapeError = (error: unknown): boolean =>
	isPlannerSessionFailure(error) || error instanceof ServiceUnavailableException;

const DEFAULT_LEVEL = 'UG';
const SECTION_CONCURRENCY = 20;
const EVALUATION_CONCURRENCY = 20;
const GRADE_CONCURRENCY = 20;

interface ScrapeStats {
	courses: { requested: string[]; succeeded: string[]; failed: string[] };
	counts: { seccion: number; evaluacion: number; nota: number };
	uniqueSections: number;
	errors: Array<{ step: string; key: string; message: string }>;
}

export interface PlannerRunSummary {
	runId: string;
	period: string;
	school: string | null;
	status: PlannerScrapeRunStatus;
	phase: PlannerScraperPhase | null;
	startedAt: string;
	finishedAt: string | null;
	counts: ScrapeStats['counts'] | null;
	triggeredBy: string | null;
	triggeredByName: string;
}

function parseUserId(triggeredBy: string | null): number | null {
	if (!triggeredBy) return null;
	const match = /^user:(\d+)$/.exec(triggeredBy);
	return match ? Number(match[1]) : null;
}

interface EvalPair {
	evalComponentId: string;
	sectionId: string;
}

// Mutable, shared across one `execute()` call's whole pipeline. Set the moment a fatal error is
// classified so leaf tasks still in flight for other courses/sections stop scheduling further
// downstream work once they next check it — closes (does not eliminate; no `AbortController`
// cancels an in-flight `fetch`) the window where pipelining lets unrelated work outlive a fatal
// error, versus the pre-pipeline barrier model confining that window to same-phase siblings.
interface AbortState {
	aborted: boolean;
}

@Injectable()
export class PlannerScraperService {
	private readonly logger = new Logger(PlannerScraperService.name);
	private running = false;

	constructor(
		private readonly scrapeRunRepository: PlannerScrapeRunRepository,
		private readonly rawSeccionRepository: RawPlannerSeccionRepository,
		private readonly rawEvaluacionRepository: RawPlannerEvaluacionRepository,
		private readonly rawNotaRepository: RawPlannerNotaRepository,
		private readonly sourceRepository: PlannerSourceRepository,
		private readonly http: PlannerHttpClient,
		private readonly exportGenerationService: ScrapingExportGenerationService,
		private readonly userRepository: UserRepository,
	) {}

	async run(
		academicPeriodId: number,
		dto: RunPlannerScrapeDto,
		triggeredBy: string | null,
	): Promise<{ runId: string }> {
		if (this.running) {
			throw new HttpException(
				plannerScraperValidationStrings.error.scrapeInProgress,
				HttpStatus.CONFLICT,
			);
		}

		const period = await this.sourceRepository.findAcademicPeriodCode(academicPeriodId);
		if (!period) {
			throw new HttpException(
				plannerScraperValidationStrings.error.periodNotFound,
				HttpStatus.BAD_REQUEST,
			);
		}

		const level = dto.level?.trim() || DEFAULT_LEVEL;
		const courses = dto.courses?.length
			? [...new Set(dto.courses)]
			: await this.sourceRepository.findActiveCourseCodes();

		if (courses.length === 0) {
			throw new HttpException(
				plannerScraperValidationStrings.error.noCourses,
				HttpStatus.BAD_REQUEST,
			);
		}

		const runId = randomUUID();
		await this.scrapeRunRepository.createRun({ id: runId, period, school: null, triggeredBy });

		this.running = true;
		void this.execute(runId, level, period, courses).finally(() => {
			this.running = false;
		});

		return { runId };
	}

	async getRun(runId: string): Promise<{
		status: PlannerScrapeRunStatus;
		phase: PlannerScraperPhase | null;
		stats: ScrapeStats | null;
	}> {
		const run = await this.scrapeRunRepository.findById(runId);
		if (!run) {
			throw new HttpException(
				plannerScraperValidationStrings.error.runNotFound,
				HttpStatus.NOT_FOUND,
			);
		}
		return { status: run.status, phase: run.phase, stats: run.stats as ScrapeStats | null };
	}

	async listRuns(academicPeriodId: number): Promise<PlannerRunSummary[]> {
		const period = await this.sourceRepository.findAcademicPeriodCode(academicPeriodId);
		if (!period) {
			throw new HttpException(
				plannerScraperValidationStrings.error.periodNotFound,
				HttpStatus.BAD_REQUEST,
			);
		}
		const runs = await this.scrapeRunRepository.findByPeriod(period);
		const userIds = [
			...new Set(
				runs.map((run) => parseUserId(run.triggeredBy)).filter((id): id is number => id !== null),
			),
		];
		const namesById =
			userIds.length > 0 ? await this.userRepository.findDisplayNamesByIds(userIds) : new Map();
		return runs.map((run) => {
			const userId = parseUserId(run.triggeredBy);
			return {
				runId: run.id,
				period: run.period,
				school: run.school,
				status: run.status,
				phase: run.phase,
				startedAt: run.startedAt.toISOString(),
				finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
				counts: (run.stats as ScrapeStats | null)?.counts ?? null,
				triggeredBy: run.triggeredBy,
				triggeredByName: userId !== null ? (namesById.get(userId) ?? '-') : '-',
			};
		});
	}

	/**
	 * Pipelines secciones -> evaluaciones -> notas instead of gating each phase behind a full
	 * `Promise.all` barrier over the previous one. The real dependency is per-item, not per-phase
	 * (`evaluaciones` needs only the one `sectionId` it was scheduled for, `notas` needs only the
	 * one `(evalComponentId, sectionId)` pair it was scheduled for — neither needs anything from a
	 * sibling course/section), so a section discovered by an early-finishing course can start its
	 * evaluaciones fetch while other courses' `scrapeSecciones` calls are still in flight, instead
	 * of waiting for every course to finish first. See design.md § AC-6.
	 *
	 * Each `scheduleX` function both dedupes (a section/pair reachable from more than one course
	 * search must only be fetched once) and chains its own downstream work via `.then`, so
	 * awaiting only the top-level `courses.map(...)` tasks is sufficient — each task's promise
	 * transitively resolves only once everything it spawned has too. The dedup checks are
	 * synchronous (check-then-add with no `await` between), which is race-free under Node's
	 * single-threaded event loop even though many of these closures run concurrently.
	 */
	private async execute(
		runId: string,
		level: string,
		period: string,
		courses: string[],
	): Promise<void> {
		const stats: ScrapeStats = {
			courses: { requested: courses, succeeded: [], failed: [] },
			counts: { seccion: 0, evaluacion: 0, nota: 0 },
			uniqueSections: 0,
			errors: [],
		};

		try {
			const periodId = await this.resolvePeriodId(level, period);
			await this.scrapeRunRepository.updatePhase(runId, 'sections');

			const {
				section: sectionLimit,
				evaluation: evaluationLimit,
				grade: gradeLimit,
			} = await this.createLimiters();
			const seenSections = new Set<string>();
			const seenPairs = new Set<string>();
			let evaluationsStarted = false;
			let gradesStarted = false;
			const abortState: AbortState = { aborted: false };

			const scheduleNota = (pair: EvalPair): Promise<void> => {
				if (abortState.aborted) {
					stats.errors.push({
						step: 'nota',
						key: `${pair.sectionId}/${pair.evalComponentId}`,
						message: 'skipped: run aborted',
					});
					return Promise.resolve();
				}
				const key = `${pair.sectionId}|${pair.evalComponentId}`;
				if (seenPairs.has(key)) return Promise.resolve();
				seenPairs.add(key);
				if (!gradesStarted) {
					gradesStarted = true;
					this.updatePhaseInBackground(runId, 'grades');
				}
				return gradeLimit(() => this.fetchNota(runId, pair, stats, abortState));
			};

			const scheduleEvaluacion = (sectionId: string): Promise<void> => {
				if (abortState.aborted) {
					stats.errors.push({
						step: 'evaluacion',
						key: sectionId,
						message: 'skipped: run aborted',
					});
					return Promise.resolve();
				}
				if (seenSections.has(sectionId)) return Promise.resolve();
				seenSections.add(sectionId);
				if (!evaluationsStarted) {
					evaluationsStarted = true;
					this.updatePhaseInBackground(runId, 'evaluations');
				}
				return evaluationLimit(() =>
					this.fetchEvaluacion(runId, sectionId, stats, abortState).then((pairs) =>
						Promise.all(pairs.map(scheduleNota)).then(() => undefined),
					),
				);
			};

			await Promise.all(
				courses.map((course) =>
					sectionLimit(() => {
						if (abortState.aborted) {
							stats.errors.push({ step: 'seccion', key: course, message: 'skipped: run aborted' });
							return Promise.resolve();
						}
						return this.fetchSeccion(runId, period, periodId, course, stats, abortState).then(
							(sectionIds) => Promise.all(sectionIds.map(scheduleEvaluacion)).then(() => undefined),
						);
					}),
				),
			);
			stats.uniqueSections = seenSections.size;

			const status: PlannerScrapeRunStatus =
				stats.courses.failed.length > 0 || stats.errors.length > 0 ? 'partial' : 'completed';
			await this.finalizeRun(runId, period, status, stats);
			this.logger.log(`Planner scrape ${runId} ${status}: ${JSON.stringify(stats.counts)}`);
		} catch (error) {
			const expired = error instanceof PlannerSessionExpiredError;
			const status: PlannerScrapeRunStatus = expired ? 'expired' : 'failed';
			await this.finalizeRun(runId, period, status, {
				...stats,
				fatal: (error as Error).message,
			});
			this.logger.error(`Planner scrape ${runId} ${status}: ${(error as Error).message}`);
		}
	}

	// Extracted so tests can stub past the real `createLimiter()` dynamic import (unusable under
	// this repo's `module: nodenext` jest setup, see the file-level comment on `isFatalScrapeError`
	// and the existing `run classification` describe block below) while exercising the real
	// scheduling/dedup logic above.
	private async createLimiters(): Promise<{
		section: Limiter;
		evaluation: Limiter;
		grade: Limiter;
	}> {
		const [section, evaluation, grade] = await Promise.all([
			createLimiter(SECTION_CONCURRENCY),
			createLimiter(EVALUATION_CONCURRENCY),
			createLimiter(GRADE_CONCURRENCY),
		]);
		return { section, evaluation, grade };
	}

	/**
	 * Persists the run's outcome, then reconciles retention for its period: a `completed` run
	 * supersedes every other row for that period (mopping up prior partial/failed leftovers in
	 * the same statement via cascade), while any other outcome only removes its own row so a
	 * currently-completed run for the period is left untouched. Retention cleanup is best-effort:
	 * a transient failure there is logged and swallowed rather than propagated, so it never masks
	 * the run's own outcome that `finish()` already persisted.
	 */
	private async finalizeRun(
		runId: string,
		period: string,
		status: PlannerScrapeRunStatus,
		stats: object,
	): Promise<void> {
		await this.scrapeRunRepository.finish(runId, status, stats);
		try {
			if (status === 'completed') {
				await this.scrapeRunRepository.deleteOtherRunsForPeriod(period, runId);
				this.triggerExportGeneration(period, runId);
			} else {
				await this.scrapeRunRepository.deleteRun(runId);
			}
		} catch (error) {
			this.logger.error(
				`Retention cleanup failed for scrape ${runId} (period ${period}): ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	// Fire-and-forget: a phase-progress write must never crash the process. Unlike `finish()`,
	// which the caller awaits and lets a failure propagate to the run's own catch block, these
	// mid-pipeline writes are best-effort progress reporting — losing one is a worse-looking
	// progress bar, not a correctness problem, so it is logged and swallowed here rather than
	// left as an unhandled rejection on this single-replica service.
	private updatePhaseInBackground(runId: string, phase: PlannerScraperPhase): void {
		void this.scrapeRunRepository.updatePhase(runId, phase).catch((error) => {
			this.logger.error(
				`Failed to update phase to '${phase}' for run ${runId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		});
	}

	// Fire-and-forget: the scrape itself already succeeded and is already persisted by the time
	// this runs, so a failure generating exports must never surface as a scrape failure.
	private triggerExportGeneration(period: string, plannerRunId: string): void {
		void this.exportGenerationService.triggerForPlannerRun(period, plannerRunId).catch((error) => {
			this.logger.error(
				`Failed to trigger export generation for period ${period}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		});
	}

	// Phase 0: resolve the Planner periodId. Planner's periodCode is `${level}-${period}`.
	private async resolvePeriodId(level: string, period: string): Promise<string> {
		const periods = await this.http.get<Record<string, unknown>>(
			'/api/core-api/academic-periods/list',
			{ isCurrent: '', isProgrammable: '' },
		);
		const target = `${level}-${period}`;
		const match = periods.find((p) => toStringOrNull(p.periodCode) === target);
		const periodId = match ? toStringOrNull(match.periodId) : null;
		if (!periodId) {
			throw new HttpException(
				plannerScraperValidationStrings.error.periodNotInPlanner,
				HttpStatus.BAD_REQUEST,
			);
		}
		return periodId;
	}

	// Seccion leaf: search one course's Planner sections, insert one raw row per section, and
	// return the section ids this course's search surfaced (the pipeline schedules their
	// evaluaciones fetches — see `execute()`).
	private async fetchSeccion(
		runId: string,
		period: string,
		periodId: string,
		course: string,
		stats: ScrapeStats,
		abortState: AbortState,
	): Promise<string[]> {
		if (abortState.aborted) {
			stats.errors.push({ step: 'seccion', key: course, message: 'skipped: run aborted' });
			return [];
		}
		try {
			const sections = await this.http.get<Record<string, unknown>>('/api/core-api/sections', {
				feature: 'grades',
				limit: '9999999999',
				nextPage: 'false',
				onlyParents: '1',
				page: '1',
				periodIds: periodId,
				total: '0',
				text: course,
			});
			const sectionIds: string[] = [];
			const rows: RawPlannerSeccionInsert[] = sections.map((section) => {
				const sectionId = toStringOrNull(section.sectionId);
				if (sectionId) sectionIds.push(sectionId);
				return {
					runId,
					period,
					sectionId,
					payload: section,
					payloadHash: hashPayload(section),
				};
			});
			await this.rawSeccionRepository.bulkInsert(rows);
			stats.counts.seccion += rows.length;
			stats.courses.succeeded.push(course);
			return sectionIds;
		} catch (error) {
			if (isFatalScrapeError(error)) {
				abortState.aborted = true;
				throw error;
			}
			stats.courses.failed.push(course);
			stats.errors.push({ step: 'seccion', key: course, message: (error as Error).message });
			return [];
		}
	}

	// Evaluacion leaf: fetch one section's evaluation structure, flatten the component tree into
	// one raw row per component, and return the (evalComponentId, sectionId) pairs this section
	// surfaced (the pipeline schedules their notas fetches — see `execute()`).
	private async fetchEvaluacion(
		runId: string,
		sectionId: string,
		stats: ScrapeStats,
		abortState: AbortState,
	): Promise<EvalPair[]> {
		if (abortState.aborted) {
			stats.errors.push({ step: 'evaluacion', key: sectionId, message: 'skipped: run aborted' });
			return [];
		}
		try {
			const results = await this.http.get<Record<string, unknown>>(
				'/api/class-api/evaluations/structure',
				{ sectionId },
			);
			const root = results[0];
			if (!root) return [];

			const components = flattenComponents(root.structure);
			const rows: RawPlannerEvaluacionInsert[] = [];
			const pairs: EvalPair[] = [];
			for (const component of components) {
				const evalComponentId = toStringOrNull(component.evalComponentId);
				const { nodes: _nodes, ...flat } = component;
				if (evalComponentId) pairs.push({ evalComponentId, sectionId });
				rows.push({
					runId,
					sectionId,
					evalComponentId,
					payload: flat,
					payloadHash: hashPayload(flat),
				});
			}
			await this.rawEvaluacionRepository.bulkInsert(rows);
			stats.counts.evaluacion += rows.length;
			return pairs;
		} catch (error) {
			if (isFatalScrapeError(error)) {
				abortState.aborted = true;
				throw error;
			}
			stats.errors.push({ step: 'evaluacion', key: sectionId, message: (error as Error).message });
			return [];
		}
	}

	// Nota leaf: per (evalComponentId, sectionId), fetch the grades and explode into one raw row
	// per student grade. The parent approvalCategories are kept on each row for downstream
	// resolution.
	private async fetchNota(
		runId: string,
		pair: EvalPair,
		stats: ScrapeStats,
		abortState: AbortState,
	): Promise<void> {
		if (abortState.aborted) {
			stats.errors.push({
				step: 'nota',
				key: `${pair.sectionId}/${pair.evalComponentId}`,
				message: 'skipped: run aborted',
			});
			return;
		}
		try {
			const results = await this.http.get<Record<string, unknown>>('/api/class-api/grades', {
				evalComponentId: pair.evalComponentId,
				sectionId: pair.sectionId,
			});
			const root = results[0];
			if (!root) return;

			const grades = asArray<Record<string, unknown>>(root.grades);
			const approvalCategories = asArray<Record<string, unknown>>(root.approvalCategories);
			const rows: RawPlannerNotaInsert[] = grades.map((grade) => {
				const payload = { ...grade, approvalCategories };
				return {
					runId,
					sectionId: toStringOrNull(grade.sectionId) ?? pair.sectionId,
					componentId: toStringOrNull(grade.componentId) ?? pair.evalComponentId,
					studentCode: toStringOrNull(grade.studentCode),
					payload,
					payloadHash: hashPayload(payload),
				};
			});
			await this.rawNotaRepository.bulkInsert(rows);
			stats.counts.nota += rows.length;
		} catch (error) {
			if (isFatalScrapeError(error)) {
				abortState.aborted = true;
				throw error;
			}
			stats.errors.push({
				step: 'nota',
				key: `${pair.sectionId}/${pair.evalComponentId}`,
				message: (error as Error).message,
			});
		}
	}
}

function asArray<T>(value: unknown): T[] {
	if (Array.isArray(value)) return value as T[];
	if (value && typeof value === 'object') return [value as T];
	return [];
}

// Iterative DFS over the recursive evaluation structure (structure[].nodes[]), one entry per
// component (ported from EvaluationPlannerMapper.MapFrom).
function flattenComponents(structure: unknown): Record<string, unknown>[] {
	const out: Record<string, unknown>[] = [];
	const stack = [...asArray<Record<string, unknown>>(structure)];
	while (stack.length > 0) {
		const node = stack.pop();
		if (!node) continue;
		out.push(node);
		const children = asArray<Record<string, unknown>>(node.nodes);
		for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
	}
	return out;
}

function toStringOrNull(value: unknown): string | null {
	if (value === null || value === undefined || value === '') return null;
	return String(value);
}

function hashPayload(payload: unknown): string {
	return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function createLimiter(concurrency: number) {
	const { default: pLimit } = await import('p-limit');
	return pLimit(concurrency);
}

type Limiter = Awaited<ReturnType<typeof createLimiter>>;
