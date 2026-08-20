# Tasks — Scrape Data Retention and Cached Scraping Exports

**Slug**: `scrape-retention-and-cached-exports` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and
  fan the non-overlapping ones out to parallel subagents.
- TDD throughout: write the test, **see it fail**, implement, see it pass.
- A task is complete when **its test passes**, not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the
  heading. Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*`.
- Migrations: never hand-write a filename or timestamp. Run
  `pnpm migration:create src/database/migrations/<name>` first, then fill in `up()`/`down()`.
- Run tests with `npx jest --no-coverage <path>`; type-check with
  `pnpm exec tsc --noEmit -p tsconfig.build.json`.

## Goal

Stop Banner/Planner raw scrape data from accumulating forever (keep only the latest
completed run per period), and stop scraping exports from being rebuilt on every download —
generate them in the background when a scrape completes, persist the result, and expose a
pollable status/regenerate contract instead of always-synchronous downloads.

## Slicing

Vertical. Milestones 1–2 are independently shippable (retention only). Milestones 3–6 build
the persisted-export pipeline layer by layer but each ends in a working, tested slice.

---

## Milestone 1 — Banner scrape run retention (AC-1, AC-3 Banner half)

### Task 1.1 — Add delete methods to `ScrapeRunRepository` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/banner/raw/core/scrape-run.repository.ts` (modify)
- `src/modules/admin/banner/raw/core/scrape-run.repository.spec.ts` (test — create if it
  does not exist)

**Steps (TDD)**

1. Write failing tests: `deleteRun(id)` issues a delete for that id;
   `deleteOtherRunsForPeriodo(periodo, keepRunId)` deletes every row for that periodo except
   `keepRunId`, and does not touch rows for a different periodo.
   `npx jest --no-coverage src/modules/admin/banner/raw/core/scrape-run.repository.spec.ts`
   → expect **red**.
2. Implement both methods on `ScrapeRunRepository`.
3. Re-run → expect **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(banner): add scrape run cleanup methods to ScrapeRunRepository`

> Red confirmed first (`deleteRun`/`deleteOtherRunsForPeriodo` not a function), 3/3 green
> after, typecheck clean. Implemented with `this.repository.delete({ periodo, id: Not(keepRunId) })`,
> matching this file's existing convention.

### Task 1.2 — Wire cleanup into `ScraperService.execute()` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)
- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (test — create if it does
  not exist, mock `ScrapeRunRepository`)

**Steps (TDD)**

1. Write failing tests: when `execute()`'s success path lands on `status: 'completed'`,
   `deleteOtherRunsForPeriodo` is called with the finished run's `periodo`/`runId`; when it
   lands on `'partial'`, `deleteRun(runId)` is called instead (own leftovers only, per
   AC-3), and the previously-completed run for that period is never touched (no call
   referencing it). Same assertions for the catch path (`'failed'`/`'expired'`).
   `npx jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts` →
   expect **red**.
2. Implement the branch immediately after the existing `finish()` call, per design.md § AC-1/AC-2.
3. Re-run → expect **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(banner): delete superseded raw scrape data after a completed run`

> Red confirmed via `git stash`/`stash pop` (5/5 failed for the right reason:
> `cleanupAfterFinish` didn't exist), 5/5 green after, full banner suite (2 suites/8 tests)
> green, typecheck clean. Extracted the branch into a private `cleanupAfterFinish(status,
periodo, runId)` helper (same pattern as Planner's `finalizeRun`) because `'completed'`/
> `'partial'` are unreachable end-to-end under this repo's Jest config (`p-limit`'s dynamic
> import throws under `module: nodenext` ts-jest) — unit-tested all four statuses directly
> against the helper, kept one real `run()`→`execute()` test for `'expired'` to confirm the
> wiring is actually reached. Same branch logic and repository calls as design.md.

---

## Milestone 2 — Planner scrape run retention (AC-2, AC-3 Planner half)

### Task 2.1 — Add delete methods to `PlannerScrapeRunRepository` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/planner/raw/core/planner-scrape-run.repository.ts` (modify)
- matching `.spec.ts` (test — create if absent)

**Steps (TDD)**

1. Mirror Task 1.1's tests for the Planner repository. → **red**.
2. Implement `deleteRun`/`deleteOtherRunsForPeriodo`.
3. → **green**. 4. Type-check.

**Commit**: `feat(planner): add scrape run cleanup methods to PlannerScrapeRunRepository`

> Red confirmed first (`deleteRun`/`deleteOtherRunsForPeriodo` not a function), 3/3 green after
> implementation, typecheck clean. Implemented after the Banner counterpart landed, so used it
> as the exact convention reference (`Not(keepRunId)` from `typeorm`) to keep both scrapers
> structurally identical.

### Task 2.2 — Wire cleanup into `PlannerScraperService.execute()` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify)
- matching `.spec.ts` (test)

**Steps (TDD)**

1. Mirror Task 1.2's tests for the Planner service. → **red**.
2. Implement the same branch shape.
3. → **green**. 4. Type-check.

**Commit**: `feat(planner): delete superseded raw scrape data after a completed run`

> Red confirmed first (6 failing: 2 e2e + 4 unit on a not-yet-existing `finalizeRun`), 16/16
> green after, full `admin/planner` suite green (196 passed). Refactored the `finish()` +
> if/else branch into a private `finalizeRun(runId, periodo, status, stats)` helper called
> from both try/catch branches, rather than duplicating it inline — needed because this test
> suite can't drive the `'completed'`/`'partial'` success path end-to-end (`PlannerHttpClient`'s
> dynamic `import('p-limit')` throws under Jest), so `finalizeRun` is unit-tested directly via
> reflection for the success branch while the failure branch stays covered end-to-end. Same two
> repository calls, same branching as design.md — only the extraction is new.

