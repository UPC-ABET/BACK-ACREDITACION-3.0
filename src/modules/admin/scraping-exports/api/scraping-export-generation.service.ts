import { Injectable, Logger } from '@nestjs/common';

import { ConflictError } from 'src/commons/domain-error';

import { ScrapeRunRepository } from '../../banner/raw/core/scrape-run.repository';
import { PlannerScrapeRunRepository } from '../../planner/raw/core/planner-scrape-run.repository';
import { ScrapingExportRunRepository } from '../core/scraping-export-run.repository';
import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { ScrapingExportRunEntity } from '../model/scraping-export-run.entity';
import { ScrapingExportStatusResponse, ScrapingExportType } from '../model/scraping-exports.types';
import { docenteExportLabels } from '../model/scraping-exports.labels';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';
import { GeneratedExcel, ScrapingExportsService } from './scraping-exports.service';

// Every export is generated once per language a downloaded file can be labeled in. Derived from
// the labels map (rather than hardcoded) so this stays in sync with whatever langs the export
// templates actually support — see model/scraping-exports.labels.ts.
const SUPPORTED_EXPORT_LANGS = Object.keys(docenteExportLabels);

// The four exports built straight from a completed Banner scrape. `gradesRc` is deliberately
// excluded here: it depends on a completed Planner run too (see triggerForBannerRun) and its
// generation is wired in Milestone 6.
const BANNER_EXPORT_TYPES: Array<Exclude<ScrapingExportType, 'gradesRc'>> = [
	'docentes',
	'secciones',
	'alumnosMatriculados',
	'alumnosSecciones',
];

// Comfortably above Grades RC's documented multi-minute merge (see design.md § AC-9), so a
// generation that is still genuinely running is never mistaken for stale.
export const GENERATION_STALE_TIMEOUT_MS = 20 * 60 * 1000;

type DownloadResult = { fileName: string; fileBytes: Buffer };

/**
 * Orchestrates generation of the persisted scraping exports (`core.scraping_export_runs`).
 * Replaces rebuilding an export on every download: a completed scrape run triggers generation in
 * the background, the result is persisted, and status/download/regenerate serve from storage
 * instead of always running the underlying export query synchronously. See ADR-002.
 *
 * `periodo` is passed explicitly end-to-end rather than read from a request header, because
 * generation runs outside any HTTP request (triggered from the scraper services, or fire-and-
 * forget from `regenerate`) — see docs/CONTEXT.md "scope must survive every asynchronous hop".
 */
@Injectable()
export class ScrapingExportGenerationService {
	private readonly logger = new Logger(ScrapingExportGenerationService.name);

	// System-wide, not per-key: only gradesRc pins a pooled Postgres connection for the minutes the
	// merge takes, so a second concurrent merge (for a *different* periodo/lang) degrades the shared
	// DB for everyone else, not just this export. The other four export types have no such cost and
	// are not guarded by this flag. Restores the old JobRegistry-based flow's maxConcurrent=1
	// guarantee, which the per-key 'running' check alone does not provide.
	private gradesRcMergeInFlight = false;

	constructor(
		private readonly runRepository: ScrapingExportRunRepository,
		private readonly exportsRepository: ScrapingExportsRepository,
		private readonly scrapeRunRepository: ScrapeRunRepository,
		private readonly plannerScrapeRunRepository: PlannerScrapeRunRepository,
		private readonly exportsService: ScrapingExportsService,
	) {}

	// Forward lookup for the controller: it only has the request-derived academicPeriodId header,
	// not the periodo code every method here is keyed on. Delegates straight to the repository —
	// this service does not touch the DB itself.
	async resolvePeriodo(academicPeriodId: number): Promise<string | null> {
		return this.exportsRepository.resolvePeriodoCode(academicPeriodId);
	}

	async triggerForBannerRun(periodo: string): Promise<void> {
		for (const exportType of BANNER_EXPORT_TYPES) {
			for (const lang of SUPPORTED_EXPORT_LANGS) {
				this.fireAndForgetGenerate(exportType, periodo, lang);
			}
		}

		const plannerRuns = await this.plannerScrapeRunRepository.findByPeriodo(periodo);
		if (plannerRuns.some((run) => run.status === 'completed')) {
			for (const lang of SUPPORTED_EXPORT_LANGS) {
				this.fireAndForgetGenerate('gradesRc', periodo, lang);
			}
		}
	}

