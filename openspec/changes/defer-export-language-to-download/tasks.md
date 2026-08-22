# Tasks — Defer scraping-export language rendering to download time

**Slug**: `defer-export-language-to-download` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and fan the
  non-overlapping ones out to parallel subagents.
- TDD throughout: write the test, **see it fail**, implement, see it pass.
- A task is complete when **its test passes**, not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the heading.
  Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*`.
- Run tests with `npx jest --no-coverage <path>`; typecheck with
  `pnpm exec tsc --noEmit -p tsconfig.build.json`.
- Migrations: always `pnpm migration:create src/database/migrations/<kebab-name>` first — never
  hand-pick a filename or timestamp. Test both `up()` and `down()` locally before committing.

## Goal

Make scraping-export generation keyed on `(exportType, period)` instead of
`(exportType, period, lang)`: the underlying query/merge runs once per period, and language
selection (headers, filename, `gradesRc` observation text) is applied only when a file is rendered
for download. Implements ADR-003.

## Slicing

Vertical. Milestone 1 lands the schema both later milestones build on (demonstrable: migrations run
clean, entities compile). Milestone 2 delivers the fix for the four cheap exports. Milestone 3
delivers the fix for `gradesRc` — the one that actually motivated this change. Milestone 4 closes
out the public contract and docs.

---

## Milestone 1 — Language-neutral storage schema

### Task 1.1 — Reshape `scraping_export_runs`: drop `lang`/`file_bytes`/`file_name`, add `rows_data` ✅ DONE (2026-08-22)

- [x] Task complete

> `rowsData` is typed `any[] | null`, not `unknown[] | null` — TypeORM's upsert `DeepPartial`
> typing can't resolve a jsonb array column typed any stricter than that, the same reason
> `BaseEntity.extra` is `any`. Migration verified for real: ran `up()`/`down()`/`up()` against a
> throwaway local Postgres container (no dev DB was available in this environment) seeded with the
> full existing migration history first.

**Files**

- `src/database/migrations/<cli-generated>-reshape-scraping-export-runs-language-neutral.ts` (create)
- `src/modules/admin/scraping-exports/model/scraping-export-run.entity.ts` (modify)
- `src/modules/admin/scraping-exports/core/scraping-export-run.repository.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts` (test)

**Steps (TDD)**

1. `pnpm migration:create src/database/migrations/reshape-scraping-export-runs-language-neutral`.
2. Hand-write `up()`: `DELETE FROM core.scraping_export_runs` (comment why — ADR-003 §6, pure
   cache rows, not recoverable); drop constraint
   `UQ_scraping_export_runs_export_type_period_lang`; drop columns `lang`, `file_bytes`,
   `file_name`; add `rows_data jsonb`; add constraint
   `UQ_scraping_export_runs_export_type_period` on `(export_type, period)`. Hand-write `down()`
   reversing the shape (see `1787235067252-add-scraping-export-runs-table.ts` for the column-DDL
   style to match).
3. Update `ScrapingExportRunEntity`: remove `lang`/`fileBytes`/`fileName`; add
   `rowsData: unknown[] | null` via `@JsonColumn({ nullable: true, withDefault: false })`; change
   the `@Unique(...)` decorator to drop `lang`.
4. Update `ScrapingExportRunRepository.findByKey`/`upsertByKey`: drop the `lang` parameter; the
   upsert patch type drops `fileBytes`/`fileName`, gains optional `rowsData?: unknown[] | null`.
5. Update every existing caller in `scraping-export-generation.service.spec.ts` that mocks/asserts
   `findByKey`/`upsertByKey` with a `lang` argument — this will fail to compile until fixed; that
   compile failure **is** the red state for this task. Fix the call sites, re-run
   `npx jest --no-coverage scraping-export-generation.service.spec.ts` → expect green (the
   generation service itself isn't rewired yet — this task only proves the schema/repository layer
   compiles and the existing behavior still passes with `lang` removed from every mock).
6. `pnpm migration:run` against a local dev DB, confirm success; `pnpm migration:revert`, confirm
   the table returns to its prior shape; `pnpm migration:run` again to leave the DB in the new
   state.
7. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(scraping-exports): reshape scraping_export_runs to be language-neutral`

### Task 1.2 — Add `core.scraping_export_gradesrc_rows` ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/database/migrations/<cli-generated>-add-scraping-export-gradesrc-rows-table.ts` (create)
- `src/modules/admin/scraping-exports/model/scraping-export-gradesrc-row.entity.ts` (create)
- `src/modules/admin/scraping-exports/core/scraping-export-gradesrc-row.repository.ts` (create)
- `src/modules/admin/scraping-exports/scraping-exports.module.ts` (modify — register the new
  entity/repository)

