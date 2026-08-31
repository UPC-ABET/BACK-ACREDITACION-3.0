import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { ScrapeRunRepository } from '../../raw/core/scrape-run.repository';
import { RawHorarioInsert, RawHorarioRepository } from '../../raw/core/raw-horario.repository';
import {
	RawMatriculaInsert,
	RawMatriculaRepository,
} from '../../raw/core/raw-matricula.repository';
import { RawAlumnoInsert, RawAlumnoRepository } from '../../raw/core/raw-alumno.repository';
import { DepartmentSourceRepository } from '../core/department-source.repository';
import { BannerHttpClient } from '../core/banner-http.client';
import { SessionExpiredError } from '../../banner-token/model/session-expired.error';
import { ScraperPhase, ScrapeRunStatus } from '../../raw/model/scrape-run.entity';
import { RunScrapeDto } from '../model/scraper.dtos';
import { scraperValidationStrings } from '../config/strings/scraper.validation';
import { ScrapingExportGenerationService } from '../../../scraping-exports/api/scraping-export-generation.service';
import { UserRepository } from 'src/modules/organization/users/core/users.repository';

const DEFAULT_LEVEL = 'UG';
const NRC_CHUNK_SIZE = 50;
// Starting value pending the staging measurement in tasks.md Task 3.2 / design.md AC-7 — a
// department's schedule response is plausibly larger than one enrollment chunk (NRC_CHUNK_SIZE),
// so this starts conservative relative to ENROLLMENT_CONCURRENCY rather than assuming a higher
// default is safe without measurement.
const SCHEDULE_CONCURRENCY = 5;
const ENROLLMENT_CONCURRENCY = 3;
// Lowered from 120 → 80 (2026-08-21) after benchmarking the grades endpoint directly against
// Banner at concurrency 20–200: real throughput plateaus at ~35 req/s by concurrency ~80 (zero
// 429s even at 200, so this is backend capacity, not a policy throttle) — 120 bought +3%
// throughput over 80 for +44% p50 latency, pure queueing cost with no wall-clock benefit.
// That benchmark predates ADR-005 (grades scraping removed); this constant now governs
// scrapeStudents alone and hasn't been re-validated against that endpoint in isolation.
const SCRAPE_CONCURRENCY = 80;
const INSERT_BATCH_SIZE = 500;

interface ScrapeStats {
	departments: { requested: string[]; succeeded: string[]; failed: string[] };
	// grades stays in this shape permanently at 0 — Banner grades scraping was retired (see
	// ADR-005); kept only so RunSummary.counts doesn't change shape for existing consumers.
	counts: { schedule: number; enrollment: number; students: number; grades: number };
	uniqueStudents: number;
	errors: Array<{ step: string; key: string; message: string }>;
}

export interface RunSummary {
	runId: string;
	level: string;
	period: string;
	departments: string[];
	status: ScrapeRunStatus;
	phase: ScraperPhase | null;
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

@Injectable()
export class ScraperService {
	private readonly logger = new Logger(ScraperService.name);
	private running = false;

	constructor(
		private readonly scrapeRunRepository: ScrapeRunRepository,
		private readonly rawHorarioRepository: RawHorarioRepository,
		private readonly rawMatriculaRepository: RawMatriculaRepository,
		private readonly rawAlumnoRepository: RawAlumnoRepository,
		private readonly departmentSourceRepository: DepartmentSourceRepository,
		private readonly http: BannerHttpClient,
		private readonly exportGenerationService: ScrapingExportGenerationService,
		private readonly userRepository: UserRepository,
	) {}

