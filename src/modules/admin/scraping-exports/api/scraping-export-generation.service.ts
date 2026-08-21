import { Injectable, Logger } from '@nestjs/common';

import { ConflictError } from 'src/commons/domain-error';

import { ScrapeRunRepository } from '../../banner/raw/core/scrape-run.repository';
import { PlannerScrapeRunRepository } from '../../planner/raw/core/planner-scrape-run.repository';
import { ScrapingExportRunRepository } from '../core/scraping-export-run.repository';
import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { ScrapingExportRunEntity } from '../model/scraping-export-run.entity';
import { ScrapingExportStatusResponse, ScrapingExportType } from '../model/scraping-exports.types';
import { staffExportLabels } from '../model/scraping-exports.labels';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';
import { GeneratedExcel, ScrapingExportsService } from './scraping-exports.service';

// Every export is generated once per language a downloaded file can be labeled in. Derived from
// the labels map (rather than hardcoded) so this stays in sync with whatever langs the export
// templates actually support — see model/scraping-exports.labels.ts.
const SUPPORTED_EXPORT_LANGS = Object.keys(staffExportLabels);

// The four exports built straight from a completed Banner scrape. `gradesRc` is deliberately
// excluded here: it depends on a completed Planner run too (see triggerForBannerRun) and its
// generation is wired in Milestone 6.
const BANNER_EXPORT_TYPES: Array<Exclude<ScrapingExportType, 'gradesRc'>> = [
	'staff',
	'sections',
	'enrolledStudents',
	'studentSections',
];

// Comfortably above Grades RC's documented multi-minute merge (see design.md § AC-9), so a
// generation that is still genuinely running is never mistaken for stale.
export const GENERATION_STALE_TIMEOUT_MS = 20 * 60 * 1000;

type DownloadResult = { fileName: string; fileBytes: Buffer };

// Discriminates the gradesRc single-flight "slot taken" signal from any other generation
// failure without comparing `error.message` against an i18n key string (AF-9). Module-private:
// nothing outside this file needs to catch it.
class GradesRcMergeBusyError extends Error {}

/**
 * Orchestrates generation of the persisted scraping exports (`core.scraping_export_runs`).
 * Replaces rebuilding an export on every download: a completed scrape run triggers generation in
 * the background, the result is persisted, and status/download/regenerate serve from storage
 * instead of always running the underlying export query synchronously. See ADR-002.
 *
 * `period` is passed explicitly end-to-end rather than read from a request header, because
 * generation runs outside any HTTP request (triggered from the scraper services, or fire-and-
 * forget from `regenerate`) — see docs/CONTEXT.md "scope must survive every asynchronous hop".
 */
@Injectable()
export class ScrapingExportGenerationService {
	private readonly logger = new Logger(ScrapingExportGenerationService.name);

	// System-wide, not per-key: only gradesRc pins a pooled Postgres connection for the minutes the
	// merge takes, so a second concurrent merge (for a *different* period/lang) degrades the shared
	// DB for everyone else, not just this export. The other four export types have no such cost and
	// are not guarded by this flag. Restores the old JobRegistry-based flow's maxConcurrent=1
	// guarantee, which the per-key 'running' check alone does not provide.
	//
	// Stores *when* the slot was taken, not a bare boolean (AF-2): a merge that genuinely hangs
	// (never resolves or rejects) would otherwise leave the flag stuck `true` forever, permanently
	// blocking every future Grades RC generation until a process restart. `isGradesRcMergeInFlight()`
	// treats a slot held longer than `GENERATION_STALE_TIMEOUT_MS` as no longer in-flight, so it
	// self-heals on the same timeline the DB-row staleness check already uses.
	private gradesRcMergeStartedAt: number | null = null;

	constructor(
		private readonly runRepository: ScrapingExportRunRepository,
		private readonly exportsRepository: ScrapingExportsRepository,
		private readonly scrapeRunRepository: ScrapeRunRepository,
		private readonly plannerScrapeRunRepository: PlannerScrapeRunRepository,
		private readonly exportsService: ScrapingExportsService,
	) {}

