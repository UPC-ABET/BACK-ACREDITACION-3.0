# Scrape Data Retention and Cached Scraping Exports

**Slug**: `scrape-retention-and-cached-exports`
**Branch**: `feat/scrape-retention-and-cached-exports`
**Repos affected**: both (backend contract defined here; frontend consumes it in a paired change)
**Created**: 2026-08-20

## Problem

Every Banner and Planner scrape run inserts a fresh, fully independent copy of its raw rows
(`horario`, `matricula`, `alumno`, `notas` for Banner; `seccion`, `evaluacion`, `nota` for
Planner), tagged with a `runId` FK to `scrape_run` / `planner_scrape_run`. Nothing ever
deletes a superseded run's rows — every re-scrape of the same period just grows the raw
datasource forever, even though only the newest completed run per period is ever read (the
export queries already do `ORDER BY started_at DESC LIMIT 1` filtered to `status = 'completed'`).

Separately, every scraping export (Docentes, Secciones, Alumnos Matriculados,
Alumnos-Secciones) is rebuilt from scratch, synchronously, on every single download request —
whoever clicks "download" pays the full merge/build cost every time, even when nothing has
changed since the last scrape. The recently added Grades RC export improved this with an
async job (`JobRegistry`), but that job's state is process-memory only with a 30-minute TTL:
after a restart or TTL eviction, a result that was already computed is gone and gets rebuilt
again on the next click — the underlying problem (recomputing unchanged data) is only
postponed, not solved, and the "already computed" signal doesn't survive the user navigating
away and coming back later.

## What already exists

**Raw scraping data (raw datasource, `RAW_DB_URL`):**

- Banner: `src/modules/admin/banner/raw/model/raw-horario.entity.ts`,
  `raw-matricula.entity.ts`, `raw-alumno.entity.ts`, `raw-notas.entity.ts`, plus
  `scrape-run.entity.ts` (table `scrape_run`: `id` uuid PK, `nivel`, `periodo`,
  `departamentos[]`, `status: 'running'|'completed'|'partial'|'failed'|'expired'`,
  `startedAt`, `finishedAt`, `stats jsonb`, `triggeredBy`).
- Planner: `src/modules/admin/planner/raw/model/raw-planner-seccion.entity.ts`,
  `raw-planner-evaluacion.entity.ts`, `raw-planner-nota.entity.ts`, plus
  `planner-scrape-run.entity.ts` (table `planner_scrape_run`, same shape, scoped by
  `periodo`/`escuela`).
- Every raw table carries a `runId` column and a composite unique constraint including it
  (e.g. `UQ_raw_horario_run_id_departamento_nrc`). Rows are insert-only — a re-scrape never
  updates or deletes a prior run's rows.
- Orchestration: `ScraperService` (`src/modules/admin/banner/scraper/api/scraper.service.ts`)
  and its Planner analogue drive a run end-to-end via an in-process single-flight flag,
  `scrapeRunRepository.createRun()` → bulk insert tagged with the new `runId` →
  `scrapeRunRepository.finish(runId, status, stats)`. This is the natural hook point for both
  a cleanup step and an export-generation trigger — it already knows `runId`, `periodo`, and
  the final `status`.
- "Latest run" is resolved at read time, not enforced at write time: the
  `RUN_FOR_PERIOD` CTE in `src/modules/admin/scraping-exports/core/scraping-exports.repository.ts`
  picks `ORDER BY started_at DESC LIMIT 1` among `EXPORTABLE_RUN_STATUSES = ('completed')`.
  No delete/retention/cleanup logic exists anywhere in the codebase today.

**Scraping exports (`src/modules/admin/scraping-exports/`):**

- `ScrapingExportsController` / `ScrapingExportsService`. Docentes, Secciones, Alumnos
  Matriculados and Alumnos-Secciones are built synchronously per GET request.