	async run(
		academicPeriodId: number,
		dto: RunScrapeDto,
		triggeredBy: string | null,
	): Promise<{ runId: string }> {
		if (this.running) {
			throw new HttpException(scraperValidationStrings.error.scrapeInProgress, HttpStatus.CONFLICT);
		}

		const period = await this.departmentSourceRepository.findAcademicPeriodCode(academicPeriodId);
		if (!period) {
			throw new HttpException(
				scraperValidationStrings.error.periodNotFound,
				HttpStatus.BAD_REQUEST,
			);
		}

		const level = dto.level?.trim() || DEFAULT_LEVEL;
		const departments = dto.departments?.length
			? [...new Set(dto.departments)]
			: await this.departmentSourceRepository.findActiveDepartmentCodes();

		if (departments.length === 0) {
			throw new HttpException(scraperValidationStrings.error.noDepartments, HttpStatus.BAD_REQUEST);
		}

		const courseCodes = new Set(
			await this.departmentSourceRepository.findPeriodCourseCodes(academicPeriodId),
		);
		if (courseCodes.size === 0) {
			throw new HttpException(
				scraperValidationStrings.error.noPeriodCourses,
				HttpStatus.BAD_REQUEST,
			);
		}

		const runId = randomUUID();
		await this.scrapeRunRepository.createRun({
			id: runId,
			level,
			period,
			departments,
			triggeredBy,
		});

		this.running = true;
		void this.execute(runId, level, period, departments, courseCodes).finally(() => {
			this.running = false;
		});

		return { runId };
	}

	async getRun(
		runId: string,
	): Promise<{ status: ScrapeRunStatus; phase: ScraperPhase | null; stats: ScrapeStats | null }> {
		const run = await this.scrapeRunRepository.findById(runId);
		if (!run) {
			throw new HttpException(scraperValidationStrings.error.runNotFound, HttpStatus.NOT_FOUND);
		}
		return { status: run.status, phase: run.phase, stats: run.stats as ScrapeStats | null };
	}

