# Design — Scrape Data Retention and Cached Scraping Exports

**Slug**: `scrape-retention-and-cached-exports`
**Proposal**: `./proposal.md`

## Read first

- `docs/CONTEXT.md` § Database — two datasources (main vs `raw`/`planner-raw`), schema table
- `docs/CONTEXT.md` § Business Rules — "scope must survive every asynchronous hop"
- `docs/POLICIES.md` § Migrations, § Entity Rules, § Database Access (Repository Boundary),
  § Auth & Guards, § i18n Key Convention, § The API spec is a committed artifact
- `docs/adr/ADR-002-persisted-pollable-scraping-export-generation.md` — why generation state
  is persisted in Postgres instead of kept in `JobRegistry` or moved to S3
- `src/modules/admin/banner/raw/model/scrape-run.entity.ts`,
  `src/modules/admin/banner/raw/core/scrape-run.repository.ts`,
  `src/modules/admin/banner/scraper/api/scraper.service.ts` — Banner run lifecycle and the
  `finish()` hook point
- `src/modules/admin/planner/raw/model/planner-scrape-run.entity.ts` and its scraper
  service/repository — Planner mirror of the above
- `src/modules/admin/scraping-exports/` — current synchronous export builds, the
  `RUN_FOR_PERIOD` CTE, and the Grades RC `JobRegistry` usage being replaced
- `src/modules/survey/shared/core/job-registry.ts` — the in-memory pattern this change
  generalizes into a persisted equivalent, not reuses directly

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Datastore, broker or cache choice             | Partially — assessed in ADR-002 (bytea in existing Postgres, not a new datastore; S3 explicitly declined for this change)                |
| Auth or payments provider                     | No                                                                                                                                       |
| Public API contract change or breaking change | **Yes** — see ADR-002                                                                                                                    |
| New module boundary or cross-repo split       | No — reuses the existing `admin/scraping-exports` module; the frontend pairing was already the working cross-repo pattern, not a new one |
| Language, runtime or framework                | No                                                                                                                                       |
| Contradicting an existing ADR                 | No — ADR-001 (scraper credential encryption) is untouched                                                                                |

**Conclusion**: ADR required and written —
[ADR-002](../../../docs/adr/ADR-002-persisted-pollable-scraping-export-generation.md).

## Approach

### AC-1 / AC-2 — delete the superseded run's raw rows per period

Both Banner and Planner raw tables already carry a `runId` FK to `scrape_run` /
`planner_scrape_run` with `onDelete: 'CASCADE'`. Deleting the `scrape_run` row is
therefore sufficient — Postgres cascades the delete to every raw child table in one
statement, no per-table deletes needed.

**Scoping correction from the proposal**: the proposal said "same
`periodo`/`departamentos` scope" (Banner) and "same `periodo`/`escuela` scope" (Planner).
Reading the actual repositories shows this isn't reliable: `ScrapeRunRepository.findByPeriodo`
filters on `periodo` alone (ignoring `nivel`/`departamentos`), and Planner's `escuela` column
is hard-coded `null` by `run()` today — never actually populated. **Retention is keyed on
`periodo` alone**, independently for Banner and Planner. This is a refinement discovered
during design, not a scope change — the proposal's intent ("latest-only per period") is
still satisfied; the extra dimensions in its wording just don't correspond to anything the
code currently tracks.

New repository methods, `ScrapeRunRepository` (mirrored in `PlannerScrapeRunRepository`):

```typescript
deleteRun(id: string): Promise<void>;                              // DELETE FROM scrape_run WHERE id = $1
deleteOtherRunsForPeriodo(periodo: string, keepRunId: string): Promise<void>;
  // DELETE FROM scrape_run WHERE periodo = $1 AND id != $2
```

`ScraperService.execute()` (and the Planner equivalent) call these right after the existing
`finish()` call — both the success and catch branches already converge on `finish()`, so this
is a single new step, not two:

```typescript
await this.scrapeRunRepository.finish(runId, status, stats);
if (status === 'completed') {
	await this.scrapeRunRepository.deleteOtherRunsForPeriodo(periodo, runId);
	void this.exportGenerationService.triggerForBannerRun(periodo); // fire-and-forget, see AC-4
} else {
	await this.scrapeRunRepository.deleteRun(runId);
}
```

### AC-3 — partial/failed runs clean up their own leftovers

Covered by the same block above: a run that finishes `'partial'`, `'failed'` or `'expired'`
deletes only itself (`deleteRun(runId)`), never touching whatever completed run currently
exists for that period. A run that finishes `'completed'` deletes every _other_ row for that
period — which also mops up any partial/failed leftovers that a previous, non-fatal run left
behind, without a second code path.

### AC-4 / AC-5 — auto-trigger generation on completion, serve from storage

New table `core.scraping_export_runs` (entity `ScrapingExportRunEntity`,
`src/modules/admin/scraping-exports/model/scraping-export-run.entity.ts`), one row per
`(exportType, periodo, lang)`:

| Column               | Type (custom decorator)                      | Notes                                                                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `exportType`         | `@TextShortColumn()`                         | `'docentes' \| 'secciones' \| 'alumnosMatriculados' \| 'alumnosSecciones' \| 'gradesRc'` — plain string column with a TS union type, mirroring `ScrapeRunEntity.status`'s own precedent rather than a `core.types` row, since adding an export type already requires a new generator method in code |
| `periodo`            | `@TextShortColumn()`                         | matches `scrape_run.periodo`                                                                                                                                                                                                                                                                        |
| `lang`               | `@TextShortColumn()`                         | e.g. `'es' \| 'en'` — must be part of the key because `resolveLabels()` makes the generated file language-dependent; confirm the exact supported set against `model/scraping-exports.labels.ts` at implementation time                                                                              |
| `status`             | `@TextShortColumn()`                         | `'pending' \| 'running' \| 'completed' \| 'failed'`                                                                                                                                                                                                                                                 |
| `fileName`           | `@TextShortColumn({ withDefault: false })`   | nullable until first success                                                                                                                                                                                                                                                                        |
| `fileBytes`          | `@BinaryColumn()` (new decorator, see below) | nullable until first success                                                                                                                                                                                                                                                                        |
| `errorMessage`       | `@TextMediumColumn({ withDefault: false })`  | i18n key, nullable                                                                                                                                                                                                                                                                                  |
| `sourceBannerRunId`  | `@TextShortColumn({ withDefault: false })`   | soft reference, see below                                                                                                                                                                                                                                                                           |
| `sourcePlannerRunId` | `@TextShortColumn({ withDefault: false })`   | soft reference, see below                                                                                                                                                                                                                                                                           |
| `triggeredBy`        | `@TextShortColumn()`                         | `'auto'` or the acting user's identifier, mirrors `scrape_run.triggeredBy`                                                                                                                                                                                                                          |
| `startedAt`          | `@DateColumn({ withDefault: false })`        | nullable                                                                                                                                                                                                                                                                                            |
| `finishedAt`         | `@DateColumn({ withDefault: false })`        | nullable                                                                                                                                                                                                                                                                                            |

Plus `BaseEntity`'s `id`/`extra`/`is_active`/`created_at`/`updated_at`.
`@Unique('UQ_scraping_export_runs_export_type_periodo_lang', ['exportType', 'periodo', 'lang'])`.

**`sourceBannerRunId`/`sourcePlannerRunId` are plain text columns, not real foreign keys.**
`scrape_run`/`planner_scrape_run` live on the separate `raw`/`planner-raw` datasource
connections — Postgres cannot enforce a FK across two different database connections. This is
a deliberate, documented exception to "every FK uses `@JoinColumn`", not an oversight; see
ADR-002.

**`@BinaryColumn()` is a new decorator**, added to `src/commons/configs/db.configs.ts`
alongside the existing set (`bytea`, nullable, no default) — the current decorator list has
no binary-data type, and this table is the first entity in the codebase that needs one.
Base64-encoding into `@TextFullColumn()` was considered and rejected: it inflates storage
~33% and buys nothing over a native `bytea` column.