---

## Milestone 3 — Persisted export-run entity and storage

### Task 3.1 — Add `@BinaryColumn()` to `db.configs.ts` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/commons/configs/db.configs.ts` (modify)

**Steps**

1. Add `@BinaryColumn()` following the existing decorator pattern in this file — `bytea`
   type, nullable, no default, accepting the shared `BaseOptions`.
2. `pnpm exec tsc --noEmit -p tsconfig.build.json` (no dedicated spec — this file has no
   existing per-decorator test convention; correctness is verified by Task 3.3's migration
   and Task 3.2's entity/repository tests).

**Commit**: `feat(commons): add BinaryColumn decorator for bytea columns`

> Added right before `JsonColumn`, matching the existing decorator pattern exactly
> (`bytea`, nullable, no default). Typecheck clean — `pnpm exec tsc` silently no-ops in this
> Windows/git-bash environment, used `./node_modules/.bin/tsc --noEmit -p tsconfig.build.json`
> directly instead throughout this milestone.

### Task 3.2 — `ScrapingExportRunEntity` and `ScrapingExportRunRepository` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/model/scraping-export-run.entity.ts` (create)
- `src/modules/admin/scraping-exports/model/scraping-exports.types.ts` (modify — add
  `ScrapingExportType` / `ScrapingExportGenerationStatus` unions)
- `src/modules/admin/scraping-exports/core/scraping-export-run.repository.ts` (create)
- `src/modules/admin/scraping-exports/core/scraping-export-run.repository.spec.ts` (test)

**Steps (TDD)**

1. Write failing tests for `ScrapingExportRunRepository`: find-by-key
   `(exportType, periodo, lang)` returns `null` when absent; an upsert-style method creates
   the row on first call and updates the same row (same `id`) on a second call with the same
   key. `npx jest --no-coverage src/modules/admin/scraping-exports/core/scraping-export-run.repository.spec.ts`
   → **red**.
2. Implement `ScrapingExportRunEntity` per design.md's column table (schema `core`, table
   `scraping_export_runs`, `PK_scraping_export_runs`,
   `UQ_scraping_export_runs_export_type_periodo_lang`) and the repository extending
   `BaseRepository<ScrapingExportRunEntity>`.
3. → **green**. 4. Type-check.

**Commit**: `feat(scraping-exports): add persisted export generation state entity`

> Red confirmed first (module not found), 5/5 green after (`findByKey` null/found,
> `upsertByKey` create/update-same-id/re-find). `upsertByKey` uses `repository.upsert(...,
{ conflictPaths: [...] })` then re-fetches via `findByKey`, matching the existing
> `ScraperCredentialRepository.upsertForProvider` convention rather than inventing a new
> upsert pattern. Registered `TypeOrmModule.forFeature([ScrapingExportRunEntity])` +
> `ScrapingExportRunRepository` in `scraping-exports.module.ts` — this module's first
> main-datasource entity. Full module suite: 5 suites / 35 tests green.
>
> **Coordinator fix after this task reported done**: `exportType`/`periodo`/`lang`/`status`/
> `triggeredBy` came back DB-nullable because `@TextShortColumn()` defaults `nullable: true`
> and design.md's column table didn't call out an override — but these are always-set,
> always-required fields (the unique constraint is even built on `exportType`/`periodo`/
> `lang`), so nullable was a real gap, not a faithful design translation worth keeping.
> Patched to `@TextShortColumn({ nullable: false })` on all five in both the entity and the
> migration (Task 3.3) before it was ever applied anywhere real. Re-ran typecheck + the full
> `scraping-exports` suite (5 suites / 35 tests) green after the fix.

### Task 3.3 — Migration for `core.scraping_export_runs` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/database/migrations/<timestamp>-add-scraping-export-runs-table.ts` (create via CLI)

**Steps**

1. `pnpm migration:create src/database/migrations/add-scraping-export-runs-table`.
2. Fill in `up()`: create `core.scraping_export_runs` with the `BaseEntity` columns
   (`id`, `extra`, `is_active`, `created_at`, `updated_at`) plus the columns from
   design.md's table, `PK_scraping_export_runs`, and
   `UQ_scraping_export_runs_export_type_periodo_lang` — style-match
   `1786244322642-add-scraper-credentials.ts` (schema-qualified double-quoted identifiers,
   constraint added after table creation).
3. Fill in `down()`: drop the unique constraint `IF EXISTS`, then the table `IF EXISTS`.
4. Register `TypeOrmModule.forFeature([ScrapingExportRunEntity])` in
   `scraping-exports.module.ts` and add `ScrapingExportRunRepository` to its providers.