- Grades RC (added in #114/#115) is already async: `POST gradesRcStart` registers a job in
  `gradesRcJobs: JobRegistry<GradesRcExportJobState>` (`maxConcurrent=1`,
  `maxConcurrentPerOwner=1`, `ttlMs=30min`, `maxRetained=20`, from
  `src/modules/survey/shared/core/job-registry.ts`) and fires generation fire-and-forget;
  `GET gradesRcStatus/:jobId` polls; `GET gradesRcDownload/:jobId` returns the buffered
  `{fileName, file: Buffer}` result. This is the closest prior art for the status-polling
  pattern this proposal generalizes and makes durable.
- The merge itself streams through a pinned `QueryRunner` and a Postgres TEMP table
  (`grades-rc-export.repository.ts`, `GRADES_RC_TEMP_TABLE`), which is why `docs/CONTEXT.md`
  already documents this service as single-replica-only for the export path.
- No precomputed/cached export table exists anywhere. S3 (`@aws-sdk/client-s3`) is already
  used for "evidence and export file storage" per `docs/CONTEXT.md`'s integrations table, but
  not yet touched by this module.

## Goals

- After a Banner scrape run reaches `status = 'completed'`, the previous completed run's raw
  rows for that same `periodo`/`departamentos` scope are deleted; other periods are untouched.
- After a Planner scrape run reaches `status = 'completed'`, the previous completed run's raw
  rows for that same `periodo`/`escuela` scope are deleted; other periods are untouched.
- A run that itself ends `'partial'` or `'failed'` has its own raw rows cleaned up too, without
  touching the still-current completed run for that period.
- Every scraping export (Docentes, Secciones, Alumnos Matriculados, Alumnos-Secciones, Grades
  RC) is generated in the background and its result persisted, keyed by export type + period +
  source run(s), so a repeat download for unchanged data is served from storage instead of
  recomputed.
- Generation is triggered automatically when the relevant scrape run(s) reach `'completed'`,
  and can also be triggered manually on demand for a specific export type + period.
- Generation state (`pending` / `running` / `success` / `failed`) is persisted, not held only
  in process memory, so a user can leave and return later and see current status, and state
  survives an app restart.
- The download endpoint's behavior when no result is ready yet is a well-defined state the
  frontend can poll, not a silent block or a guessed fallback.

## Non-goals

- Changing what data each export contains or its business logic/transformation — only when
  and how it is computed and served changes.
- A general-purpose retention policy for data outside Banner/Planner raw scraping.
- Keeping export history beyond the latest per (export type, period) — no multi-version
  export archive/audit trail.
- Changing the single-replica deployment constraint documented in `docs/CONTEXT.md` (Planner
  session state, grades-RC single-flight, survey `JobRegistry`) — this proposal does not
  resolve those, it only changes what is stored/deleted for scraping exports specifically.
- Building the actual frontend screens — this proposal defines the backend contract
  (status/regenerate/download) the frontend consumes; the frontend implementation is tracked
  as a paired change in `FRONT-ACREDITACION-3.0`.

## Acceptance criteria

1. **AC-1** — Given a Banner scrape run for period P reaches `status = 'completed'`, when the
   run finishes, then all raw rows belonging to the immediately preceding completed run for
   that same `periodo`/`departamentos` scope are deleted, and rows for any other period are
   untouched.
2. **AC-2** — Given a Planner scrape run for period P reaches `status = 'completed'`, when the
   run finishes, then all raw rows belonging to the immediately preceding completed run for
   that same `periodo`/`escuela` scope are deleted, and rows for any other period are
   untouched.
3. **AC-3** — Given a Banner or Planner scrape run finishes with `status = 'partial'` or
   `'failed'`, when the run finishes, then that run's own raw rows are deleted, while the
   still-most-recent completed run for that period is left untouched.
4. **AC-4** — Given a scrape run reaches `status = 'completed'`, when the run finishes, then
   background generation is automatically triggered for every export type scoped to that
   period (Banner exports on a Banner run completing; Grades RC once both a Banner and a
   Planner completed run exist for the period), and the result (file + metadata) is persisted
   in a new table keyed by export type + period + source run(s).
5. **AC-5** — Given a precomputed export exists for a given export type + period, when a user
   requests the download, then the stored result is served directly without recomputation.
6. **AC-6** — Given no precomputed export exists yet for a given export type + period (e.g.
   immediately after a fresh scrape, before background generation completes), when a user
   requests the download, then the endpoint reports the current generation status instead of
   blocking on a synchronous compute, and a status endpoint lets the client poll until it
   reaches success or failure.
7. **AC-7** — Given a user wants to force a specific export type + period to be recomputed,
   when they call a manual regenerate action for that export, then a new generation run is
   queued for that export type + period, overwriting the previously stored result on success.
8. **AC-8** — Given a generation run fails, when a user checks its status (immediately or
   after returning later), then the status reflects `'failed'` rather than staying stuck at
   `'running'` or disappearing, and a subsequent manual regenerate or the next qualifying
   scrape completion can retry it.
9. **AC-9** — Given the app process restarts while a generation job is mid-flight, when a user
   checks status/downloads afterward, then previously completed results are still servable
   from the persisted table, and the interrupted job is surfaced as `'failed'`/stale rather
   than remaining `'running'` forever.
10. **AC-10** — Given the Grades RC export moves onto this persistent pattern, when its
    start/status/download endpoints are called, then they behave the same from the client's
    perspective but are backed by the persisted table rather than the in-memory `JobRegistry`
    TTL, so a completed result is no longer lost to TTL eviction.

### Traceability

| AC  | Criterion                                                | Satisfied by                                                                                                                                    |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Delete superseded Banner run's raw rows on completion    | `ScrapeRunRepository.deleteOtherRunsForPeriodo` + `ScraperService.execute()` (design.md § AC-1/AC-2)                                            |
| 2   | Delete superseded Planner run's raw rows on completion   | `PlannerScrapeRunRepository.deleteOtherRunsForPeriodo` + `PlannerScraperService.execute()`                                                      |
| 3   | Clean up partial/failed run's own raw rows               | `ScrapeRunRepository.deleteRun` / `PlannerScrapeRunRepository.deleteRun`, same call site as AC-1/2                                              |
| 4   | Auto-trigger export generation on scrape completion      | `ScrapingExportGenerationService.triggerForBannerRun` / `triggerForPlannerRun`                                                                  |
| 5   | Serve precomputed export without recomputation           | `core.scraping_export_runs` (`ScrapingExportRunEntity`) + `ScrapingExportGenerationService.download`                                            |
| 6   | Not-ready state is pollable, not a silent block          | `GET /scraping/exports/:exportType/status`                                                                                                      |
| 7   | Manual regenerate per export type + period               | `POST /scraping/exports/:exportType/regenerate`                                                                                                 |
| 8   | Failed generation is visible and retryable               | `ScrapingExportRunEntity.status = 'failed'` + `errorMessage`, same regenerate endpoint                                                          |
| 9   | Persisted state survives app restart; no stuck 'running' | `ScrapingExportGenerationService.reconcileIfStale` (design.md § AC-9)                                                                           |
| 10  | Grades RC moved onto the persistent pattern              | `ScrapingExportGenerationService.generate()` `'gradesRc'` branch (design.md § AC-10), replacing `JobRegistry` usage in `ScrapingExportsService` |

## Dependencies

- Existing `scrape_run` / `planner_scrape_run` entities and raw tables under
  `admin/banner/raw/`, `admin/planner/raw/` (raw datasource, `RAW_DB_URL`-gated).
- Existing `ScrapingExportsController` / `ScrapingExportsService` /
  `ScrapingExportsRepository`, and the Grades RC merge in
  `grades-rc-export.repository.ts` (pinned `QueryRunner` + temp table).
- Existing `JobRegistry` (`src/modules/survey/shared/core/job-registry.ts`) — design phase
  must decide whether the new persisted state replaces it for scraping exports or sits
  alongside it for in-flight signaling.
- AWS S3 (`@aws-sdk/client-s3`), already the documented storage for "evidence and export
  file storage" — the natural place to hold generated export files, with the new table
  holding metadata + object key rather than the file bytes in Postgres.
- A new TypeORM migration for the export-generation-state table, per
  `docs/POLICIES.md § Migrations` (CLI-generated timestamp, forward-only, explicit `down()`).
- `openapi.json` regeneration in the same PR — the download/status endpoints' behavior and
  possibly shape change.
- `FRONT-ACREDITACION-3.0` — needs a paired change to consume the new status/regenerate
  contract (polling UI, regenerate action, not-ready state).

## Risks

| Risk                                                                                                                                                                                                                                                                                       | Impact                                                             | Mitigation                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deleting a superseded run's raw rows is irreversible; a bug in the period/scope filter could delete the wrong run's data.                                                                                                                                                                  | High — silent, unrecoverable data loss                             | Deletion is scoped strictly per (periodo, departamentos/escuela) and only fires once the _new_ run itself reports `'completed'`; cover the scope filter with a regression test before this ships, and smoke-test on staging before the first production run. |
| Reusing or replacing the process-local `JobRegistry` pattern must not quietly reintroduce a multi-replica assumption — `docs/CONTEXT.md` already documents this service as single-replica for three independent reasons (Planner session, grades-RC single-flight, survey job registries). | Medium — could scale wrong later and repeat a documented bug class | Design phase must state explicitly whether this still assumes single replica (matching current deployment) and note it does not resolve the other two single-replica reasons even if state moves fully into Postgres.                                        |
| A generation job that dies mid-flight (crash/restart) could leave a row stuck at `'running'` forever, blocking both auto and manual regeneration with no visible signal.                                                                                                                   | Medium — silently stale exports                                    | AC-9 requires stale/failed detection; design.md picks the concrete mechanism (e.g. a max-duration timeout checked on read, or a startup reconciliation pass).                                                                                                |
| Some exports are already OOM-sensitive (per git history — Alumnos-Secciones export scoping/OOM fixes); buffering a full generated file in-process before persisting could reintroduce that pressure.                                                                                       | Medium                                                             | Stream the generated file to storage (temp file / streamed upload) rather than holding the full buffer in memory during generation.                                                                                                                          |

## Open questions

None — the scope decisions below were resolved with the requester before writing this
proposal:

- Retention scope: latest-only per period (not global, not keep-N).
- Cleanup also applies to partial/failed runs' own leftovers, not just completed-run
  supersession.
- All five export types (Docentes, Secciones, Alumnos Matriculados, Alumnos-Secciones,
  Grades RC) are in scope.
- Not-ready downloads report a pollable status rather than falling back to synchronous
  compute; a manual regenerate action is also required.
- Deletion of the old run's raw data happens as soon as the new run completes, independent of
  whether export regeneration has finished.
- This is a cross-repo change; frontend consumption is tracked as a paired proposal.