Schema choice: `core`, alongside `core.scraper_credentials` — the closest existing precedent
for "scraper-adjacent operational state that isn't itself scraped domain data."

**Generation orchestration** — new `ScrapingExportGenerationService`
(`src/modules/admin/scraping-exports/api/scraping-export-generation.service.ts`), exported
from `ScrapingExportsModule` (which `BannerModule`/`PlannerModule` import — safe direction,
`ScrapingExportsModule` does not import either of them, so no circular dependency):

```typescript
triggerForBannerRun(periodo: string): Promise<void>;
  // upserts pending/running rows and generates: docentes, secciones,
  // alumnosMatriculados, alumnosSecciones for every supported lang;
  // then checks PlannerScrapeRunRepository for a completed run at the same
  // periodo — if found, also triggers gradesRc.
triggerForPlannerRun(periodo: string): Promise<void>;
  // no Planner-only sync export exists today; only checks ScrapeRunRepository
  // for a completed Banner run at the same periodo and, if found, triggers gradesRc.
regenerate(exportType, periodo, lang, triggeredBy): Promise<ScrapingExportRunEntity>;
  // manual path (AC-7); throws ConflictError (error.scrapingExports.alreadyGenerating)
  // if the current row for that key is already 'running'.
getStatus(exportType, periodo, lang): Promise<ScrapingExportRunEntity | { status: 'notGenerated' }>;
download(exportType, periodo, lang): Promise<{ fileName: string; fileBytes: Buffer } | null>;
```

Internally, a private `generate(exportType, periodo, lang, source)` upserts the row to
`'running'`, calls the existing `ScrapingExportsService.generateXxx()` method (Banner exports)
or the Grades RC merge (see AC-10), and on success/failure upserts `'completed'`/`'failed'`
with the result or `errorMessage`. This runs fire-and-forget from both the auto-trigger path
and the manual `regenerate` endpoint — the caller gets back the row's current state
immediately, generation continues in the background, exactly matching how
`runGradesRcExport()` already behaves today.

**Download-while-stale is intentional**: `download()` serves whatever `fileBytes` currently
exist, even if `status` is `'running'` from a fresh regenerate — it only returns "not
available" when there has never been a successful generation for that key. This avoids the
user losing access to a working file while a regenerate is in flight, and keeps the
implementation simple (no separate "serving" vs "building" version).

**Scope note**: the auto-trigger path runs outside any HTTP request — `periodo` is passed
explicitly through method arguments end-to-end, never read from a request-scoped header
inside the async job. This satisfies `docs/CONTEXT.md`'s "scope must survive every
asynchronous hop" concern by construction, since there is no implicit request-derived state
to lose.

**Correctness hardening required by this change**: `RUN_FOR_PERIOD`
(`scraping-exports.repository.ts`) currently resolves "latest run for period" by
`ORDER BY started_at DESC LIMIT 1` with **no `status` filter** — it can return a `'running'`
or `'failed'` run. Before this change that was a latent, narrow bug (a sync export request
racing an in-flight scrape). After this change it's a real risk: retention now deletes the
prior completed run as soon as a new one finishes, so a manual `regenerate` call that lands
while a _new_ scrape is mid-flight for the same period could read partial, still-being-inserted
rows. Fix in the same PR: add `AND status = 'completed'` to `RUN_FOR_PERIOD`.

### AC-6 / AC-7 / AC-8 — pollable status, manual regenerate, visible failure

Three generic routes replace the four sync export routes and the three Grades RC routes:

- `GET /scraping/exports/:exportType/status`
- `GET /scraping/exports/:exportType/download`
- `POST /scraping/exports/:exportType/regenerate`

`:exportType` is validated against the fixed set (`docentes`, `secciones`,
`alumnos-matriculados`, `alumnos-secciones`, `grades-rc`) via a DTO/pipe — never accepted as
free text. `academicPeriodId` stays a header (existing convention for this module), `lang` a
query param.

