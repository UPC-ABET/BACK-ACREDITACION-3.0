import { Injectable, Logger } from '@nestjs/common';

import { ConflictError } from 'src/commons/domain-error';

import { ScrapeRunRepository } from '../../banner/raw/core/scrape-run.repository';
import { PlannerScrapeRunRepository } from '../../planner/raw/core/planner-scrape-run.repository';
import {
	ScrapingExportRunRepository,
	ScrapingExportRunStatusFields,
} from '../core/scraping-export-run.repository';
import { ScrapingExportsRepository } from '../core/scraping-exports.repository';
import { ScrapingExportRunEntity } from '../model/scraping-export-run.entity';
import {
	GradeRcExportRow,
	ScrapingExportStatusResponse,
	ScrapingExportType,
} from '../model/scraping-exports.types';
import { getDefaultExportFileName } from '../model/scraping-exports.labels';
import { scrapingExportsValidationStrings } from '../config/strings/scraping-exports.validation';
import { GeneratedExcel, ScrapingExportsService } from './scraping-exports.service';

// The four exports built straight from a completed Banner scrape. `gradesRc` is deliberately
// excluded here: it depends on a completed Planner run too (see triggerForBannerRun) and its
// generation is wired separately below.
const BANNER_EXPORT_TYPES: Array<Exclude<ScrapingExportType, 'gradesRc'>> = [
	'staff',
	'sections',
	'enrolledStudents',
	'studentSections',
];

// Comfortably above Grades RC's documented multi-minute merge (see design.md § AC-9), so a
// generation that is still genuinely running is never mistaken for stale.
export const GENERATION_STALE_TIMEOUT_MS = 20 * 60 * 1000;

// ~3x the largest known real period (202610: 52,387 rows) at design time. A future period past
// this is not blocked -- ADR-004 accepts the storage risk -- but should be visible in logs before
// it becomes an incident.
export const GRADES_RC_ROW_COUNT_WARNING_THRESHOLD = 150_000;

// Discriminates the gradesRc single-flight "slot taken" signal from any other generation
// failure without comparing `error.message` against an i18n key string (AF-9). Module-private:
// nothing outside this file needs to catch it.
class GradesRcMergeBusyError extends Error {}

/**
 * Orchestrates generation of the persisted scraping exports (`core.scraping_export_runs`).
 * Generation is keyed on `(exportType, period)` only — language is applied only when a file is
 * rendered for `download`, never at generation time. See ADR-003, which supersedes ADR-002's
 * per-language file storage.
 *
 * `period` is passed explicitly end-to-end rather than read from a request header, because
 * generation runs outside any HTTP request (triggered from the scraper services, or fire-and-
 * forget from `regenerate`) — see docs/CONTEXT.md "scope must survive every asynchronous hop".
 */
@Injectable()
export class ScrapingExportGenerationService {
	private readonly logger = new Logger(ScrapingExportGenerationService.name);