	// No Planner-only sync export exists today: Planner data only ever feeds gradesRc, and only
	// once a Banner run for the same periodo has also completed.
	async triggerForPlannerRun(periodo: string): Promise<void> {
		const bannerRuns = await this.scrapeRunRepository.findByPeriodo(periodo);
		if (bannerRuns.some((run) => run.status === 'completed')) {
			for (const lang of SUPPORTED_EXPORT_LANGS) {
				this.fireAndForgetGenerate('gradesRc', periodo, lang);
			}
		}
	}

	async regenerate(
		exportType: ScrapingExportType,
		periodo: string,
		lang: string,
		triggeredBy: string,
	): Promise<ScrapingExportStatusResponse> {
		const existing = await this.runRepository.findByKey(exportType, periodo, lang);
		const reconciled = existing ? await this.reconcileIfStale(existing) : null;

		if (reconciled?.status === 'running') {
			throw new ConflictError(scrapingExportsValidationStrings.error.alreadyGenerating);
		}

		// The per-key check above only catches a duplicate regenerate of this exact key. gradesRc
		// additionally needs the system-wide check: the merge slot could be held by a different
		// periodo/lang's generation right now. Same 409 semantic from the caller's point of view.
		if (exportType === 'gradesRc' && this.gradesRcMergeInFlight) {
			throw new ConflictError(scrapingExportsValidationStrings.error.alreadyGenerating);
		}

		const row = await this.runRepository.upsertByKey(exportType, periodo, lang, {
			status: 'running',
			triggeredBy,
			errorMessage: null,
			startedAt: new Date(),
			updatedAt: new Date(),
		});

		this.fireAndForgetGenerate(exportType, periodo, lang, triggeredBy);

		return this.toStatusResponse(row);
	}

	async getStatus(
		exportType: ScrapingExportType,
		periodo: string,
		lang: string,
	): Promise<ScrapingExportStatusResponse | { status: 'notGenerated' }> {
		const row = await this.runRepository.findByKey(exportType, periodo, lang);
		if (!row) return { status: 'notGenerated' };
		return this.toStatusResponse(await this.reconcileIfStale(row));
	}

	// Serves whatever `fileBytes` currently exist even while a regenerate is `running` — see
	// design.md's "Download-while-stale is intentional". Only returns null when there has never
	// been a successful generation for this key.
	async download(
		exportType: ScrapingExportType,
		periodo: string,
		lang: string,
	): Promise<DownloadResult | null> {
		const row = await this.runRepository.findByKey(exportType, periodo, lang);
		if (!row) return null;

		const reconciled = await this.reconcileIfStale(row);
		if (!reconciled.fileBytes || !reconciled.fileName) return null;

		return { fileName: reconciled.fileName, fileBytes: reconciled.fileBytes };
	}