5. Run the migration against a local/dev database and confirm `down()` cleanly reverses it.

**Commit**: `feat(db): add migration for core.scraping_export_runs`

> CLI-stamped `1787235067252-add-scraping-export-runs-table.ts`, styled after
> `1786244322642-add-scraper-credentials.ts`. This environment's own `.env` points at a
> Postgres role that isn't reachable here (port 5432 is occupied by an unrelated project's
> container), so verification used a disposable `postgres:16-alpine` container instead of the
> project's real dev DB — `migration:run` (all 40 migrations, including this one),
> `migration:revert` (confirmed `down()` cleanly drops constraint then table), `migration:run`
> again to leave it applied, then the temp container was removed. Includes the coordinator's
> `NOT NULL` fix (see Task 3.2's retro) on `export_type`/`periodo`/`lang`/`status`/
> `triggered_by` — harmless on a fresh `CREATE TABLE` with no existing rows, no backfill
> needed. **This migration has not been run against the project's actual dev/staging
> database** — whoever deploys this change should run `pnpm migration:run` for real before
> relying on it, per the runbook's deploy prerequisite.

---

## Milestone 4 — Generation orchestration and auto-trigger wiring

### Task 4.1 — Reverse periodo→academicPeriodId lookup + `RUN_FOR_PERIOD` hardening ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/core/scraping-exports.repository.ts` (modify)
- matching `.spec.ts` (test — create if absent)

**Steps (TDD)**

1. Write failing tests: `findAcademicPeriodIdByCode(periodoCode)` resolves an
   `academic.academic_periods.id` from its `code`, returns `null` when not found; a test
   asserting the `RUN_FOR_PERIOD` CTE's SQL text includes `status = 'completed'` (or an
   integration-style test seeding a `'running'` and a `'completed'` row for the same periodo
   and asserting the completed one is selected). → **red**.
2. Implement the reverse lookup and add `AND status = 'completed'` to `RUN_FOR_PERIOD`.
3. → **green**. 4. Type-check.

**Commit**: `fix(scraping-exports): resolve latest run by completed status only`

> Red confirmed (3/3 failed: `findAcademicPeriodIdByCode` missing, SQL missing
> `status = 'completed'`), 6/6 green after (3 new + 3 pre-existing in the file), typecheck
> clean. `findAcademicPeriodIdByCode` added as raw SQL against the main datasource, aliased
> `"id"` per the raw-SQL convention.

### Task 4.2 — `ScrapingExportGenerationService` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.ts` (create)
- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts` (test)
- `src/modules/admin/scraping-exports/config/strings/scraping-exports.validation.ts` (modify
  — add the four new i18n keys from design.md)

**Steps (TDD)**

1. Write failing tests (mocking `ScrapingExportRunRepository`, `ScrapingExportsRepository`,
   `ScrapeRunRepository`, `PlannerScrapeRunRepository`, `ScrapingExportsService`):
   - `triggerForBannerRun(periodo)` generates all four Banner exports for every supported
     lang, and additionally triggers `gradesRc` only when a completed Planner run exists for
     the same periodo.
   - `triggerForPlannerRun(periodo)` triggers `gradesRc` only when a completed Banner run
     exists for the same periodo, nothing otherwise.
   - `regenerate(...)` throws `ConflictError` (`error.scrapingExports.alreadyGenerating`) when
     the current row is `'running'`.
   - `getStatus(...)` returns `{ status: 'notGenerated' }` when no row exists.
   - `download(...)` returns the stored bytes even when `status === 'running'` (serves stale
     while regenerating), and returns `null` when no `fileBytes` have ever been written.
   - `reconcileIfStale`: a `'running'` row older than `GENERATION_STALE_TIMEOUT_MS` flips to
     `'failed'` with `error.scrapingExports.staleGenerationDetected` on read; a recent
     `'running'` row is left untouched.
     `npx jest --no-coverage src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts`
     → **red**.
2. Implement `ScrapingExportGenerationService` per design.md § AC-4/5 and § AC-9 (Banner
   branch only — Grades RC lands in Milestone 6).
3. → **green**. 4. Type-check.

**Commit**: `feat(scraping-exports): add persisted export generation orchestration`

> Red confirmed (module didn't exist), 15/15 green after. `gradesRc` generation stubs a
> thrown error inside `runGenerator` for now (caught by `generate()`'s own try/catch →
> resolves to a normal `'failed'` row, never an unhandled rejection) — Milestone 6 replaces
> this branch with the real merge. Supported langs read from
> `Object.keys(docenteExportLabels)` (`['es','en']`) rather than hardcoded.
> `GENERATION_STALE_TIMEOUT_MS = 20 * 60 * 1000`. Required an unlisted but necessary edit to
> `scraping-exports.module.ts` (import `RawDatabaseModule`/`PlannerRawDatabaseModule`, add the
> new service to providers/exports) for DI to resolve — verified no circular dependency.
> **Load-bearing detail for AC-9**: `BaseEntity.updatedAt` is a plain `@DateColumn`, not
> TypeORM's `@UpdateDateColumn` — nothing sets it automatically, so every `upsertByKey` call
> in this service explicitly sets `updatedAt: new Date()`, or `reconcileIfStale` would never
> see a fresh timestamp to compare against.
>
> Minor inconsistency worth a note: the four new i18n keys use `error.scrapingExports.*`
> (plural), while the three pre-existing Grades RC keys in the same file use
> `error.scrapingExport.*` (singular). Not fixed here — those three old keys belong to the
> JobRegistry-based Grades RC flow that Milestone 6 removes; Task 6.1 should delete them
> alongside the code that throws them rather than leaving orphaned keys.

### Task 4.3 — Wire auto-trigger into `ScraperService`/`PlannerScraperService` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)
- `src/modules/admin/banner/scraper/scraper.module.ts` (modify — import `ScrapingExportsModule`)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify)
- `src/modules/admin/planner/scraper/planner-scraper.module.ts` (modify)
- matching `.spec.ts` files (test)

**Steps (TDD)**

1. Extend Task 1.2/2.2's tests: on `status === 'completed'`,
   `exportGenerationService.triggerForBannerRun(periodo)` (or `triggerForPlannerRun`) is
   called and its rejection does not propagate out of `execute()` (fire-and-forget — assert
   `execute()` still resolves even if the trigger call is mocked to reject). → **red**.
2. Inject `ScrapingExportGenerationService` into both scraper services; call the trigger
   fire-and-forget (`void ...`, with an internal catch so a generation failure never surfaces
   as a scrape failure) right after the retention cleanup call.
3. → **green**. 4. Type-check.

**Commit**: `feat(scraping): trigger export generation after a completed scrape run`

> Extended, not restructured, Milestone 1/2's `cleanupAfterFinish`/`finalizeRun` helpers with
> a private `triggerExportGeneration(periodo)` fire-and-forget call inside each `'completed'`
> branch. Both scraper modules now import `ScrapingExportsModule` — confirmed no cycle (it's
> a sibling under `app.module.ts`, doesn't import back up). Red confirmed by re-stashing each
> service file (which also reverts Milestone 1/2's extraction, as expected): Banner 8 failed
> for the right reason, Planner 8 failed similarly. Green after: Banner 8/8, Planner 18/18.
> **Combined final check** (banner + planner + scraping-exports run together): 18 suites, 264
> tests, 262 passed / 2 pre-existing skipped, typecheck clean — independently re-verified by
> the coordinator, matches exactly.

---

## Milestone 5 — Generic status/download/regenerate endpoints

### Task 5.1 — Routes, DTOs, Swagger docs ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/config/scraping-exports.routes.ts` (modify)
- `src/modules/admin/scraping-exports/model/scraping-exports.dtos.ts` (create or modify)
- `src/modules/admin/scraping-exports/api/docs/scraping-exports.swagger.ts` (modify)

