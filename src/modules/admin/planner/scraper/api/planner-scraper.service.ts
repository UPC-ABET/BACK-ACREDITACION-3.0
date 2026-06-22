import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
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
import { PlannerSessionExpiredError } from '../../planner-token/model/session-expired.error';
import { PlannerScrapeRunStatus } from '../../raw/model/planner-scrape-run.entity';
import { RunPlannerScrapeDto } from '../model/planner-scraper.dtos';
import { plannerScraperValidationStrings } from '../config/strings/planner-scraper.validation';

const DEFAULT_NIVEL = 'UG';
const SECCION_CONCURRENCY = 20;
const EVALUACION_CONCURRENCY = 20;
const NOTA_CONCURRENCY = 20;

interface ScrapeStats {
	courses: { requested: string[]; succeeded: string[]; failed: string[] };
	counts: { seccion: number; evaluacion: number; nota: number };
	uniqueSections: number;
	errors: Array<{ step: string; key: string; message: string }>;
}

export interface PlannerRunSummary {
	runId: string;
	periodo: string;
	escuela: string | null;
	status: PlannerScrapeRunStatus;
	startedAt: string;
	finishedAt: string | null;
	counts: ScrapeStats['counts'] | null;
	triggeredBy: string | null;
}

interface EvalPair {
	evalComponentId: string;
	sectionId: string;
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

		const periodo = await this.sourceRepository.findAcademicPeriodCode(academicPeriodId);
		if (!periodo) {
			throw new HttpException(
				plannerScraperValidationStrings.error.periodNotFound,
				HttpStatus.BAD_REQUEST,
			);
		}

		const nivel = dto.nivel?.trim() || DEFAULT_NIVEL;
		const cursos = dto.cursos?.length
			? [...new Set(dto.cursos)]
			: await this.sourceRepository.findActiveCourseCodes();

		if (cursos.length === 0) {
			throw new HttpException(
				plannerScraperValidationStrings.error.noCourses,
				HttpStatus.BAD_REQUEST,
			);
		}

		const runId = randomUUID();
		await this.scrapeRunRepository.createRun({ id: runId, periodo, escuela: null, triggeredBy });

		this.running = true;
		void this.execute(runId, nivel, periodo, cursos).finally(() => {
			this.running = false;
		});