	async listRuns(academicPeriodId: number): Promise<RunSummary[]> {
		const period = await this.departmentSourceRepository.findAcademicPeriodCode(academicPeriodId);
		if (!period) {
			throw new HttpException(
				scraperValidationStrings.error.periodNotFound,
				HttpStatus.BAD_REQUEST,
			);
		}
		const runs = await this.scrapeRunRepository.findByPeriod(period);
		const userIds = [
			...new Set(
				runs.map((run) => parseUserId(run.triggeredBy)).filter((id): id is number => id !== null),
			),
		];
		const namesById = await this.resolveTriggeredByNames(userIds);
		return runs.map((run) => {
			const userId = parseUserId(run.triggeredBy);
			return {
				runId: run.id,
				level: run.level,
				period: run.period,
				departments: run.departments,
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

	// triggeredByName is cosmetic enrichment on top of the run list, not the reason listRuns
	// exists — a transient failure resolving it must not take down the whole call. Falls back
	// to every name reading '-', matching what an unresolvable triggeredBy already renders as.
	private async resolveTriggeredByNames(userIds: number[]): Promise<Map<number, string>> {
		if (userIds.length === 0) return new Map<number, string>();
		try {
			return await this.userRepository.findDisplayNamesByIds(userIds);
		} catch (error) {
			this.logger.error(
				`Failed to resolve triggeredBy names: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return new Map<number, string>();
		}
	}

	private async execute(
		runId: string,
		level: string,
		period: string,
		departments: string[],
		courseCodes: Set<string>,
	): Promise<void> {
		const stats: ScrapeStats = {
			departments: { requested: departments, succeeded: [], failed: [] },
			counts: { schedule: 0, enrollment: 0, students: 0, grades: 0 },
			uniqueStudents: 0,
			errors: [],
		};

		try {
			await this.scrapeRunRepository.updatePhase(runId, 'schedule');
			const { nrcs } = await this.scrapeSchedule(
				runId,
				level,
				period,
				departments,
				courseCodes,
				stats,
			);
			await this.scrapeRunRepository.updatePhase(runId, 'enrollment');
			const { studentCodes } = await this.scrapeEnrollment(runId, level, period, nrcs, stats);
			stats.uniqueStudents = studentCodes.length;
			await this.scrapeRunRepository.updatePhase(runId, 'studentsAndGrades');
			const limit = await this.createScrapeLimit();
			await this.scrapeStudents(runId, level, studentCodes, stats, limit);

			const status: ScrapeRunStatus =
				stats.departments.failed.length > 0 || stats.errors.length > 0 ? 'partial' : 'completed';
			await this.finalizeRun(runId, period, status, stats);
			this.logger.log(`Scrape ${runId} ${status}: ${JSON.stringify(stats.counts)}`);
		} catch (error) {
			const expired = error instanceof SessionExpiredError;
			const status: ScrapeRunStatus = expired ? 'expired' : 'failed';
			await this.finalizeRun(runId, period, status, {
				...stats,
				fatal: (error as Error).message,
			});
			this.logger.error(`Scrape ${runId} ${status}: ${(error as Error).message}`);
		}
	}

	/**
	 * Persists the run's outcome, then reconciles retention for its period: a `completed` run
	 * supersedes every other row for that period (mopping up whatever partial/failed leftovers a
	 * previous, non-fatal run left behind for the same period in one step), while any other
	 * outcome only removes its own row so a currently-completed run for the period is left
	 * untouched. Retention cleanup is best-effort: a transient failure there is logged and
	 * swallowed rather than propagated, so it never masks the run's own outcome that `finish()`
	 * already persisted.
	 */
	private async finalizeRun(
		runId: string,
		period: string,
		status: ScrapeRunStatus,
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

	// Fire-and-forget: the scrape itself already succeeded and is already persisted by the time
	// this runs, so a failure generating exports must never surface as a scrape failure.
	private triggerExportGeneration(period: string, bannerRunId: string): void {
		void this.exportGenerationService.triggerForBannerRun(period, bannerRunId).catch((error) => {
			this.logger.error(
				`Failed to trigger export generation for period ${period}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		});
	}

	// Split out so tests can stub the limiter without going through a real `await
	// import('p-limit')` — that dynamic import is unusable under this repo's `module: nodenext`
	// ts-jest setup regardless of mocking (see this file's `.spec.ts` for the full explanation).
	private async createScheduleLimit(): Promise<Limiter> {
		return await createLimiter(SCHEDULE_CONCURRENCY);
	}

	// Same seam as createScheduleLimit, for the students phase's own real `await
	// import('p-limit')` call.
	private async createScrapeLimit(): Promise<Limiter> {
		return await createLimiter(SCRAPE_CONCURRENCY);
	}

	private async scrapeSchedule(
		runId: string,
		level: string,
		period: string,
		departments: string[],
		courseCodes: Set<string>,
		stats: ScrapeStats,
	): Promise<{ nrcs: string[] }> {
		const nrcs = new Set<string>();
		const limit = await this.createScheduleLimit();

		await Promise.all(
			departments.map((department) =>
				limit(async () => {
					try {
						const json = await this.http.get<{ detalle?: unknown }>(
							'/horario/HorarioClasesPracticas',
							{
								codigoNivel: level,
								codigoPeriodo: period,
								codigoDepartamento: department,
							},
						);
						const sections = asArray<Record<string, unknown>>(json.detalle);
						const rows: RawHorarioInsert[] = [];
						for (const section of sections) {
							// Scope the scrape to courses tracked in the period's study plans. Sections whose
							// derived code (materia.codigo + numeroCurso) isn't one of ours are dropped here, so
							// they never reach raw_horario nor the downstream enrollment/students steps.
							const courseCode = courseCodeOf(section);
							if (!courseCodes.has(courseCode)) continue;
							const nrc = toStringOrNull(section.nrc);
							if (nrc) nrcs.add(nrc);
							rows.push({
								runId,
								level,
								period,
								department,
								nrc,
								payload: section,
								payloadHash: hashPayload(section),
							});
						}
						await this.rawHorarioRepository.bulkInsert(rows);
						stats.counts.schedule += rows.length;
						stats.departments.succeeded.push(department);
					} catch (error) {
						if (error instanceof SessionExpiredError) throw error;
						stats.departments.failed.push(department);
						stats.errors.push({
							step: 'schedule',
							key: department,
							message: (error as Error).message,
						});
					}
				}),
			),
		);

		return { nrcs: [...nrcs] };
	}

	private async scrapeEnrollment(
		runId: string,
		level: string,
		period: string,
		nrcs: string[],
		stats: ScrapeStats,
	): Promise<{ studentCodes: string[] }> {
		const studentCodes = new Set<string>();
		const chunks = chunk(nrcs, NRC_CHUNK_SIZE);
		// No stubbable seam here, unlike `scrapeSchedule`'s `createScheduleLimit()` — no end-to-end
		// test path reaches this call today (the 'expired' test now stops at `scrapeSchedule`), so
		// this real `await import('p-limit')` (unusable under this repo's jest/`module: nodenext`
		// setup) has never needed a seam to work around it.
		const limit = await createLimiter(ENROLLMENT_CONCURRENCY);

		await Promise.all(
			chunks.map((nrcChunk) =>
				limit(async () => {
					try {
						const json = await this.http.get<{ detalle?: unknown }>(
							'/detallematricula/detallematricula/listado',
							{ codigoNivel: level, codigoPeriodo: period, nrcs: nrcChunk.join(',') },
						);
						const items = asArray<Record<string, unknown>>(json.detalle);
						const rows: RawMatriculaInsert[] = [];
						for (const item of items) {
							const nrc = toStringOrNull(item.nrc) ?? '';
							const alumnos = asArray<Record<string, unknown>>(item.listaAlumnos);
							for (const alumno of alumnos) {
								const studentCode = toStringOrNull(alumno.codigoAlumno);
								if (studentCode) studentCodes.add(studentCode);
								rows.push({
									runId,
									level,
									period,
									nrc,
									studentCode,
									payload: alumno,
									payloadHash: hashPayload(alumno),
								});
							}
						}
						await this.rawMatriculaRepository.bulkInsert(rows);
						stats.counts.enrollment += rows.length;
					} catch (error) {
						if (error instanceof SessionExpiredError) throw error;
						stats.errors.push({
							step: 'enrollment',
							key: `${nrcChunk[0]}..${nrcChunk[nrcChunk.length - 1]}`,
							message: (error as Error).message,
						});
					}
				}),
			),
		);

		return { studentCodes: [...studentCodes] };
	}

	private async scrapeStudents(
		runId: string,
		level: string,
		studentCodes: string[],
		stats: ScrapeStats,
		limit: Limiter,
	): Promise<void> {
		const buffer = new InsertBuffer<RawAlumnoInsert>(INSERT_BATCH_SIZE, (rows) =>
			this.rawAlumnoRepository.bulkInsert(rows),
		);

		await Promise.all(
			studentCodes.map((studentCode) =>
				limit(async () => {
					try {
						const json = await this.http.get<{ detalle?: { listaAlumnos?: unknown } }>(
							'/Alumno/Listado',
							{ nivel: level, codigoAlumno: studentCode, pagina: '1' },
						);
						const alumno = asArray<Record<string, unknown>>(json.detalle?.listaAlumnos)[0];
						if (!alumno) return;
						await buffer.add({
							runId,
							level,
							studentCode,
							payload: alumno,
							payloadHash: hashPayload(alumno),
						});
						stats.counts.students += 1;
					} catch (error) {
						if (error instanceof SessionExpiredError) throw error;
						stats.errors.push({
							step: 'student',
							key: studentCode,
							message: (error as Error).message,
						});
					}
				}),
			),
		);

		await buffer.flush();
	}
}

// Course code is derived: materia.codigo + numeroCurso (e.g. "1ASI" + "0572").
function courseCodeOf(section: Record<string, unknown>): string {
	const materia = section.materia as { codigo?: unknown } | null | undefined;
	const codigo = toStringOrNull(materia?.codigo) ?? '';
	const numero = toStringOrNull(section.numeroCurso) ?? '';
	return `${codigo}${numero}`;
}

function asArray<T>(value: unknown): T[] {
	if (Array.isArray(value)) return value as T[];
	if (value && typeof value === 'object') return [value as T];
	return [];
}

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
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

class InsertBuffer<T> {
	private rows: T[] = [];

	constructor(
		private readonly size: number,
		private readonly onFlush: (rows: T[]) => Promise<void>,
	) {}

	async add(row: T): Promise<void> {
		this.rows.push(row);
		if (this.rows.length >= this.size) {
			await this.onFlush(this.rows.splice(0, this.rows.length));
		}
	}

	async flush(): Promise<void> {
		if (this.rows.length > 0) {
			await this.onFlush(this.rows.splice(0, this.rows.length));
		}
	}
}