**Steps**

1. Add the three generic routes (`GET .../:exportType/status`,
   `GET .../:exportType/download`, `POST .../:exportType/regenerate`) to the routes config.
2. Add a DTO/param validator restricting `:exportType` to the fixed set
   (`docentes`, `secciones`, `alumnos-matriculados`, `alumnos-secciones`, `grades-rc`).
3. Add Swagger decorators for all three, including the `@ApiAcademicPeriodHeader()` pairing
   per `docs/POLICIES.md` § Scope Headers.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(scraping-exports): add routes and DTOs for generic export state endpoints`

> **Correction found during execution**: this module has no `api/docs/<module>.swagger.ts`
> factory file — `ScrapingExportsController` applies Swagger decorators inline per method, so
> the new endpoints followed that existing convention instead of introducing a new file.
> `:exportType` validation: grepped for an existing enum-route-param convention
> (`PipeTransform`/`ParseEnumPipe`) — none exists anywhere in this repo, so used a typed
> lookup (`EXPORT_TYPE_PARAM_MAP` + `parseExportTypeParam()`) throwing `BadRequestError`
> (`error.scrapingExports.invalidExportType`) on no match, in a new
> `model/scraping-exports.dtos.ts`. Typecheck clean.

### Task 5.2 — Controller endpoints, remove old routes ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/api/scraping-exports.controller.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-exports.controller.spec.ts` (test — create
  if absent)

**Steps (TDD)**

1. Write failing tests: `status` returns the service's result verbatim;
   `download` streams the returned buffer with the right `Content-Type`/
   `Content-Disposition`, and maps a `null` service result to 404
   (`error.scrapingExports.notGenerated`); `regenerate` returns 202-style
   `{ accepted: true, ... }` and propagates the service's `ConflictError` as-is (handled by
   `AllExceptionsFilter`). `npx jest --no-coverage src/modules/admin/scraping-exports/api/scraping-exports.controller.spec.ts`
   → **red**.
2. Implement the three new controller methods; delete the four old sync export methods and
   the three old Grades RC methods (`gradesRcStart`/`gradesRcStatus`/`gradesRcDownload`) and
   their route entries.
3. → **green**. 4. Type-check.

**Commit**: `feat(scraping-exports): replace synchronous export endpoints with generic status/download/regenerate`