**Steps (TDD)**

1. `pnpm migration:create src/database/migrations/add-scraping-export-gradesrc-rows-table`.
2. Hand-write `up()`: `CREATE TABLE core.scraping_export_gradesrc_rows` with columns per
   `design.md` § Entities (FK `scraping_export_run_id` → `core.scraping_export_runs(id)` `ON DELETE
CASCADE`, `generated_at timestamptz NOT NULL`, the `GradeRcExportRow`-mirroring columns,
   `observations jsonb`, `has_observations boolean NOT NULL`), constraint
   `FK_scraping_export_gradesrc_rows_scraping_export_run_id`, indexes
   `IDX_scraping_export_gradesrc_rows_run_id` and
   `IDX_scraping_export_gradesrc_rows_has_observations`. `down()` drops them in reverse.
3. Write `ScrapingExportGradesRcRowEntity` matching the migration exactly (extends `BaseEntity`;
   `@IntegerFKIDColumn()` + `@ManyToOne`/`@JoinColumn` for the FK; `@TextShortColumn()`/
   `@TextMediumColumn()`/`@JsonColumn()`/`@BooleanColumn()`/`@DateColumn()` per design.md).
4. Write `ScrapingExportGradesRcRowRepository` with `insertBatch(runId, generatedAt, rows)`
   (chunked, e.g. 1,000/statement), `readPage(runId, hasObservations, afterId, limit)`
   (keyset-paginated), `deleteStaleBatches(runId, keepGeneratedAt)`.
5. Register `ScrapingExportGradesRcRowEntity` via `TypeOrmModule.forFeature([...])` and
   `ScrapingExportGradesRcRowRepository` as a provider in `scraping-exports.module.ts`.
6. `pnpm migration:run` / `pnpm migration:revert` / `pnpm migration:run` locally, same check as
   Task 1.1.
7. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(scraping-exports): add scraping_export_gradesrc_rows table`

---

## Milestone 2 — Sync exports: fetch once per period, render per download

### Task 2.1 — Split `ScrapingExportsService`'s four sync exports into fetch + render ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/api/scraping-exports.service.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-exports.service.spec.ts` (test)

**Steps (TDD)**

1. In `scraping-exports.service.spec.ts`, write failing specs for `fetchStaffRows`,
   `fetchSectionRows`, `fetchEnrolledStudentRows`, `fetchStudentSectionRows` (language-neutral —
   assert they call the repository and return rows, taking no `lang` argument), and for
   `renderStaffExcel`, `renderSectionsExcel`, `renderEnrolledStudentsExcel`,
   `renderStudentSectionsExcel` (given a row array and a `lang`, assert the correct
   `resolveLabels`-selected headers/filename appear in the built workbook). Run
   `npx jest --no-coverage scraping-exports.service.spec.ts` → expect **red** (functions don't
   exist yet).
2. Implement the split in `scraping-exports.service.ts`: `fetchStaffRows` etc. keep exactly
   `generateStaff`'s current query call (no `lang` param); `renderStaffExcel(rows, lang)` etc. keep
   exactly the current `resolveLabels` + `buildExcel` logic, now taking rows as a parameter instead
   of fetching them. Delete the old combined `generateStaff`/`generateSections`/
   `generateEnrolledStudents`/`generateStudentSections`.
3. Re-run → expect **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `refactor(scraping-exports): split sync export fetch from render`

### Task 2.2 — Wire the generation service to fetch once, render per download; drop the per-language trigger loop ✅ DONE (2026-08-22)

- [x] Task complete

> Rewrote `scraping-export-generation.service.spec.ts` wholesale rather than patching it
> incrementally per-milestone — Milestone 3's changes to the same file would have touched most of
> the same describe blocks again, so patching twice would have been pure churn. Net behavior
> coverage matches the original spec's intent (every `AF-*`/described scenario preserved) plus the
> new AC-1/AC-2/AC-3/AC-4 assertions from `design.md`'s testing strategy.

**Files**

- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts` (test)

**Steps (TDD)**

1. Write failing specs: `triggerForBannerRun` calls `fireAndForgetGenerate` exactly once per
   `BANNER_EXPORT_TYPES` entry (not once per `SUPPORTED_EXPORT_LANGS.length` per entry — assert the
   total call count directly against a `SUPPORTED_EXPORT_LANGS` with 2+ entries, so the test would
   have failed against the old loop); `runGenerator` for a sync export type calls the new `fetch*`
   method and the claimed row is upserted with `rowsData` set, no `fileBytes`/`fileName`; `download`
   for a sync export type reads `rowsData` off the stored row and calls the matching `render*Excel`
   with the requested `lang`, without calling `fetch*` again. Run
   `npx jest --no-coverage scraping-export-generation.service.spec.ts` → expect **red**.
2. Implement: delete the `for (const lang of SUPPORTED_EXPORT_LANGS)` loop in
   `triggerForBannerRun`'s `BANNER_EXPORT_TYPES` branch; drop `lang` from `claimForGeneration`/
   `runGeneration`/`runGenerator`'s signatures; `runGenerator`'s sync-export branch calls the
   matching `fetch*Rows` and returns the rows (not a `GeneratedExcel`); `runGeneration`'s success
   path upserts `rowsData: rows` instead of `fileBytes`/`fileName`; `download` loads the row, calls
   `reconcileIfStale`, and — if `rowsData` is present — calls the matching `render*Excel(rowsData,
lang)`.
3. Re-run → expect **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(scraping-exports): fetch sync exports once per period, render per download`

---

## Milestone 3 — gradesRc: materialize once, render per download

### Task 3.1 — Collapse `GradesRcExportHandle.rows` to a single unfiltered pass ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/core/grades-rc-export.repository.ts` (modify)

**Steps (TDD)**

1. This is an internal interface with no dedicated spec file today (per existing repo convention —
   `grades-rc-export.repository.ts` has no `.spec.ts`); the red/green cycle for this task runs
   through Task 3.2's spec, since that is the first real caller of the new shape. Skip ahead to Task
   3.2, then return here only if `grades-rc-export.repository.ts` needs adjustment its own spec
   would have caught in isolation — note in the commit if so.
2. Change `GradesRcExportHandle.rows` from `(withObservations: boolean) =>
AsyncGenerator<GradeRcExportRow>` to `() => AsyncGenerator<GradeRcExportRow & { hasObservations:
boolean }>` — one full pass over the `TEMP` table (`READ_GRADES_RC_PAGE_SQL` already computes
   `hasObservations` server-side; drop the `withObservations` bind parameter and its `WHERE` clause
   from that query, or add a variant without it — whichever keeps `grades-rc-export.sql.ts` cleanest).
   `openGradesRcExport`, `buildGradesRcParams`, and the `TEMP`-table creation SQL are unchanged.
3. `pnpm exec tsc --noEmit -p tsconfig.build.json` (will show every call site still using the old
   two-argument shape — fix them as part of Task 3.2, not here).

**Commit**: folded into Task 3.2's commit (this task has no independently-testable behavior change).

### Task 3.2 — `materializeGradesRc` (ingest into the child table) and `renderGradesRc` (build the workbook from it) ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/api/scraping-exports.service.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-exports.service.spec.ts` (test)

**Steps (TDD)**

1. Write failing specs: `materializeGradesRc(academicPeriodId, runId, generatedAt)` opens the merge
   handle, pages the single unfiltered `rows()` once, and calls
   `gradesRcRowRepository.insertBatch(runId, generatedAt, ...)` with every row, then closes the
   handle; `renderGradesRc(runId, lang)` calls `gradesRcRowRepository.readPage(runId, false, ...)`
   then `readPage(runId, true, ...)`, and the resulting workbook's headers/observation text match
   the requested `lang`'s labels (mirrors today's `writeGradesRcSheets` spec coverage, now against
   the paginated-read path instead of the handle's two-pass read). Run
   `npx jest --no-coverage scraping-exports.service.spec.ts` → expect **red**.
2. Implement `materializeGradesRc`/`renderGradesRc`, delete `prepareGradesRc`/`generateGradesRc`
   and `writeGradesRcSheets`'s handle-reading branches, replacing them with reads off
   `gradesRcRowRepository.readPage`. Keep `startSheet`/`resolveLabels`/`collectToBuffer` as-is —
   only the row _source_ changes.
3. Re-run → expect **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(scraping-exports): materialize gradesRc rows once, render per download`

### Task 3.3 — Wire the generation service: drop the gradesRc per-language loop, add retention ✅ DONE (2026-08-22)

- [x] Task complete

> Retention ordering verified with an explicit `callOrder` array assertion
> (`materialize → upsert-completed → delete-stale`), not just individual call assertions — a test
> that only checked each call happened independently would pass even if the order were wrong.

**Files**

- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts` (test)

**Steps (TDD)**