`status` never errors on a missing row — it returns `{ status: 'notGenerated' }` so the
frontend always has something to render while polling, whether or not generation has ever
run for that key. `download` throws `NotFoundError` (`error.scrapingExports.notGenerated`, 404) only when there is no completed result to serve at all. `regenerate` throws
`ConflictError` (`error.scrapingExports.alreadyGenerating`, 409) if the key is already
`'running'` — same semantic as Grades RC's existing 409 on a duplicate `start`.

### AC-9 — surviving a crash mid-generation

No new scheduler is introduced (`docs/POLICIES.md` explicitly says not to add
`@nestjs/schedule`). Staleness is reconciled lazily, on read: `getStatus`/`download`/
`regenerate` each call a private `reconcileIfStale(row)` — if `status === 'running'` and
`updatedAt` is older than a `GENERATION_STALE_TIMEOUT_MS` constant (proposed: 20 minutes,
comfortably above Grades RC's documented multi-minute merge — implementation should confirm
against real timings before shipping), the row flips to `'failed'` with
`error.scrapingExports.staleGenerationDetected` right there in the read path, no background
sweep required.

### AC-10 — Grades RC moves onto the same persisted pattern

`ScrapingExportGenerationService.generate()` handles `exportType === 'gradesRc'` by calling
`GradesRcExportRepository.openGradesRcExport()` and the existing paging/merge logic, then
`collectToBuffer()` exactly as today — the finished file is already fully buffered in memory
before persistence in the _current_ code, so writing it into `fileBytes` afterward adds no new
peak-memory cost (see ADR-002). `ScrapingExportsService` stops constructing its own
`JobRegistry<GradesRcExportJobState>`; that class itself is untouched, since the survey module
still uses it for its own bulk jobs.

## Backend

- **Module**: `src/modules/admin/scraping-exports/` (existing; extended, not replaced)
- **New entity**: `ScrapingExportRunEntity` → `core.scraping_export_runs`, registered via
  `TypeOrmModule.forFeature([ScrapingExportRunEntity])` added to `scraping-exports.module.ts`
  (currently only registers the raw connection — this is the module's first entity on the
  main datasource)
- **New migration**: `pnpm migration:create src/database/migrations/add-scraping-export-runs-table`
  — creates `core.scraping_export_runs` with `PK_scraping_export_runs`,
  `UQ_scraping_export_runs_export_type_periodo_lang`; `down()` drops both then the table
- **New decorator**: `@BinaryColumn()` in `src/commons/configs/db.configs.ts`
- **Repository additions**:
  - `ScrapeRunRepository`/`PlannerScrapeRunRepository`: `deleteRun`, `deleteOtherRunsForPeriodo`
  - `ScrapingExportsRepository`: reverse lookup `findAcademicPeriodIdByCode(periodoCode): Promise<number | null>`, and the `RUN_FOR_PERIOD` status hardening
  - New `ScrapingExportRunRepository extends BaseRepository<ScrapingExportRunEntity>`:
    find/upsert-by-`(exportType, periodo, lang)`, status transitions
- **New service**: `ScrapingExportGenerationService` (see AC-4/5 above)
- **Endpoints**: `GET/POST /scraping/exports/:exportType/{status,download,regenerate}` —
  `@RequirePermission({ module: 'SCRAPPING', action: 'GET' | 'POST' })` matching the existing
  permission module code; `@AcademicPeriodId()` header (existing convention, `optional: true`
  where the export can fall back to "latest overall" exactly as today); no school/modality
  scope headers, consistent with the module's current endpoints
- **Removed endpoints**: the four sync export GETs and the three Grades RC endpoints — see
  ADR-002 for why this is an intentional breaking change, and the Cross-repo mode section
  below for how the frontend catches up
- **i18n keys** (`config/strings/scraping-exports.validation.ts`):
  `error.scrapingExports.notGenerated` (404), `error.scrapingExports.alreadyGenerating` (409),
  `error.scrapingExports.generationFailed`, `error.scrapingExports.staleGenerationDetected`
- **Validation**: `:exportType` route param validated against the fixed enum via DTO
  (`@IsIn([...])`); no new business-rule `.validation.ts` beyond the existing module's
  conventions since there's no user-editable entity here, only generated state