> Red confirmed (8/8 failed: old methods no longer existed to call), 8/8 green after.
> `regenerate` returns the service's row via `parseSuccessResponse` rather than a bespoke
> `{ accepted: true }` shape — a reasonable, minor deviation from the original task wording,
> matches `status`'s response shape and the row already communicates the same "accepted,
> here's the current state" info. Required resolving the request's `academicPeriodId` header
> down to a `periodo` code (`ScrapingExportGenerationService.resolvePeriodo`, added this task,
> delegating to a new `ScrapingExportsRepository.resolvePeriodoCode`) since the generation
> service is keyed on `periodo`, not `academicPeriodId` — `@AcademicPeriodId()` made
> **required** (not optional, correcting design.md's "optional: true" line) since none of
> these three endpoints mean anything without a specific period. `ScrapingExportsService`'s
> generator methods and the `JobRegistry`-based Grades RC methods were left untouched, per
> plan — Milestone 6's job.
>
> **Coordinator fix after this task reported done**: `status` and `regenerate` were handing
> back the raw `ScrapingExportRunEntity` via `parseSuccessResponse`, which meant a
> `'completed'` row's `fileBytes` (a `Buffer`, potentially megabytes) got JSON-serialized into
> the response body as `{ type: 'Buffer', data: [...] }` — correctness-safe but a real waste,
> and not what a status/regenerate call should ever carry. Added
> `ScrapingExportStatusResponse` (model/scraping-exports.types.ts) and a private
> `toStatusResponse()` mapper in `ScrapingExportGenerationService`, applied to both
> `getStatus` and `regenerate`'s return values — `download` is unaffected, it already read
> `fileBytes` directly off the reconciled row for the one legitimate case that needs it.
> Updated one test in `scraping-export-generation.service.spec.ts` that had asserted raw
> passthrough (including `fileBytes`) to assert the stripped shape instead. Full
> `admin/scraping-exports` suite re-verified after the fix: 6 suites / 58 tests green,
> typecheck clean. Combined with banner+planner: 18 suites / 267 passed / 2 skipped.

---

## Milestone 6 — Grades RC onto the persisted pattern

### Task 6.1 — Move Grades RC generation into `ScrapingExportGenerationService` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts` (test)
- `src/modules/admin/scraping-exports/api/scraping-exports.service.ts` (modify — remove
  `JobRegistry` usage and the old `startGradesRcExport`/`runGradesRcExport` methods)

**Steps (TDD)**

1. Write failing tests: the `'gradesRc'` branch of `generate()` calls
   `GradesRcExportRepository.openGradesRcExport()`, pages through it, and stores the
   resulting buffer exactly as the four Banner exports do; a merge failure sets
   `status: 'failed'` with an `errorMessage`, not an unhandled rejection.
   `npx jest --no-coverage src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts`
   → **red**.
2. Implement the branch, reusing the existing paging/`collectToBuffer` logic verbatim from
   `ScrapingExportsService`; remove the now-dead `JobRegistry<GradesRcExportJobState>`
   construction and the old start/run/status/download methods from
   `ScrapingExportsService` (the `JobRegistry` class itself is untouched — the survey module
   still depends on it).
3. → **green**. 4. Type-check.

**Commit**: `refactor(scraping-exports): move Grades RC export onto persisted generation state`

> **Coordinator-identified gap, folded into this task's scope**: the old `JobRegistry`-based
> flow enforced one grades-rc merge running at a time _system-wide_ (`maxConcurrent: 1`
> across every user/period — the merge pins a pooled Postgres connection for minutes). The
> per-`(exportType, periodo, lang)` `'running'` check alone does not provide that, since two
> _different_ periods' gradesRc generations could otherwise run concurrently. Restored via a
> private `gradesRcMergeInFlight` boolean on `ScrapingExportGenerationService`, scoped only to
> `gradesRc` (the other four export types carry no such cost): `regenerate()` 409s
> (`error.scrapingExports.alreadyGenerating`) if the flag is set, even for an unrelated
> periodo/lang; the merge itself sets/clears the flag around the call, and if the auto-trigger
> path (no caller to 409) finds it already set, the attempt fails with a new
> `error.scrapingExports.gradesRcBusy` key (distinct from `alreadyGenerating` — that key means
> "duplicate of _this_ key", `gradesRcBusy` means "a _different_ key is holding the merge
> slot", a meaningfully different fact for whoever reads a failed row later) rather than
> silently overwriting it with the generic `generationFailed`.
>
> Added `ScrapingExportsService.generateGradesRc(academicPeriodId, lang)`, same inner logic
> as the old `runGradesRcExport` (prepare → `collectToBuffer` in `try` → `close()` in
> `finally`) minus job bookkeeping. Deleted `JobRegistry` usage, the three job-registry
> constants, `GradesRcExportJobResult`/`GradesRcExportJobState`/`GradesRcExportJobStatus`, and
> `startGradesRcExport`/`getGradesRcStatus`/`getGradesRcFile`/`runGradesRcExport` from
> `ScrapingExportsService` (`JobRegistry` itself untouched — survey module still uses it).
> Also removed the three now-orphaned i18n keys (`gradesRcInProgress`/`gradesRcJobNotFound`/
> `gradesRcFileNotReady`, flagged back in Task 4.2's retro) per repo-wide grep confirming no
> remaining references.
>
> Red confirmed by reverting the three implementation files (kept the updated specs) — 7
> failed for the right reasons. Green after: 29/29 in the generation-service spec.
> **Independently re-verified by the coordinator**: typecheck clean, combined
> banner+planner+scraping-exports suite — 18 suites, 270 tests, 268 passed / 2 pre-existing
> skipped — matches the agent's report exactly.

### Task 6.2 — Regenerate `openapi.json` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `openapi.json` (modify, generated)

**Steps**

1. `pnpm openapi:export`.
2. Diff the output — confirm the four old sync routes and three old Grades RC routes are
   gone, and the three new generic routes (× 5 export types where relevant) are present with
   correct scope headers.
3. Commit the regenerated file alongside the code that changed it, per
   `docs/POLICIES.md` § The API spec is a committed artifact.

> `pnpm openapi:export` needs no reachable database — confirmed via
> `src/tools/export-openapi.ts`/`export-openapi.env.ts`: it runs Nest in `preview` mode
> (module graph only, no provider instantiation), and `RAW_DB_URL`'s placeholder only exists
> to make the `RAW_DB_URL`-gated modules register, never to be dialled. Diff: 123
> insertions / 153 deletions, scoped entirely to `/scraping/exports/*` — the four old sync
> paths and three old grades-rc paths gone, the three new `{status,download,regenerate}`
> paths present with `X-Academic-Period-Id` `required: true` (per Task 5.2's correction) and
> the `exportType` enum listed on all three. 559 total paths, 313 schemas after. Confirmed via
> `git diff --stat openapi.json` by the coordinator, matches.

**Commit**: `chore(openapi): regenerate spec for scraping export state endpoints`

---

## Milestone 7 — Docs and runbook

### Task 7.1 — Update `docs/CONTEXT.md` ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `docs/CONTEXT.md` (modify)

**Steps**

1. Add `core.scraping_export_runs` to the `core` schema row's description in § Database.
2. Add a § Business Rules entry for "latest-only retention per period" (Banner/Planner raw
   data), following the section's existing rule/why/enforced-in style.

**Commit**: `docs(context): document scraping export retention and generation state`

> Added `core.scraping_export_runs` to the `core` schema row (§ Database), linked from
> ADR-002. Added a § Business Rules entry for latest-only retention, naming the exact enforcement
> point (`ScraperService.execute()`/`PlannerScraperService.execute()`, right after `finish()`)
> and the `periodo`-only scoping nuance discovered in Milestone 1/2.

### Task 7.2 — Validate `runbook.md` against the finished implementation ✅ DONE (2026-08-20)

- [x] Task complete

**Files**

- `openspec/changes/scrape-retention-and-cached-exports/runbook.md` (modify if needed — it
  was written during design; update it here if execution revealed different steps, method
  names, or endpoints than planned)

**Steps**

1. Re-read `runbook.md` once Milestones 1–6 are done and confirm every referenced
   method/endpoint name still matches what was actually built.
2. Walk the "Manual verification (staging)" section once for real, per its own steps.
3. Fix any drift found in step 1 directly in `runbook.md`.

**Commit**: `docs(runbook): validate against implementation`

> Re-read `runbook.md` against the actual implementation: every route (`/scraping/exports/
:exportType/{status,download,regenerate}`), table name, and method name it references still
> matches exactly — no drift, no edits needed. **Step 2 (the actual staging walkthrough) could
> not be performed in this environment** — there is no reachable staging deployment, live
> Banner/Planner credentials, or applied migration here (Task 3.3's migration only ran against
> a disposable throwaway container, never a real environment). That walkthrough is the
> runbook's own explicitly-labeled pre-deploy step for whoever ships this — it remains
> outstanding and should be done for real before this reaches production, not before this PR
> merges.

---

## Unplanned — lint cleanup after full-suite sign-off (2026-08-20)

### Task U.1 — Remove `fail()` (undefined global) from three test cases ✅ DONE (2026-08-20)

- [x] Task complete

Running `pnpm lint`-equivalent (`eslint`) across every file this change touched — part of the
coordinator's final sign-off before proposing commits, not any individual task's own steps —
surfaced `'fail' is not defined (no-undef)` in three tests across
`scraping-export-generation.service.spec.ts` (×2) and `scraping-exports.controller.spec.ts`
(×1). Milestone 4/6's agents had used Jest's old `fail()` helper inside a redundant
`try { ... } catch { fail(...) }` block that was already covered by a preceding
`.rejects.toThrow(...)` assertion, and `fail` isn't a recognized global under this project's
ESLint config. Replaced each with a second `.rejects.toMatchObject({ messageKey: ... })` call
instead of the try/catch — same assertion, no `fail()`.

> Files: `src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts`,
> `src/modules/admin/scraping-exports/api/scraping-exports.controller.spec.ts`. Lint clean
> after; `admin/scraping-exports` suite still green (6 suites / 59 tests); final whole-project
> pass confirmed clean end to end: typecheck clean, 130 suites / 1248 passed / 2 pre-existing
> skipped, project-wide.

---

## Audit fixes (/abet-audit-pr)

### Review round 1 (2026-08-20)

Six parallel auditors (code quality, architecture/docs/API-contract, testing, antipatterns,
security, runtime robustness) reviewed the diff against `origin/develop`. Full findings table
was presented to the requester; verdict was NOT READY (2 majors). Requester asked to fix all
majors, minors and suggestions. Three suggestions are explicitly deferred rather than
implemented — see the note at the end of this section for why.

- [x] AF-1 (major) — `runGenerator()`'s four Banner branches don't null-check `academicPeriodId`
      before calling the generator, unlike the `gradesRc` branch — a `periodo` that fails to
      resolve silently generates/persists the wrong period's data under the right period's key.
- [x] AF-2 (major) — `gradesRcMergeInFlight` can get stuck `true` forever if the merge hangs
      (no timeout anywhere), decoupled from the 20-minute DB-row stale reconciliation —
      permanent, silent denial of all future Grades RC generation until a process restart.
- [x] AF-3 (minor) — `sourceBannerRunId`/`sourcePlannerRunId` columns exist but are never
      written anywhere (confirmed independently by two auditors) — provenance is unrecoverable.
- [x] AF-4 (minor) — `status`/`regenerate` have no typed `@ApiResponse`; `openapi.json`
      documents their 200 with no schema.
- [x] AF-5 (minor) — the new retention call in `ScraperService`/`PlannerScraperService`'s
      `execute()` has no try/catch, unlike the sibling trigger call right next to it — a
      transient DB error becomes an unhandled promise rejection.
- [x] AF-6 (minor) — read-then-write race lets a duplicate trigger for the same
      `(exportType, periodo, lang)` run a second full generation pass; for `gradesRc`
      specifically the "loser" overwrites the row to a misleading transient `'failed'` while
      the real winner is still in progress.
- [x] AF-7 (minor) — `error.scrapingExports.*` (plural) is the only plural module segment in
      the entire codebase's i18n keys.
- [x] AF-8 (minor) — `regenerate()` and `generate()` both upsert the identical `'running'`
      state back-to-back — a redundant write on every manual regenerate.
- [x] AF-9 (minor) — the gradesRc "busy" signal is discriminated by comparing `error.message`
      to an i18n key string — fragile, no compiler support.
- [x] AF-10 (minor) — `ScrapingExportGenerationStatus` includes `'pending'`, matching ADR-002's
      prose, but no code path ever emits it.
- [x] AF-11 (minor) — "does not touch rows for a different periodo" (both banner and planner
      repository specs) re-asserts the same mock call already checked in the prior test —
      tautological.
- [x] AF-12 (minor) — "reconciles a stale running row" only asserts `.resolves.toBeDefined()` —
      doesn't verify the row actually transitioned.
- [x] AF-13 (minor) — `reconcileIfStale`'s tests don't cover the actual `<` comparison boundary
      with a frozen clock, per design.md's own testing-strategy commitment.
- [x] AF-14 (suggestion, partial) — `cleanupAfterFinish` (Banner) and `finalizeRun` (Planner)
      diverged in shape/parameter-order/naming for the same responsibility; align them (the
      base-class-extraction half of this finding is deferred, see note below).
- [x] AF-15 (suggestion) — `docs/CONTEXT.md` still claims S3 is used for export storage;
      ADR-002 (this same PR) proves that's aspirational.
- [x] AF-19 (suggestion) — no test documents that an unsupported `lang` value's fallback-to-
      default behavior is intentional.
- [x] AF-20 (suggestion) — `BinaryColumn`'s destructured `withDefault` is unused, copy-pasted
      from the other decorators.

> **All 17 items done (2026-08-20).** Implemented across four parallel/sequential agent
> dispatches plus two direct coordinator edits:
>
> - **`scraping-export-generation.service.ts` (AF-1, AF-2, AF-3, AF-6, AF-8, AF-9, AF-10, AF-12,
>   AF-13)** — the two majors and every minor rooted in this one file, done together since they
>   share a common fix (see below). AF-1: both the four Banner branches and the `gradesRc`
>   branch now throw `error.scrapingExport.periodNotFound` on an unresolved `academicPeriodId`
>   instead of silently falling back. AF-2: `gradesRcMergeInFlight` (boolean) →
>   `gradesRcMergeStartedAt` (timestamp) + `isGradesRcMergeInFlight()`, which treats a slot held
>   past `GENERATION_STALE_TIMEOUT_MS` as no longer in-flight — self-heals on the same 20-minute
>   timeline the DB-row check already uses, no new magic number, no hard query-cancellation
>   needed. AF-6+AF-8 (same root cause, fixed together): split the old `generate()` into
>   `claimForGeneration()` (the _only_ place a row is ever upserted to `'running'`; returns
>   `null` if already claimed) and `runGeneration()` (assumes already claimed, just runs the
>   generator and finalizes) — closes the auto-trigger path's missing duplicate-generation
>   guard and removes `regenerate()`'s redundant double-upsert in the same change. AF-9: new
>   module-private `GradesRcMergeBusyError extends Error`, `instanceof` check instead of
>   string comparison. AF-3: `triggerForBannerRun`/`triggerForPlannerRun` now take the
>   triggering run's own id as a second parameter, thread `sourceBannerRunId`/
>   `sourcePlannerRunId` into every `claimForGeneration` call (gradesRc resolves the _other_
>   source's id from the same `findByPeriodo` lookup already used to decide whether to trigger
>   it at all — no extra query); `regenerate()` resolves both via a new
>   `resolveSourceRunIdsForRegenerate()`, tolerating a missing completed run rather than
>   blocking. AF-10: `'pending'` dropped from `ScrapingExportGenerationStatus` (confirmed
>   unused via repo-wide grep); ADR-002's Decision section updated with a one-line correction
>   (still `Status: Proposed`, so editable). AF-12/AF-13: strengthened the weak assertion and
>   added `jest.useFakeTimers()` boundary cases at exactly `GENERATION_STALE_TIMEOUT_MS - 1`
>   and `GENERATION_STALE_TIMEOUT_MS`. TDD: full spec rewrite confirmed red against the old
>   signatures/behavior, 30/30 green after.
> - **`ScraperService`/`PlannerScraperService` (AF-5, AF-14, + wiring AF-3's caller side)** —
>   dispatched after the above landed, since it depends on the new `triggerForBannerRun`/
>   `triggerForPlannerRun` signatures. Banner's `cleanupAfterFinish` renamed to `finalizeRun`
>   and restructured to own the `finish()` call internally, matching Planner's existing shape
>   exactly (same name, same parameter order, same internal structure) — both files' retention
>   delete + fire-and-forget trigger call are now wrapped in a try/catch that logs and swallows
>   (`finish()` itself stays outside the try/catch — the run's own outcome record still fails
>   loud). TDD: 10 failures confirmed red (missing `finalizeRun`, missing second arg, AF-5's
>   regression test rejecting), 28/28 green after.
> - **`scraping-exports.controller.ts` (AF-4, AF-19)** — ran in parallel with the generation
>   service. New `ScrapingExportStatusResponseDto` (Swagger-only class, `model/
scraping-exports.response.dtos.ts`) mirrors the real response shape field-for-field;
>   `@ApiResponse({status:200, type:...})` added to `status`/`regenerate` — confirmed via a
>   real `pnpm openapi:export` diff that both paths now carry a real schema, not an empty
>   description. AF-19: traced `resolveLang`'s actual behavior (an unsupported value passes
>   through unchanged as the storage key) and confirmed it's benign — `ScrapingExportsService.
resolveLabels` already falls back to the default language for real file content regardless
>   of what key the row is stored under, so this is a metadata-accuracy nit (a row's `lang`
>   field wouldn't describe its actual content language), not a functional bug — documented via
>   a new test rather than changed. 9/9 green.
> - **Banner/Planner repository specs (AF-11)** — ran in parallel with the above two. Replaced
>   the tautological single-call re-assertion with a real two-call scenario proving two
>   different periods' criteria never cross-contaminate. 6/6 green.
> - **Coordinator direct edits (AF-15, AF-20, AF-7)**: `docs/CONTEXT.md`'s Tech Stack and
>   External Integrations lines corrected to state S3 is configured but unused, pointing at
>   ADR-002. `BinaryColumn`'s unused `withDefault` destructure removed with a one-line comment
>   explaining why (a `bytea` column has no sensible universal default). AF-7: every
>   `error.scrapingExports.*` key literal renamed to `error.scrapingExport.*` (singular) in the
>   one file that defines them (`config/strings/scraping-exports.validation.ts`) — every
>   consumer references the constant, not a hardcoded literal (confirmed via grep), so the
>   rename propagated with zero other file changes. The exported object itself keeps its name
>   `scrapingExportsValidationStrings` (matches the module/file name, a code-identifier
>   convention, not an i18n key).
>
> **Deliberately not implemented**: AF-16, AF-17, AF-18 — see the note below this list for why.
>
> **Final verification** (whole project, run by the coordinator after every agent's work
> landed): typecheck clean; full suite **130 suites / 1262 passed / 2 pre-existing skipped**
> (up from 1248 before this round — reflects the new/strengthened tests); lint clean across
> every touched file. Two stray `git diff` scratch files (`diff1.txt`/`diff2.txt`, left behind
> by an agent's own working process) removed before final verification.

**Deliberately not implemented** (numbers preserved from the original findings table so the
gap is traceable, not silently dropped):

- AF-16 (suggestion) — pre-existing cross-school scoping gap on scraping exports. The
  auditor's own words: "out of scope here; candidate for a follow-up." Not a regression this
  diff introduced, and fixing it is a product/design decision (does this data need school
  isolation at all?) beyond a PR-audit-fix's scope.
- AF-17 (suggestion) — extract a `SingleFlightGuard` abstraction from `gradesRcMergeInFlight`.
  No second use case exists yet; extracting it now is exactly the kind of premature
  abstraction `docs/POLICIES.md`'s spirit (and this repo's own conventions) warns against.
- AF-18 (suggestion) — add a concurrency limiter to `triggerForBannerRun`'s 8-way fan-out.
  The auditor's own assessment: "low risk today," "consider ... if more languages/export
  types are added" — deferred until that's actually true.

<!--
Append-only sections below. These record what actually happened, not what was planned,
and they are the best input to the next design.

## Post-QA fixes

## Audit fixes (/abet-audit-pr)

### Review round 1
-->