	// System-wide, not per-key: only gradesRc pins a pooled Postgres connection for the minutes the
	// merge takes, so a second concurrent merge (for a *different* period) degrades the shared DB
	// for everyone else, not just this export. The other four export types have no such cost and
	// are not guarded by this flag.
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
			this.fireAndForgetGenerate(exportType, period, 'auto', bannerRunId);
		}

		const plannerRuns = await this.plannerScrapeRunRepository.findByPeriod(period);
		const completedPlannerRun = plannerRuns.find((run) => run.status === 'completed');
		if (completedPlannerRun) {
			this.fireAndForgetGenerate('gradesRc', period, 'auto', bannerRunId, completedPlannerRun.id);
		}
	}

	// No Planner-only sync export exists today: Planner data only ever feeds gradesRc, and only
	// once a Banner run for the same period has also completed.
	async triggerForPlannerRun(period: string, plannerRunId: string): Promise<void> {
		const bannerRuns = await this.scrapeRunRepository.findByPeriod(period);
		const completedBannerRun = bannerRuns.find((run) => run.status === 'completed');
		if (completedBannerRun) {
			this.fireAndForgetGenerate('gradesRc', period, 'auto', completedBannerRun.id, plannerRunId);
		}
	}

	async regenerate(
		exportType: ScrapingExportType,
		period: string,
		triggeredBy: string,
	): Promise<ScrapingExportStatusResponse> {
		const { sourceBannerRunId, sourcePlannerRunId } = await this.resolveSourceRunIdsForRegenerate(
			exportType,
			period,
		);

		const claimed = await this.claimForGeneration(
			exportType,
			period,
			triggeredBy,
			sourceBannerRunId,
			sourcePlannerRunId,
		);

		if (!claimed) {
			throw new ConflictError(scrapingExportsValidationStrings.error.alreadyGenerating);
		}

		this.fireAndForgetRunGeneration(exportType, period, triggeredBy, claimed.id);

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
	): Promise<ScrapingExportStatusResponse | { status: 'notGenerated' }> {
		const row = await this.runRepository.findStatusByKey(exportType, period);
		if (!row) return { status: 'notGenerated' };
		return this.toStatusResponse(await this.reconcileIfStale(row));
	}

	// Serves whatever data currently exists even while a regenerate is `running` — see
	// design.md's "Download-while-stale is intentional". Renders the requested `lang` from
	// whatever was already fetched/materialized at generation time — never re-queries the raw
	// datasource or reruns the gradesRc merge. Returns null only when there has never been a
	// successful generation for this key.
	async download(
		exportType: ScrapingExportType,
		period: string,
		lang: string,
	): Promise<GeneratedExcel | null> {
		const row = await this.runRepository.findByKey(exportType, period);
		if (!row) return null;

		const reconciled = await this.reconcileIfStale(row);
		if (!reconciled.rowsData) return null;

		if (exportType === 'gradesRc') {
			return this.exportsService.renderGradesRc(
				reconciled.rowsData as Array<GradeRcExportRow & { hasObservations: boolean }>,
				lang,
			);
		}
		return this.renderSyncExport(exportType, reconciled.rowsData, lang);
	}

	private renderSyncExport(
		exportType: Exclude<ScrapingExportType, 'gradesRc'>,
		rows: unknown[],
		lang: string,
	): Promise<GeneratedExcel> {
		switch (exportType) {
			case 'staff':
				return this.exportsService.renderStaffExcel(rows as never, lang);
			case 'sections':
				return this.exportsService.renderSectionsExcel(rows as never, lang);
			case 'enrolledStudents':
				return this.exportsService.renderEnrolledStudentsExcel(rows as never, lang);
			case 'studentSections':
				return this.exportsService.renderStudentSectionsExcel(rows as never, lang);
		}
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
		triggeredBy: string = 'auto',
		sourceBannerRunId?: string,
		sourcePlannerRunId?: string,
	): void {
		void (async () => {
			const claimed = await this.claimForGeneration(
				exportType,
				period,
				triggeredBy,
				sourceBannerRunId,
				sourcePlannerRunId,
			);
			if (!claimed) {
				this.logger.debug(`Skipped generating ${exportType}/${period}: already in flight`);
				return;
			}
			await this.runGeneration(exportType, period, triggeredBy, claimed.id);
		})().catch((error) => {
			this.logger.error(
				`Unexpected error generating ${exportType}/${period}: ${
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
		triggeredBy: string,
		runId: number,
	): void {
		void this.runGeneration(exportType, period, triggeredBy, runId).catch((error) => {
			this.logger.error(
				`Unexpected error generating ${exportType}/${period}: ${
					error instanceof Error ? error.message : String(error)
				}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	// Checks whether this (exportType, period) key — and, for gradesRc, the system-wide merge
	// slot — is free, and if so atomically (from this process's point of view — no `await` between
	// the check and the upsert) transitions the row to `'running'`. Returns `null` when the key (or
	// slot) is already claimed, leaving it to the caller to decide what that means: a 409 for
	// `regenerate()`, a silent skip for an auto-trigger. This is the only place a row is ever
	// upserted to `'running'` (AF-8) and the only gate a second concurrent claim for the same key
	// has to pass (AF-6).
	private async claimForGeneration(
		exportType: ScrapingExportType,
		period: string,
		triggeredBy: string,
		sourceBannerRunId?: string,
		sourcePlannerRunId?: string,
	): Promise<ScrapingExportRunEntity | null> {
		const existing = await this.runRepository.findStatusByKey(exportType, period);
		const reconciled = existing ? await this.reconcileIfStale(existing) : null;

		if (reconciled?.status === 'running') {
			return null;
		}

		// The per-key check above only catches a duplicate claim of this exact key. gradesRc
		// additionally needs the system-wide check: the merge slot could be held by a different
		// period's generation right now.
		if (exportType === 'gradesRc' && this.isGradesRcMergeInFlight()) {
			return null;
		}

		return this.runRepository.upsertByKey(exportType, period, {
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
		triggeredBy: string,
		runId: number,
	): Promise<void> {
		try {
			if (exportType === 'gradesRc') {
				await this.runGradesRcGeneration(period, runId, triggeredBy);
				return;
			}

			const academicPeriodId = await this.exportsRepository.findAcademicPeriodIdByCode(period);
			if (academicPeriodId === null) {
				throw new Error(scrapingExportsValidationStrings.error.periodNotFound);
			}
			const rows = await this.fetchSyncExportRows(exportType, academicPeriodId);

			await this.runRepository.upsertByKeyNoReturn(exportType, period, {
				status: 'completed',
				triggeredBy,
				rowsData: rows,
				errorMessage: null,
				finishedAt: new Date(),
				updatedAt: new Date(),
			});
		} catch (error) {
			this.logger.error(
				`Export generation failed (${exportType}/${period}): ${
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
			await this.runRepository.upsertByKeyNoReturn(exportType, period, {
				status: 'failed',
				triggeredBy,
				errorMessage,
				finishedAt: new Date(),
				updatedAt: new Date(),
			});
		}
	}

	private fetchSyncExportRows(
		exportType: Exclude<ScrapingExportType, 'gradesRc'>,
		academicPeriodId: number,
	): Promise<unknown[]> {
		switch (exportType) {
			case 'staff':
				return this.exportsService.fetchStaffRows(academicPeriodId);
			case 'sections':
				return this.exportsService.fetchSectionRows(academicPeriodId);
			case 'enrolledStudents':
				return this.exportsService.fetchEnrolledStudentRows(academicPeriodId);
			case 'studentSections':
				return this.exportsService.fetchStudentSectionRows(academicPeriodId);
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
	// per-key 'running' check every export type already gets from `claimForGeneration`. Otherwise
	// this mirrors the non-gradesRc branch of `runGeneration` exactly: one `rowsData` write, atomic
	// by virtue of being a single row (see ADR-004) -- no separate batch/retention step needed.
	private async runGradesRcGeneration(
		period: string,
		runId: number,
		triggeredBy: string,
	): Promise<void> {
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

			const rows = await this.exportsService.fetchGradesRcRows(academicPeriodId);
			if (rows.length > GRADES_RC_ROW_COUNT_WARNING_THRESHOLD) {
				this.logger.warn(
					`gradesRc/${period} produced ${rows.length} rows, above the documented threshold ` +
						`of ${GRADES_RC_ROW_COUNT_WARNING_THRESHOLD} (see ADR-004).`,
				);
			}

			await this.runRepository.upsertByKeyNoReturn('gradesRc', period, {
				status: 'completed',
				triggeredBy,
				rowsData: rows,
				errorMessage: null,
				finishedAt: new Date(),
				updatedAt: new Date(),
			});
		} finally {
			this.gradesRcMergeStartedAt = null;
		}
	}

	// `status`/`regenerate` never hand back a downloadable file — see ScrapingExportStatusResponse's
	// own comment. `download` is the only endpoint that ever renders and streams bytes. `fileName`
	// is a readiness signal only (always the default-language name), present exactly when `status`
	// is 'completed'.
	private toStatusResponse(row: ScrapingExportRunStatusFields): ScrapingExportStatusResponse {
		return {
			exportType: row.exportType,
			period: row.period,
			status: row.status,
			fileName: row.status === 'completed' ? getDefaultExportFileName(row.exportType) : null,
			errorMessage: row.errorMessage,
			startedAt: row.startedAt,
			finishedAt: row.finishedAt,
		};
	}

	// Runs on every read (`getStatus`/`download`/`regenerate`) instead of a background sweep —
	// `docs/POLICIES.md` rules out adding `@nestjs/schedule`. A `running` row whose `updatedAt`
	// is older than `GENERATION_STALE_TIMEOUT_MS` means the process that was generating it died
	// mid-flight (e.g. a deploy), so it is flipped to `failed` right here, on read.
	//
	// Generic over the caller's input shape (T), but the stale branch always returns the *full*
	// entity: it flips status via `upsertByKey`, whose read-back is never the lightweight
	// `findStatusByKey` variant, since `download` also reaches this method and genuinely needs
	// `rowsData` back. Accepted trade-off: `getStatus`/`claimForGeneration` only pay that full
	// read's cost on the rare row that is both `running` and stale (a real mid-generation crash,
	// not routine polling) — not on every call, which was round 1's actual finding.
	private async reconcileIfStale<T extends ScrapingExportRunStatusFields>(
		row: T,
	): Promise<T | ScrapingExportRunEntity> {
		if (row.status !== 'running') return row;

		const updatedAtMs = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
		if (Date.now() - updatedAtMs < GENERATION_STALE_TIMEOUT_MS) return row;

		return this.runRepository.upsertByKey(row.exportType, row.period, {
			status: 'failed',
			triggeredBy: row.triggeredBy,
			errorMessage: scrapingExportsValidationStrings.error.staleGenerationDetected,
			finishedAt: new Date(),
			updatedAt: new Date(),
		});
	}
}