	// Forward lookup for the controller: it only has the request-derived academicPeriodId header,
	// not the period code every method here is keyed on. Delegates straight to the repository —
	// this service does not touch the DB itself.
	async resolvePeriod(academicPeriodId: number): Promise<string | null> {
		return this.exportsRepository.resolvePeriodCode(academicPeriodId);
	}

	async triggerForBannerRun(period: string, bannerRunId: string): Promise<void> {
		for (const exportType of BANNER_EXPORT_TYPES) {
			for (const lang of SUPPORTED_EXPORT_LANGS) {
				this.fireAndForgetGenerate(exportType, period, lang, 'auto', bannerRunId);
			}
		}

		const plannerRuns = await this.plannerScrapeRunRepository.findByPeriod(period);
		const completedPlannerRun = plannerRuns.find((run) => run.status === 'completed');
		if (completedPlannerRun) {
			for (const lang of SUPPORTED_EXPORT_LANGS) {
				this.fireAndForgetGenerate(
					'gradesRc',
					period,
					lang,
					'auto',
					bannerRunId,
					completedPlannerRun.id,
				);
			}
		}
	}

	// No Planner-only sync export exists today: Planner data only ever feeds gradesRc, and only
	// once a Banner run for the same period has also completed.
	async triggerForPlannerRun(period: string, plannerRunId: string): Promise<void> {
		const bannerRuns = await this.scrapeRunRepository.findByPeriod(period);
		const completedBannerRun = bannerRuns.find((run) => run.status === 'completed');
		if (completedBannerRun) {
			for (const lang of SUPPORTED_EXPORT_LANGS) {
				this.fireAndForgetGenerate(
					'gradesRc',
					period,
					lang,
					'auto',
					completedBannerRun.id,
					plannerRunId,
				);
			}
		}
	}

	async regenerate(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
		triggeredBy: string,
	): Promise<ScrapingExportStatusResponse> {
		const { sourceBannerRunId, sourcePlannerRunId } = await this.resolveSourceRunIdsForRegenerate(
			exportType,
			period,
		);

		const claimed = await this.claimForGeneration(
			exportType,
			period,
			lang,
			triggeredBy,
			sourceBannerRunId,
			sourcePlannerRunId,
		);

		if (!claimed) {
			throw new ConflictError(scrapingExportsValidationStrings.error.alreadyGenerating);
		}

		this.fireAndForgetRunGeneration(exportType, period, lang, triggeredBy);

		return this.toStatusResponse(claimed);
	}

	// Manual regenerate has no "just-completed run" context to draw a source id from (unlike the
	// two auto-trigger paths), so it looks up whatever the latest completed run currently is. A
	// missing completed run is not an error here — per design.md's "download-while-stale"
	// philosophy, an export may still be regeneratable from stale-but-existing source data — so
	// this simply omits the source id it could not resolve rather than blocking the regenerate.
	private async resolveSourceRunIdsForRegenerate(
		exportType: ScrapingExportType,
		period: string,
	): Promise<{ sourceBannerRunId?: string; sourcePlannerRunId?: string }> {
		const bannerRuns = await this.scrapeRunRepository.findByPeriod(period);
		const sourceBannerRunId = bannerRuns.find((run) => run.status === 'completed')?.id;

		if (exportType !== 'gradesRc') {
			return { sourceBannerRunId };
		}

		const plannerRuns = await this.plannerScrapeRunRepository.findByPeriod(period);
		const sourcePlannerRunId = plannerRuns.find((run) => run.status === 'completed')?.id;

		return { sourceBannerRunId, sourcePlannerRunId };
	}

	async getStatus(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
	): Promise<ScrapingExportStatusResponse | { status: 'notGenerated' }> {
		const row = await this.runRepository.findByKey(exportType, period, lang);
		if (!row) return { status: 'notGenerated' };
		return this.toStatusResponse(await this.reconcileIfStale(row));
	}