## Cross-repo mode

- **Mode**: sequential. This backend PR merges and reaches `staging` before any frontend
  change lands — the frontend cannot be developed against a contract until the new
  status/download/regenerate shape actually exists.
- **Contract**: this repo's committed `openapi.json`, regenerated in the same PR
  (`pnpm openapi:export`) per `docs/POLICIES.md`.
- **Ordering**: `FRONT-ACREDITACION-3.0` is not checked out in this environment, so its
  paired change folder could not be created here. Whoever picks up the frontend side should
  open `openspec/changes/scrape-retention-and-cached-exports/` in that repo (same slug),
  copy this repo's `proposal.md`, and design against the regenerated `openapi.json` once this
  PR is on `staging`.

## Testing strategy

| AC                   | Covered by                                                                                | Kind                      |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| 1                    | `ScrapeRunRepository.spec.ts` (delete methods) + `ScraperService.spec.ts` (orchestration) | unit                      |
| 2                    | `PlannerScrapeRunRepository.spec.ts` + `PlannerScraperService.spec.ts`                    | unit                      |
| 3                    | Same specs as AC-1/2, status-branch cases                                                 | unit                      |
| 4                    | `ScrapingExportGenerationService.spec.ts` (trigger methods, mocked repos)                 | unit                      |
| 5                    | `ScrapingExportRunRepository.spec.ts` (upsert/read) + controller spec                     | unit                      |
| 6                    | Controller spec (`notGenerated` shape), generation service spec                           | unit                      |
| 7                    | Controller + service spec (`regenerate`, 409 on running)                                  | unit                      |
| 8                    | Generation service spec (failure path sets `errorMessage`/`'failed'`)                     | unit                      |
| 9                    | `reconcileIfStale` spec (frozen clock, boundary just under/over timeout)                  | unit                      |
| 10                   | Generation service spec (`gradesRc` branch, mocked `GradesRcExportRepository`)            | unit                      |
| End-to-end (all ACs) | A real scrape run against staging, watched through to a downloadable file                 | manual — see `runbook.md` |

## Risks

| Risk                                                                                                                                                                    | Mitigation                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retention is irreversible; a bug in the `periodo` filter could delete the wrong run's raw data                                                                          | `deleteOtherRunsForPeriodo`/`deleteRun` get dedicated repository-level tests before wiring into `execute()`; smoke-test on staging before the first production run, per the proposal's existing risk entry |
| `RUN_FOR_PERIOD`'s missing status filter (pre-existing) becomes a live correctness risk once old completed runs are deleted immediately on new-run completion           | Fixed in the same PR (AC-4 section above) rather than left as a pre-existing-but-now-worse gap                                                                                                             |
| `AlumnosSecciones`'s correctness also depends on main-DB upload state (`course_sections`/`study_plan_courses`), which can change independently of any scrape completing | Not auto-invalidated by this change — document in the runbook that a stale `AlumnosSecciones` export after a course-section re-upload needs a manual `regenerate`                                          |
| `core.scraping_export_runs` grows with binary blobs and every regenerate is a full-row overwrite (no history)                                                           | Acceptable at current export sizes per ADR-002; flagged there as a deferred, non-breaking S3 migration if it stops being acceptable                                                                        |
| Breaking the public contract for five endpoints in one PR                                                                                                               | Sequential cross-repo mode — backend ships and reaches `staging` first; `openapi.json` is the frontend's signal to start; no dual-support window is attempted                                              |

## Docs to update in this PR

- [ ] `docs/CONTEXT.md` § Database — add `core.scraping_export_runs` to the `core` schema
      row's description
- [ ] `docs/CONTEXT.md` § Business Rules — add a short entry for "latest-only retention per
      period" (Banner/Planner raw data) once implemented, following the section's existing
      style (rule + why + where enforced)
- [ ] `openapi.json` — regenerate via `pnpm openapi:export` (mandatory per `docs/POLICIES.md`,
      not optional documentation)
