import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { ScrapeRunRepository } from '../../raw/core/scrape-run.repository';
import { RawHorarioInsert, RawHorarioRepository } from '../../raw/core/raw-horario.repository';
import {
	RawMatriculaInsert,
	RawMatriculaRepository,
} from '../../raw/core/raw-matricula.repository';
import { RawAlumnoInsert, RawAlumnoRepository } from '../../raw/core/raw-alumno.repository';
import { RawNotasInsert, RawNotasRepository } from '../../raw/core/raw-notas.repository';
import { DepartmentSourceRepository } from '../core/department-source.repository';
import { BannerHttpClient } from '../core/banner-http.client';
import { SessionExpiredError } from '../../banner-token/model/session-expired.error';
import { ScrapeRunStatus } from '../../raw/model/scrape-run.entity';
import { RunScrapeDto } from '../model/scraper.dtos';
import { scraperValidationStrings } from '../config/strings/scraper.validation';
import { ScrapingExportGenerationService } from '../../../scraping-exports/api/scraping-export-generation.service';

const DEFAULT_NIVEL = 'UG';
const NRC_CHUNK_SIZE = 50;
const MATRICULA_CONCURRENCY = 3;
const SCRAPE_CONCURRENCY = 80;
const INSERT_BATCH_SIZE = 500;

interface ScrapeStats {
	departments: { requested: string[]; succeeded: string[]; failed: string[] };
	counts: { horario: number; matricula: number; alumno: number; nota: number };
	uniqueStudents: number;
	errors: Array<{ step: string; key: string; message: string }>;
}

// A student enrolled in a section (from matricula); joined to a course code by NRC.
interface Enrollment {
	codigoAlumno: string;
	nrc: string;
}
// A unique (alumno, curso) target for the notas endpoint (NRC is not part of its key).
interface NotaPair {
	codigoAlumno: string;
	cursoCodigo: string;
}