	// Wrapper around `generate()` for the two fire-and-forget call sites (auto-trigger and
	// `regenerate`): `generate()` already never rejects internally, but this `.catch` is a
	// defensive backstop so a rejection can never escape as an unhandled promise rejection.
	private fireAndForgetGenerate(
		exportType: ScrapingExportType,
		periodo: string,
		lang: string,
		triggeredBy: string = 'auto',
	): void {
		void this.generate(exportType, periodo, lang, triggeredBy).catch((error) => {
			this.logger.error(
				`Unexpected error generating ${exportType}/${periodo}/${lang}: ${
					error instanceof Error ? error.message : String(error)
				}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	private async generate(
		exportType: ScrapingExportType,
		periodo: string,
		lang: string,
		triggeredBy: string,
	): Promise<void> {
		await this.runRepository.upsertByKey(exportType, periodo, lang, {
			status: 'running',
			triggeredBy,
			errorMessage: null,
			startedAt: new Date(),
			updatedAt: new Date(),
		});

		try {
			const { buffer, fileName } = await this.runGenerator(exportType, periodo, lang);

			await this.runRepository.upsertByKey(exportType, periodo, lang, {
				status: 'completed',
				fileName,
				fileBytes: buffer,
				errorMessage: null,
				finishedAt: new Date(),
				updatedAt: new Date(),
			});
		} catch (error) {
			this.logger.error(
				`Export generation failed (${exportType}/${periodo}/${lang}): ${
					error instanceof Error ? error.message : String(error)
				}`,
				error instanceof Error ? error.stack : undefined,
			);
			// The gradesRc single-flight guard throws with a distinguishable message so this row's
			// errorMessage tells the truth (another period's merge is holding the slot) instead of
			// the generic "generation failed" — the row still ends up 'failed' either way, and the
			// next scrape completion or manual regenerate retries it.
			const errorMessage =
				error instanceof Error &&
				error.message === scrapingExportsValidationStrings.error.gradesRcBusy
					? scrapingExportsValidationStrings.error.gradesRcBusy
					: scrapingExportsValidationStrings.error.generationFailed;
			await this.runRepository.upsertByKey(exportType, periodo, lang, {
				status: 'failed',
				errorMessage,
				finishedAt: new Date(),
				updatedAt: new Date(),
			});
		}
	}

	private async runGenerator(
		exportType: ScrapingExportType,
		periodo: string,
		lang: string,
	): Promise<GeneratedExcel> {
		if (exportType === 'gradesRc') {
			return this.runGradesRcMerge(periodo, lang);
		}

		const academicPeriodId = await this.exportsRepository.findAcademicPeriodIdByCode(periodo);

		switch (exportType) {
			case 'docentes':
				return this.exportsService.generateDocentes(academicPeriodId, lang);
			case 'secciones':
				return this.exportsService.generateSecciones(academicPeriodId, lang);
			case 'alumnosMatriculados':
				return this.exportsService.generateAlumnosMatriculados(academicPeriodId, lang);
			case 'alumnosSecciones':
				return this.exportsService.generateAlumnosSecciones(academicPeriodId, lang);
		}
	}

	// Only gradesRc pins a pooled connection for the minutes the merge takes (see design.md § AC-10),
	// so this is the one export type that needs a system-wide single-flight guard, not just the
	// per-key 'running' check `generate()` already does for every export type.
	private async runGradesRcMerge(periodo: string, lang: string): Promise<GeneratedExcel> {
		if (this.gradesRcMergeInFlight) {
			// Reachable from the auto-trigger path, which has no caller to hand a 409 to — surfaced
			// as an ordinary generation failure (caught by generate()'s try/catch) instead of
			// starting a second concurrent merge. The next scrape completion or manual regenerate
			// retries it naturally.
			throw new Error(scrapingExportsValidationStrings.error.gradesRcBusy);
		}

		this.gradesRcMergeInFlight = true;
		try {
			const academicPeriodId = await this.exportsRepository.findAcademicPeriodIdByCode(periodo);
			if (academicPeriodId === null) {
				throw new Error(scrapingExportsValidationStrings.error.periodNotFound);
			}
			return await this.exportsService.generateGradesRc(academicPeriodId, lang);
		} finally {
			this.gradesRcMergeInFlight = false;
		}
	}

	// `status`/`regenerate` never hand back `fileBytes` — see ScrapingExportStatusResponse's own
	// comment. `download` reads `fileBytes` straight off the reconciled row itself, not through this.
	private toStatusResponse(row: ScrapingExportRunEntity): ScrapingExportStatusResponse {
		return {
			exportType: row.exportType,
			periodo: row.periodo,
			lang: row.lang,
			status: row.status,
			fileName: row.fileName,
			errorMessage: row.errorMessage,
			startedAt: row.startedAt,
			finishedAt: row.finishedAt,
		};
	}

	// Runs on every read (`getStatus`/`download`/`regenerate`) instead of a background sweep —
	// `docs/POLICIES.md` rules out adding `@nestjs/schedule`. A `running` row whose `updatedAt`
	// is older than `GENERATION_STALE_TIMEOUT_MS` means the process that was generating it died
	// mid-flight (e.g. a deploy), so it is flipped to `failed` right here, on read.
	private async reconcileIfStale(row: ScrapingExportRunEntity): Promise<ScrapingExportRunEntity> {
		if (row.status !== 'running') return row;

		const updatedAtMs = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
		if (Date.now() - updatedAtMs < GENERATION_STALE_TIMEOUT_MS) return row;

		return this.runRepository.upsertByKey(row.exportType, row.periodo, row.lang, {
			status: 'failed',
			errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
			finishedAt: new Date(),
			updatedAt: new Date(),
		});
	}
}