1. Write failing specs: `triggerForBannerRun`/`triggerForPlannerRun` fire the `gradesRc` branch
   exactly once per period, not once per `SUPPORTED_EXPORT_LANGS` entry; a successful `gradesRc`
   generation calls `materializeGradesRc`, then upserts the parent row `completed` with
   `finishedAt` equal to the `generatedAt` passed to `materializeGradesRc`, then calls
   `gradesRcRowRepository.deleteStaleBatches(runId, generatedAt)` — **in that order** (assert call
   order, not just that all three happened); a `download`/`regenerate` issued _before_ the new
   batch's insert completes still renders successfully from the previous batch (simulate by not
   yet having called `deleteStaleBatches`); after a `staleGenerationDetected` flip, `regenerate`
   for the same period succeeds without any mock representing a second language's state. Run
   `npx jest --no-coverage scraping-export-generation.service.spec.ts` → expect **red**.
2. Implement: delete the `for (const lang of SUPPORTED_EXPORT_LANGS)` loop around the `gradesRc`
   branch in both trigger methods; `runGeneration`'s `gradesRc` success path generates
   `const generatedAt = new Date()` once, passes it into `materializeGradesRc`, upserts the parent
   row using the same `generatedAt` as `finishedAt`, then calls `deleteStaleBatches` — matching the
   ordering in `design.md`'s Retention description exactly (insert new → flip parent →
   delete old; never delete before the new batch is live). `download` for `gradesRc` calls
   `renderGradesRc(runId, lang)` instead of anything touching `GradesRcExportRepository`.
3. Re-run → expect **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(scraping-exports): generate gradesRc once per period with safe batch retention`

---

## Milestone 4 — Public contract and docs

### Task 4.1 — Controller/DTO: drop `lang` from status/regenerate, update Swagger ✅ DONE (2026-08-22)

- [x] Task complete

> Also dropped `fileName` from `ScrapingExportStatusResponse` (planned only to drop `lang`) — once
> `lang` is gone, a status/regenerate response can no longer report a real filename (it depends on
> which language would be rendered), so keeping the field would mean either a meaningless value or
> silently defaulting to one language's name. `download`'s own response headers are unaffected;
> they already compute the filename from the render step, not from this field.

**Files**

- `src/modules/admin/scraping-exports/api/scraping-exports.controller.ts` (modify)
- `src/modules/admin/scraping-exports/model/scraping-exports.types.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-exports.controller.spec.ts` (test)

**Steps (TDD)**

1. Update `scraping-exports.controller.spec.ts`: `status`/`regenerate` no longer forward a `lang`
   query param to the service; `ScrapingExportStatusResponse` assertions drop `.lang`; `download`
   still forwards `lang`. Run `npx jest --no-coverage scraping-exports.controller.spec.ts` →
   expect **red** where the old `.lang` assertions now fail (the assertions themselves are the
   failing test here — update them to the new shape, confirm they fail against the _old_
   controller code first, per the TDD note in `docs/POLICIES.md` about the fixture trap).
2. Remove `@Query('lang')` from `status`/`regenerate`; remove `lang` from
   `ScrapingExportStatusResponse`; update the three endpoints' Swagger descriptions (`download`'s
   `lang` doc gets the "selects the rendered language; does not affect whether the export is ready"
   note from `design.md`).
3. Re-run → expect **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(scraping-exports): drop lang from status/regenerate contract`

### Task 4.2 — Regenerate `openapi.json`, update `docs/CONTEXT.md` ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `openapi.json` (modify, generated)
- `docs/CONTEXT.md` (modify)

**Steps**

1. `pnpm openapi:export`; review the diff — confirm only the `scraping/exports` paths and
   `ScrapingExportStatusResponse` schema changed.
2. In `docs/CONTEXT.md` § Database, `core` schema row: replace the ADR-002 reference with ADR-003;
   mention `scraping_export_gradesrc_rows` alongside `scraping_export_runs`.
3. In `docs/CONTEXT.md` § Business Rules: add the gradesRc child-row retention bullet described in
   `design.md`'s Docs-to-update list, naming it as the same pattern as the existing Banner/Planner
   "latest completed run only" rule.
4. No test — this task is documentation + generated-artifact only. Confirm `git diff openapi.json`
   is non-empty and matches the controller/DTO changes from Task 4.1.

**Commit**: `docs(scraping-exports): regenerate openapi.json, update CONTEXT.md for ADR-003`

---

<!--
Append-only sections below. These record what actually happened, not what was planned,
and they are the best input to the next design.

## Unplanned — <what and why>

### Task U.1 — <title>
- [ ] Task complete

## Post-QA fixes

## Audit fixes (/abet-audit-pr)

### Review round 1
-->