export interface RunSummary {
	runId: string;
	nivel: string;
	periodo: string;
	departamentos: string[];
	status: ScrapeRunStatus;
	startedAt: string;
	finishedAt: string | null;
	counts: ScrapeStats['counts'] | null;
	triggeredBy: string | null;
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
		private readonly rawNotasRepository: RawNotasRepository,
		private readonly departmentSourceRepository: DepartmentSourceRepository,
		private readonly http: BannerHttpClient,
		private readonly exportGenerationService: ScrapingExportGenerationService,
	) {}

	async run(
		academicPeriodId: number,
		dto: RunScrapeDto,
		triggeredBy: string | null,
	): Promise<{ runId: string }> {
		if (this.running) {
			throw new HttpException(scraperValidationStrings.error.scrapeInProgress, HttpStatus.CONFLICT);
		}

		const periodo = await this.departmentSourceRepository.findAcademicPeriodCode(academicPeriodId);
		if (!periodo) {
			throw new HttpException(
				scraperValidationStrings.error.periodNotFound,
				HttpStatus.BAD_REQUEST,
			);
		}

		const nivel = dto.nivel?.trim() || DEFAULT_NIVEL;
		const departamentos = dto.departamentos?.length
			? [...new Set(dto.departamentos)]
			: await this.departmentSourceRepository.findActiveDepartmentCodes();

		if (departamentos.length === 0) {
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
			nivel,
			periodo,
			departamentos,
			triggeredBy,
		});

		this.running = true;
		void this.execute(runId, nivel, periodo, departamentos, courseCodes).finally(() => {
			this.running = false;
		});

		return { runId };
	}

	async getRun(runId: string): Promise<{ status: ScrapeRunStatus; stats: ScrapeStats | null }> {
		const run = await this.scrapeRunRepository.findById(runId);
		if (!run) {
			throw new HttpException(scraperValidationStrings.error.runNotFound, HttpStatus.NOT_FOUND);
		}
		return { status: run.status, stats: run.stats as ScrapeStats | null };
	}

	async listRuns(academicPeriodId: number): Promise<RunSummary[]> {
		const periodo = await this.departmentSourceRepository.findAcademicPeriodCode(academicPeriodId);
		if (!periodo) {
			throw new HttpException(
				scraperValidationStrings.error.periodNotFound,
				HttpStatus.BAD_REQUEST,
			);
		}
		const runs = await this.scrapeRunRepository.findByPeriodo(periodo);
		return runs.map((run) => ({
			runId: run.id,
			nivel: run.nivel,
			periodo: run.periodo,
			departamentos: run.departamentos,
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
		departamentos: string[],
		courseCodes: Set<string>,
	): Promise<void> {
		const stats: ScrapeStats = {
			departments: { requested: departamentos, succeeded: [], failed: [] },
			counts: { horario: 0, matricula: 0, alumno: 0, nota: 0 },
			uniqueStudents: 0,
			errors: [],
		};

		try {
			const { nrcs, courseByNrc } = await this.scrapeHorario(
				runId,
				nivel,
				periodo,
				departamentos,
				courseCodes,
				stats,
			);
			const { codigos, enrollments } = await this.scrapeMatricula(
				runId,
				nivel,
				periodo,
				nrcs,
				stats,
			);
			stats.uniqueStudents = codigos.length;
			// Alumnos and Notas only depend on matricula output, not on each other.
			// Run them concurrently through one shared limiter (see SCRAPE_CONCURRENCY).
			const limit = await createLimiter(SCRAPE_CONCURRENCY);
			await Promise.all([
				this.scrapeAlumnos(runId, nivel, codigos, stats, limit),
				this.scrapeNotas(
					runId,
					nivel,
					periodo,
					buildNotaPairs(enrollments, courseByNrc),
					stats,
					limit,
				),
			]);

			const status: ScrapeRunStatus =
				stats.departments.failed.length > 0 || stats.errors.length > 0 ? 'partial' : 'completed';
			await this.scrapeRunRepository.finish(runId, status, stats);
			await this.cleanupAfterFinish(status, periodo, runId);
			this.logger.log(`Scrape ${runId} ${status}: ${JSON.stringify(stats.counts)}`);
		} catch (error) {
			const expired = error instanceof SessionExpiredError;
			const status: ScrapeRunStatus = expired ? 'expired' : 'failed';
			await this.scrapeRunRepository.finish(runId, status, {
				...stats,
				fatal: (error as Error).message,
			});
			await this.cleanupAfterFinish(status, periodo, runId);
			this.logger.error(`Scrape ${runId} ${status}: ${(error as Error).message}`);
		}
	}

	// A completed run supersedes every other run for its periodo, so this mops up whatever
	// partial/failed leftovers a previous, non-fatal run left behind for the same period in one
	// step. A run that itself finishes partial/failed/expired only ever deletes its own leftovers —
	// it must never touch a completed run that already exists for the period.
	private async cleanupAfterFinish(
		status: ScrapeRunStatus,
		periodo: string,
		runId: string,
	): Promise<void> {
		if (status === 'completed') {
			await this.scrapeRunRepository.deleteOtherRunsForPeriodo(periodo, runId);
			this.triggerExportGeneration(periodo);
		} else {
			await this.scrapeRunRepository.deleteRun(runId);
		}
	}

	// Fire-and-forget: the scrape itself already succeeded and is already persisted by the time
	// this runs, so a failure generating exports must never surface as a scrape failure.
	private triggerExportGeneration(periodo: string): void {
		void this.exportGenerationService.triggerForBannerRun(periodo).catch((error) => {
			this.logger.error(
				`Failed to trigger export generation for periodo ${periodo}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		});
	}

	private async scrapeHorario(
		runId: string,
		nivel: string,
		periodo: string,
		departamentos: string[],
		courseCodes: Set<string>,
		stats: ScrapeStats,
	): Promise<{ nrcs: string[]; courseByNrc: Map<string, string> }> {
		const nrcs = new Set<string>();
		// NRC -> course code, used later to turn (alumno, nrc) enrollments into the
		// (alumno, curso) pairs the notas endpoint needs.
		const courseByNrc = new Map<string, string>();

		for (const departamento of departamentos) {
			try {
				const json = await this.http.get<{ detalle?: unknown }>('/horario/HorarioClasesPracticas', {
					codigoNivel: nivel,
					codigoPeriodo: periodo,
					codigoDepartamento: departamento,
				});
				const sections = asArray<Record<string, unknown>>(json.detalle);
				const rows: RawHorarioInsert[] = [];
				for (const section of sections) {
					// Scope the scrape to courses tracked in the period's study plans. Sections whose
					// derived code (materia.codigo + numeroCurso) isn't one of ours are dropped here, so
					// they never reach raw_horario nor the downstream matricula/alumnos/notas steps.
					const cursoCodigo = courseCodeOf(section);
					if (!courseCodes.has(cursoCodigo)) continue;
					const nrc = toStringOrNull(section.nrc);
					if (nrc) {
						nrcs.add(nrc);
						courseByNrc.set(nrc, cursoCodigo);
					}
					rows.push({
						runId,
						nivel,
						periodo,
						departamento,
						nrc,
						payload: section,
						payloadHash: hashPayload(section),
					});
				}
				await this.rawHorarioRepository.bulkInsert(rows);
				stats.counts.horario += rows.length;
				stats.departments.succeeded.push(departamento);
			} catch (error) {
				if (error instanceof SessionExpiredError) throw error;
				stats.departments.failed.push(departamento);
				stats.errors.push({
					step: 'horario',
					key: departamento,
					message: (error as Error).message,
				});
			}
		}

		return { nrcs: [...nrcs], courseByNrc };
	}

	private async scrapeMatricula(
		runId: string,
		nivel: string,
		periodo: string,
		nrcs: string[],
		stats: ScrapeStats,
	): Promise<{ codigos: string[]; enrollments: Enrollment[] }> {
		const codigos = new Set<string>();
		const enrollments: Enrollment[] = [];
		const chunks = chunk(nrcs, NRC_CHUNK_SIZE);
		const limit = await createLimiter(MATRICULA_CONCURRENCY);

		await Promise.all(
			chunks.map((nrcChunk) =>
				limit(async () => {
					try {
						const json = await this.http.get<{ detalle?: unknown }>(
							'/detallematricula/detallematricula/listado',
							{ codigoNivel: nivel, codigoPeriodo: periodo, nrcs: nrcChunk.join(',') },
						);
						const items = asArray<Record<string, unknown>>(json.detalle);
						const rows: RawMatriculaInsert[] = [];
						for (const item of items) {
							const nrc = toStringOrNull(item.nrc) ?? '';
							const alumnos = asArray<Record<string, unknown>>(item.listaAlumnos);
							for (const alumno of alumnos) {
								const codigoAlumno = toStringOrNull(alumno.codigoAlumno);
								if (codigoAlumno) {
									codigos.add(codigoAlumno);
									if (nrc) enrollments.push({ codigoAlumno, nrc });
								}
								rows.push({
									runId,
									nivel,
									periodo,
									nrc,
									codigoAlumno,
									payload: alumno,
									payloadHash: hashPayload(alumno),
								});
							}
						}
						await this.rawMatriculaRepository.bulkInsert(rows);
						stats.counts.matricula += rows.length;
					} catch (error) {
						if (error instanceof SessionExpiredError) throw error;
						stats.errors.push({
							step: 'matricula',
							key: `${nrcChunk[0]}..${nrcChunk[nrcChunk.length - 1]}`,
							message: (error as Error).message,
						});
					}
				}),
			),
		);

		return { codigos: [...codigos], enrollments };
	}

	private async scrapeAlumnos(
		runId: string,
		nivel: string,
		codigos: string[],
		stats: ScrapeStats,
		limit: Limiter,
	): Promise<void> {
		const buffer = new InsertBuffer<RawAlumnoInsert>(INSERT_BATCH_SIZE, (rows) =>
			this.rawAlumnoRepository.bulkInsert(rows),
		);

		await Promise.all(
			codigos.map((codigoAlumno) =>
				limit(async () => {
					try {
						const json = await this.http.get<{ detalle?: { listaAlumnos?: unknown } }>(
							'/Alumno/Listado',
							{ nivel, codigoAlumno, pagina: '1' },
						);
						const alumno = asArray<Record<string, unknown>>(json.detalle?.listaAlumnos)[0];
						if (!alumno) return;
						await buffer.add({
							runId,
							nivel,
							codigoAlumno,
							payload: alumno,
							payloadHash: hashPayload(alumno),
						});
						stats.counts.alumno += 1;
					} catch (error) {
						if (error instanceof SessionExpiredError) throw error;
						stats.errors.push({
							step: 'alumno',
							key: codigoAlumno,
							message: (error as Error).message,
						});
					}
				}),
			),
		);

		await buffer.flush();
	}

	private async scrapeNotas(
		runId: string,
		nivel: string,
		periodo: string,
		pairs: NotaPair[],
		stats: ScrapeStats,
		limit: Limiter,
	): Promise<void> {
		const buffer = new InsertBuffer<RawNotasInsert>(INSERT_BATCH_SIZE, (rows) =>
			this.rawNotasRepository.bulkInsert(rows),
		);

		await Promise.all(
			pairs.map((pair) =>
				limit(async () => {
					try {
						const path =
							`/alumno/notaactual/notas/${encodeURIComponent(pair.codigoAlumno)}` +
							`/${encodeURIComponent(`${nivel}-${periodo}`)}/${encodeURIComponent(pair.cursoCodigo)}`;
						const json = await this.http.get<{
							detalle?: { notaFinal?: unknown; notas?: unknown };
						}>(path, {});
						const detalle = json.detalle;
						// No grades yet for this (alumno, curso) — skip, don't store an empty row.
						if (!detalle || (detalle.notaFinal == null && !detalle.notas)) return;

						await buffer.add({
							runId,
							nivel,
							periodo,
							codigoAlumno: pair.codigoAlumno,
							cursoCodigo: pair.cursoCodigo,
							payload: json,
							payloadHash: hashPayload(json),
						});
						stats.counts.nota += 1;
					} catch (error) {
						if (error instanceof SessionExpiredError) throw error;
						stats.errors.push({
							step: 'nota',
							key: `${pair.codigoAlumno}/${pair.cursoCodigo}`,
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

// Join enrollments -> course code by NRC, deduped to unique (alumno, curso) pairs.
function buildNotaPairs(enrollments: Enrollment[], courseByNrc: Map<string, string>): NotaPair[] {
	const pairs: NotaPair[] = [];
	const seen = new Set<string>();
	for (const enrollment of enrollments) {
		const cursoCodigo = courseByNrc.get(enrollment.nrc);
		if (!cursoCodigo) continue;
		const key = `${enrollment.codigoAlumno}|${cursoCodigo}`;
		if (seen.has(key)) continue;
		seen.add(key);
		pairs.push({ codigoAlumno: enrollment.codigoAlumno, cursoCodigo });
	}
	return pairs;
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