		return { runId };
	}

	async getRun(
		runId: string,
	): Promise<{ status: PlannerScrapeRunStatus; stats: ScrapeStats | null }> {
		const run = await this.scrapeRunRepository.findById(runId);
		if (!run) {
			throw new HttpException(
				plannerScraperValidationStrings.error.runNotFound,
				HttpStatus.NOT_FOUND,
			);
		}
		return { status: run.status, stats: run.stats as ScrapeStats | null };
	}

	async listRuns(academicPeriodId: number): Promise<PlannerRunSummary[]> {
		const periodo = await this.sourceRepository.findAcademicPeriodCode(academicPeriodId);
		if (!periodo) {
			throw new HttpException(
				plannerScraperValidationStrings.error.periodNotFound,
				HttpStatus.BAD_REQUEST,
			);
		}
		const runs = await this.scrapeRunRepository.findByPeriodo(periodo);
		return runs.map((run) => ({
			runId: run.id,
			periodo: run.periodo,
			escuela: run.escuela,
			status: run.status,
			startedAt: run.startedAt.toISOString(),
			finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
			counts: (run.stats as ScrapeStats | null)?.counts ?? null,
			triggeredBy: run.triggeredBy,
		}));
	}

	private async execute(
		runId: string,
		nivel: string,
		periodo: string,
		cursos: string[],
	): Promise<void> {
		const stats: ScrapeStats = {
			courses: { requested: cursos, succeeded: [], failed: [] },
			counts: { seccion: 0, evaluacion: 0, nota: 0 },
			uniqueSections: 0,
			errors: [],
		};

		try {
			const periodId = await this.resolvePeriodId(nivel, periodo);
			const sectionIds = await this.scrapeSecciones(runId, periodo, periodId, cursos, stats);
			stats.uniqueSections = sectionIds.length;
			const pairs = await this.scrapeEvaluaciones(runId, sectionIds, stats);
			await this.scrapeNotas(runId, pairs, stats);

			const status: PlannerScrapeRunStatus =
				stats.courses.failed.length > 0 || stats.errors.length > 0 ? 'partial' : 'completed';
			await this.scrapeRunRepository.finish(runId, status, stats);
			this.logger.log(`Planner scrape ${runId} ${status}: ${JSON.stringify(stats.counts)}`);
		} catch (error) {
			const expired = error instanceof PlannerSessionExpiredError;
			const status: PlannerScrapeRunStatus = expired ? 'expired' : 'failed';
			await this.scrapeRunRepository.finish(runId, status, {
				...stats,
				fatal: (error as Error).message,
			});
			this.logger.error(`Planner scrape ${runId} ${status}: ${(error as Error).message}`);
		}
	}

	// Phase 0: resolve the Planner periodId. Planner's periodCode is `${nivel}-${periodo}`.
	private async resolvePeriodId(nivel: string, periodo: string): Promise<string> {
		const periods = await this.http.get<Record<string, unknown>>(
			'/api/core-api/academic-periods/list',
			{ isCurrent: '', isProgrammable: '' },
		);
		const target = `${nivel}-${periodo}`;
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

	// Phase 1: per course code, search Planner sections; one raw row per section.
	private async scrapeSecciones(
		runId: string,
		periodo: string,
		periodId: string,
		cursos: string[],
		stats: ScrapeStats,
	): Promise<string[]> {
		const sectionIds = new Set<string>();
		const limit = await createLimiter(SECCION_CONCURRENCY);

		await Promise.all(
			cursos.map((curso) =>
				limit(async () => {
					try {
						const sections = await this.http.get<Record<string, unknown>>(
							'/api/core-api/sections',
							{
								feature: 'grades',
								limit: '9999999999',
								nextPage: 'false',
								onlyParents: '1',
								page: '1',
								periodIds: periodId,
								total: '0',
								text: curso,
							},
						);
						const rows: RawPlannerSeccionInsert[] = sections.map((section) => {
							const sectionId = toStringOrNull(section.sectionId);
							if (sectionId) sectionIds.add(sectionId);
							return {
								runId,
								periodo,
								sectionId,
								payload: section,
								payloadHash: hashPayload(section),
							};
						});
						await this.rawSeccionRepository.bulkInsert(rows);
						stats.counts.seccion += rows.length;
						stats.courses.succeeded.push(curso);
					} catch (error) {
						if (error instanceof PlannerSessionExpiredError) throw error;
						stats.courses.failed.push(curso);
						stats.errors.push({ step: 'seccion', key: curso, message: (error as Error).message });
					}
				}),
			),
		);

		return [...sectionIds];
	}

	// Phase 2: per section, fetch the evaluation structure; flatten the component tree into one
	// raw row per component. Returns the (evalComponentId, sectionId) pairs that drive grades.
	private async scrapeEvaluaciones(
		runId: string,
		sectionIds: string[],
		stats: ScrapeStats,
	): Promise<EvalPair[]> {
		const pairs: EvalPair[] = [];
		const limit = await createLimiter(EVALUACION_CONCURRENCY);

		await Promise.all(
			sectionIds.map((sectionId) =>
				limit(async () => {
					try {
						const results = await this.http.get<Record<string, unknown>>(
							'/api/class-api/evaluations/structure',
							{ sectionId },
						);
						const root = results[0];
						if (!root) return;

						const components = flattenComponents(root.structure);
						const rows: RawPlannerEvaluacionInsert[] = [];
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
					} catch (error) {
						if (error instanceof PlannerSessionExpiredError) throw error;
						stats.errors.push({
							step: 'evaluacion',
							key: sectionId,
							message: (error as Error).message,
						});
					}
				}),
			),
		);

		return pairs;
	}

	// Phase 3: per (evalComponentId, sectionId), fetch the grades and explode into one raw row
	// per student grade. The parent approvalCategories are kept on each row for downstream resolution.
	private async scrapeNotas(runId: string, pairs: EvalPair[], stats: ScrapeStats): Promise<void> {
		const limit = await createLimiter(NOTA_CONCURRENCY);

		await Promise.all(
			pairs.map((pair) =>
				limit(async () => {
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
						if (error instanceof PlannerSessionExpiredError) throw error;
						stats.errors.push({
							step: 'nota',
							key: `${pair.sectionId}/${pair.evalComponentId}`,
							message: (error as Error).message,
						});
					}
				}),
			),
		);
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