	// Serves whatever `fileBytes` currently exist even while a regenerate is `running` — see
	// design.md's "Download-while-stale is intentional". Only returns null when there has never
	// been a successful generation for this key.
	async download(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
	): Promise<DownloadResult | null> {
		const row = await this.runRepository.findByKey(exportType, period, lang);
		if (!row) return null;

		const reconciled = await this.reconcileIfStale(row);
		if (!reconciled.fileBytes || !reconciled.fileName) return null;

		return { fileName: reconciled.fileName, fileBytes: reconciled.fileBytes };
	}

	// Used by the two auto-trigger paths (Banner/Planner run completion). Combines the claim and
	// the actual generation work in one fire-and-forget call: if the claim is lost (this exact key
	// is already running, or — for gradesRc — the system-wide merge slot is held elsewhere), that is
	// an expected, benign occurrence for an auto-trigger (e.g. two scrapes completing close
	// together), not an error, so it is logged and skipped rather than surfaced anywhere. The
	// trailing `.catch` is a defensive backstop so a rejection can never escape as an unhandled
	// promise rejection.
	private fireAndForgetGenerate(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
		triggeredBy: string = 'auto',
		sourceBannerRunId?: string,
		sourcePlannerRunId?: string,
	): void {
		void (async () => {
			const claimed = await this.claimForGeneration(
				exportType,
				period,
				lang,
				triggeredBy,
				sourceBannerRunId,
				sourcePlannerRunId,
			);
			if (!claimed) {
				this.logger.debug(`Skipped generating ${exportType}/${period}/${lang}: already in flight`);
				return;
			}
			await this.runGeneration(exportType, period, lang, triggeredBy);
		})().catch((error) => {
			this.logger.error(
				`Unexpected error generating ${exportType}/${period}/${lang}: ${
					error instanceof Error ? error.message : String(error)
				}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	// Fire-and-forget wrapper purely around `runGeneration`, for `regenerate()`: unlike
	// `fireAndForgetGenerate`, the caller here has already claimed the row synchronously (so it can
	// 409 immediately on a lost claim), so this does not claim again.
	private fireAndForgetRunGeneration(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
		triggeredBy: string,
	): void {
		void this.runGeneration(exportType, period, lang, triggeredBy).catch((error) => {
			this.logger.error(
				`Unexpected error generating ${exportType}/${period}/${lang}: ${
					error instanceof Error ? error.message : String(error)
				}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	// Checks whether this (exportType, period, lang) key — and, for gradesRc, the system-wide merge
	// slot — is free, and if so atomically (from this process's point of view — no `await` between
	// the check and the upsert) transitions the row to `'running'`. Returns `null` when the key (or
	// slot) is already claimed, leaving it to the caller to decide what that means: a 409 for
	// `regenerate()`, a silent skip for an auto-trigger. This is the only place a row is ever
	// upserted to `'running'` (AF-8) and the only gate a second concurrent claim for the same key
	// has to pass (AF-6).
	private async claimForGeneration(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
		triggeredBy: string,
		sourceBannerRunId?: string,
		sourcePlannerRunId?: string,
	): Promise<ScrapingExportRunEntity | null> {
		const existing = await this.runRepository.findByKey(exportType, period, lang);
		const reconciled = existing ? await this.reconcileIfStale(existing) : null;

		if (reconciled?.status === 'running') {
			return null;
		}

		// The per-key check above only catches a duplicate claim of this exact key. gradesRc
		// additionally needs the system-wide check: the merge slot could be held by a different
		// period/lang's generation right now.
		if (exportType === 'gradesRc' && this.isGradesRcMergeInFlight()) {
			return null;
		}

		return this.runRepository.upsertByKey(exportType, period, lang, {
			status: 'running',
			triggeredBy,
			errorMessage: null,
			startedAt: new Date(),
			updatedAt: new Date(),
			...(sourceBannerRunId !== undefined ? { sourceBannerRunId } : {}),
			...(sourcePlannerRunId !== undefined ? { sourcePlannerRunId } : {}),
		});
	}

	// Assumes the row was already claimed (transitioned to `'running'`) by the caller — runs the
	// actual generator and finalizes the row to `'completed'`/`'failed'`.
	private async runGeneration(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
		triggeredBy: string,
	): Promise<void> {
		try {
			const { buffer, fileName } = await this.runGenerator(exportType, period, lang);

			await this.runRepository.upsertByKey(exportType, period, lang, {
				status: 'completed',
				triggeredBy,
				fileName,
				fileBytes: buffer,
				errorMessage: null,
				finishedAt: new Date(),
				updatedAt: new Date(),
			});
		} catch (error) {
			this.logger.error(
				`Export generation failed (${exportType}/${period}/${lang}): ${
					error instanceof Error ? error.message : String(error)
				}`,
				error instanceof Error ? error.stack : undefined,
			);
			// The gradesRc single-flight guard throws a distinguishable error type so this row's
			// errorMessage tells the truth (another period's merge is holding the slot) instead of
			// the generic "generation failed" — the row still ends up 'failed' either way, and the
			// next scrape completion or manual regenerate retries it.
			const errorMessage =
				error instanceof GradesRcMergeBusyError
					? scrapingExportsValidationStrings.error.gradesRcBusy
					: scrapingExportsValidationStrings.error.generationFailed;
			await this.runRepository.upsertByKey(exportType, period, lang, {
				status: 'failed',
				triggeredBy,
				errorMessage,
				finishedAt: new Date(),
				updatedAt: new Date(),
			});
		}
	}

	private async runGenerator(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
	): Promise<GeneratedExcel> {
		if (exportType === 'gradesRc') {
			return this.runGradesRcMerge(period, lang);
		}

		const academicPeriodId = await this.exportsRepository.findAcademicPeriodIdByCode(period);
		if (academicPeriodId === null) {
			throw new Error(scrapingExportsValidationStrings.error.periodNotFound);
		}

		switch (exportType) {
			case 'staff':
				return this.exportsService.generateStaff(academicPeriodId, lang);
			case 'sections':
				return this.exportsService.generateSections(academicPeriodId, lang);
			case 'enrolledStudents':
				return this.exportsService.generateEnrolledStudents(academicPeriodId, lang);
			case 'studentSections':
				return this.exportsService.generateStudentSections(academicPeriodId, lang);
		}
	}

	private isGradesRcMergeInFlight(): boolean {
		return (
			this.gradesRcMergeStartedAt !== null &&
			Date.now() - this.gradesRcMergeStartedAt < GENERATION_STALE_TIMEOUT_MS
		);
	}

	// Only gradesRc pins a pooled connection for the minutes the merge takes (see design.md § AC-10),
	// so this is the one export type that needs a system-wide single-flight guard, not just the
	// per-key 'running' check every export type already gets from `claimForGeneration`.
	private async runGradesRcMerge(period: string, lang: string): Promise<GeneratedExcel> {
		if (this.isGradesRcMergeInFlight()) {
			// Reachable from the auto-trigger path, which has no caller to hand a 409 to — surfaced
			// as an ordinary generation failure (caught by runGeneration()'s try/catch) instead of
			// starting a second concurrent merge. The next scrape completion or manual regenerate
			// retries it naturally.
			throw new GradesRcMergeBusyError(scrapingExportsValidationStrings.error.gradesRcBusy);
		}

		this.gradesRcMergeStartedAt = Date.now();
		try {
			const academicPeriodId = await this.exportsRepository.findAcademicPeriodIdByCode(period);
			if (academicPeriodId === null) {
				throw new Error(scrapingExportsValidationStrings.error.periodNotFound);
			}
			return await this.exportsService.generateGradesRc(academicPeriodId, lang);
		} finally {
			this.gradesRcMergeStartedAt = null;
		}
	}

	// `status`/`regenerate` never hand back `fileBytes` — see ScrapingExportStatusResponse's own
	// comment. `download` reads `fileBytes` straight off the reconciled row itself, not through this.
	private toStatusResponse(row: ScrapingExportRunEntity): ScrapingExportStatusResponse {
		return {
			exportType: row.exportType,
			period: row.period,
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

		return this.runRepository.upsertByKey(row.exportType, row.period, row.lang, {
			status: 'failed',
			triggeredBy: row.triggeredBy,
			errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
			finishedAt: new Date(),
			updatedAt: new Date(),
		});
	}
}
