# Tasks — Speed up gradesRc export generation and unify its storage with the other exports

**Slug**: `gradesrc-export-performance-and-storage` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and fan the
  non-overlapping ones out to parallel subagents. Milestone 1 (SQL) and Milestone 2 (storage)
  touch mostly disjoint files (`grades-rc-export.sql.ts`/`test/manual/...` vs
  `scraping-exports.service.ts`/`scraping-export-generation.service.ts`/module/entities), so they
  can be parallelized once Task 1.1 (fixing the stale manual verify script) is done — everything
  else in Milestone 2 depends on `GradesRcExportRepository`'s `rows()` return shape staying
  `GradeRcExportRow & { hasObservations: boolean }`, which Milestone 1 does not change.
- TDD throughout: write the test, **see it fail**, implement, see it pass.
- A task is complete when **its test passes**, not when the code is written. For the SQL-rewrite
  tasks (1.2, 1.3, 1.4), "its test" is `test/manual/grades-rc-export.verify.ts` passing against a
  real (even if disposable/local) Postgres — the jest suite mocks `query` and cannot execute this
  SQL, per the file's own header comment. Task 1.5 has no such test — see its own steps for why —
  and is verified by a real `EXPLAIN` only.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the heading.
  Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*` — `ADR-004` and the `ADR-003` status-line update
  were already written during design and should not be touched here.
- Run `pnpm exec tsc --noEmit -p tsconfig.build.json` after any TypeScript change in this module —
  several files here share the same interfaces (`GradeRcExportRow`, `GradesRcExportHandle`) and a
  signature change in one ripples to callers in another task.
- `GRADES_RC_SQL` changes are high-blast-radius: real production grade data flows through this
  query. Re-run `test/manual/grades-rc-export.verify.ts` after **every** edit to
  `grades-rc-export.sql.ts`, not just once at the end.

## Goal

Fix three confirmed inefficiencies in `GRADES_RC_SQL`'s Planner-side merge — a section-scope filter
applied too late, an unconditional fallback join that real data never uses, and (the dominant one,
found live during design) a `section_designated` CTE the planner silently re-executes once per
output row instead of computing once — and unify `gradesRc`'s storage onto the same `rows_data`
jsonb column the other four export types already use, deleting the dedicated
`core.scraping_export_gradesrc_rows` table, entity and repository. See `design.md` for the
validated rewrite (confirmed against real production data during design — full-query `EXPLAIN`
went from 26m 33s to 1m 26s, a 94.6% reduction, identical row counts throughout) and `ADR-004` for
the storage decision.

## Slicing

Vertical. Milestone 1 delivers a faster, behaviorally-identical `GRADES_RC_SQL`. Milestone 2
delivers the storage unification on top of it. Milestone 3 is the manual/runbook verification the
proposal's own ACs require and no automated test can cover.

---

## Milestone 1 — Fix the three `GRADES_RC_SQL` performance bugs

### Task 1.1 — Fix the already-broken manual verify script before touching any SQL ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `test/manual/grades-rc-export.verify.ts` (modify)

**Steps**

1. Replace the `READ_GRADES_RC_PAGE_SQL` import with `READ_GRADES_RC_ALL_PAGE_SQL` (the actual
   export from `grades-rc-export.sql.ts` — `READ_GRADES_RC_PAGE_SQL` no longer exists; this file
   was not updated when `defer-export-language-to-download` renamed it).
2. Rewrite `verifySplit`'s `page()` helper: `READ_GRADES_RC_ALL_PAGE_SQL` takes `[lastSeq, limit]`
   only (no `withObservations` third parameter — the split is no longer a `WHERE` on the temp
   table). Page through **all** rows once, then split the collected array client-side by
   `row.hasObservations` before running the existing "clean"/"review" assertions.
3. Run it against a local disposable Postgres per the file's own header instructions (`docker run
... postgres:16`, `RAW_DB_URL=... pnpm migration:raw:run`, then
   `VERIFY_DB_URL=... npx ts-node -T -r tsconfig-paths/register test/manual/grades-rc-export.verify.ts`)
   → expect **all existing assertions to pass** against the current, unmodified `GRADES_RC_SQL`.
   This is the baseline the next two tasks diff against.

**Commit**: `test(scraping-exports): fix stale import in grades-rc manual verify script`

> The script was more broken than design anticipated: beyond the `READ_GRADES_RC_PAGE_SQL` rename,
> its fixture-loading `INSERT`s still used the pre-rename Spanish column names
> (`periodo`/`nivel`/`departamentos`/`codigo_alumno`/`curso_codigo`/`departamento`) from before
> commit `3f3c0505` (rename remaining Spanish stats/method identifiers to English) — this script was
> never updated for that migration either. Fixed all of them in the same pass; confirmed against a
> disposable local Postgres (`docker run postgres:16` + `pnpm migration:raw:run`). All 40 assertions
> pass against the current, unmodified `GRADES_RC_SQL` — this is the baseline Tasks 1.2–1.6 diff
> against.

### Task 1.2 — Push the section-scope filter onto `raw_planner_nota` before the `evaluacion` join ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` (modify — `GRADES_RC_SQL`'s
  `planner_raw` CTE)
- `test/manual/grades-rc-export.verify.ts` (test — re-run, no code change expected)

**Steps**

1. Add a `scoped_planner_sections` CTE resolving `$10` (the section-code scope array) to
   `raw_planner_seccion.section_id` for the current `planner_run`, exactly as designed in
   `design.md` § AC-1.
2. Change `planner_raw`'s `WHERE` to filter `n.section_id = ANY(ARRAY(SELECT section_id FROM
scoped_planner_sections))` instead of `s.payload->>'sectionNumber' = ANY($10::text[])`. Drop
   the now-redundant `NULLIF(TRIM(s.payload->>'sectionNumber'), '') IS NOT NULL` check (guaranteed
   by construction — see design.md).
3. Run `test/manual/grades-rc-export.verify.ts` → expect **green**, identical to Task 1.1's
   baseline run (same pass/fail set, same row content).
4. Against a real or realistic-scale Postgres (staging, or the same read-only production access
   used during design — read-only `EXPLAIN` only, never write), run
   `EXPLAIN (ANALYZE, BUFFERS)` on the isolated `planner_raw` CTE for period 202610 → confirm the
   section-scope filter appears as a `Bitmap Index Scan` (or equivalent) directly on
   `raw_planner_nota`, not as a post-join filter (AC-1).

**Commit**: `perf(scraping-exports): push gradesRc section scope onto raw_planner_nota`

> Applied SQL is textually identical to the candidate rewrite already validated live against
> production during design (see design.md § AC-1) — 40/40 manual-verify assertions still pass,
> identical row content to Task 1.1's baseline. Deferred the standalone `EXPLAIN` re-check to Task
> 1.6's comprehensive pass (all three SQL fixes + the applied code, both periods) rather than
> re-running against production after every micro-edit.

### Task 1.3 — Make the `e_nm` fallback join conditional ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` (modify — `GRADES_RC_SQL`'s
  `planner_raw` CTE)
- `test/manual/grades-rc-export.verify.ts` (test — this is the one place the `e_nm` fallback path
  is actually exercised, by fixture design; re-run, no code change expected)

**Steps**

1. Replace the `LEFT JOIN raw_planner_evaluacion e_nm ON e_id.id IS NULL AND ...` with the scalar
   correlated-subquery form inside the existing `COALESCE`, exactly as designed in `design.md`
   § AC-2. Leave the `e_id` `LEFT JOIN` untouched (see design.md for why it must stay a join, not a
   subquery).
2. Run `test/manual/grades-rc-export.verify.ts` → expect **green**, including the assertions that
   specifically exercise the `e_nm` fallback path (the fixtures deliberately arm it — real
   production data never does). This is the test that would catch a subtle behavior change the
   `EXPLAIN` check below cannot (a plan-shape check proves the join isn't unconditional; it does
   not prove the picked row is still the same one).
3. Against a real or realistic-scale Postgres, run `EXPLAIN (ANALYZE, BUFFERS)` on the isolated
   `planner_raw` CTE for period 202610 → confirm the `e_nm` subplan shows `(never executed)` (or
   equivalent — not evaluated for rows whose `component_id` already matched) (AC-2).

**Commit**: `perf(scraping-exports): make gradesRc e_nm fallback join conditional`

> Green on the first attempt, including "R3 evaluation matched by name when the id misses" — the one
> fixture-driven test that specifically exercises this fallback path (NRC7/A7), since real production
> data never does. `e_id` left untouched as a real JOIN, per design.md's reasoning. `EXPLAIN`
> re-confirmation deferred to Task 1.6 alongside Task 1.2's, same rationale.

### Task 1.4 — Force `section_designated` to materialize instead of re-executing per row ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` (modify — `GRADES_RC_SQL`'s
  `section_designated` CTE)
- `test/manual/grades-rc-export.verify.ts` (test — re-run, no code change expected)

**This is the change's dominant fix** (see `design.md` § AC-7) — Tasks 1.2/1.3 fix real but minor
bugs; this one fixes the thing actually costing 25 of the 26.6 real minutes.

**Steps**

1. Change `section_designated AS (` to `section_designated AS MATERIALIZED (`, per `design.md`
   § AC-7 part 1. No other change to the CTE's body.
2. Run `test/manual/grades-rc-export.verify.ts` → expect **green**, identical output to Task 1.3's
   baseline (row content unaffected — this is a pure plan-shape change).
3. Against a real or realistic-scale Postgres, run `EXPLAIN (ANALYZE, BUFFERS)` on the **full**
   `GRADES_RC_SQL` (not just an isolated CTE — this bug only appears once `section_designated` is
   joined against the full `flagged` CTE) for period 202610 → confirm `section_designated` no
   longer shows a `loops` count in the thousands on the node that computes it (it should show
   `loops=1`), and that total execution time drops sharply from the pre-fix baseline (AC-7).

**Commit**: `perf(scraping-exports): materialize gradesRc section_designated CTE`

> One-line change (`AS (` → `AS MATERIALIZED (`), 40/40 manual-verify assertions unaffected — a
> pure plan-shape change, exactly as expected. The `EXPLAIN` proof that this is the dominant fix
> was already gathered live during design (see design.md § AC-7); Task 1.6 re-confirms it against
> this exact applied code.

### Task 1.5 — Force a hash join for the materialized `section_designated` lookup ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/core/grades-rc-export.repository.ts` (modify —
  `openGradesRcExport`/`closeGradesRcExport`)

**Steps**

1. In `openGradesRcExport`, add `await runner.query('SET enable_nestloop = off')` alongside the
   existing `SET work_mem = '128MB'` / `SET jit = off` calls, before `MATERIALIZE_GRADES_RC_SQL`
   runs. Plain `SET`, not `SET LOCAL` — this runner is never in an explicit transaction, matching
   the existing two calls exactly (see `design.md` § AC-7 part 2 for why).
2. In `closeGradesRcExport`, add `await runner.query('RESET enable_nestloop')` alongside the
   existing `RESET work_mem` / `RESET jit` calls, inside the same nested-`finally` structure (a
   failed reset must not keep the connection out of the pool, same reasoning as the other two).
3. Against a real or realistic-scale Postgres, run the **full** `GRADES_RC_SQL` for period 202610
   with this setting applied (either via a manual `SET enable_nestloop = off;` before the query in
   `psql`, or by exercising `openGradesRcExport` directly) → confirm via `EXPLAIN (ANALYZE,
BUFFERS)` that the join to `section_designated` now shows a `Hash Left Join` (or similar
   hash-based strategy) instead of `Nested Loop Left Join`, with `loops=1` on the CTE scan feeding
   it, and that total execution time drops further from Task 1.4's result (AC-7).
4. There is no jest-mockable unit test for this — `dataSource.query` is mocked in the existing spec
   suite for this repository, so a `SET`/`RESET` pair added to already-mocked calls would only prove
   the mock was called, not that the setting had any effect. Rely on the real-Postgres `EXPLAIN`
   check above and the existing `grades-rc-export.repository.spec.ts` (updated only if the new
   `runner.query` calls need to be added to that spec's existing call-count assertions, if any).

**Commit**: `perf(scraping-exports): force hash join for gradesRc section_designated lookup`

> As predicted, the existing spec had an exact-sequence assertion on `closeGradesRcExport`'s reset
> calls (`['DROP TABLE...', 'RESET work_mem', 'RESET jit']`) that needed `'RESET enable_nestloop'`
> appended — updated it, 11/11 green. `EXPLAIN` proof (Hash Left Join replacing Nested Loop,
> `section_designated` scan dropping from `loops=320025` to `loops=1`, 3m54s → 1m26s) was already
> gathered live during design with this exact SQL text (see design.md § AC-7); Task 1.6 re-confirms
> against this fully-applied code.

### Task 1.6 — Confirm combined fix is still content-identical and re-measure ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- None (verification only — no code change expected if Tasks 1.2/1.3/1.4/1.5 were each already
  green)

**Steps**

1. Run `test/manual/grades-rc-export.verify.ts` one more time with all four fixes applied together
   → expect **green**.
2. Against real production data (or the closest staging equivalent), run `EXPLAIN (ANALYZE,
BUFFERS)` on the **full** `GRADES_RC_SQL` for **both** 202610 and 202615 → record before/after
   timings in the PR description. Design-time validation for 202610 alone measured 26m 33s → 1m 26s
   (94.6% reduction) under Postgres's default `work_mem`; re-confirm against the applied code (not
   the hand-assembled query used during design) and extend to 202615, per AC-1/AC-2's "at least both
   periods" requirement, which also applies to AC-7 as the same investigation's finding.
3. Do not attempt a full end-to-end timed `regenerate` here — that is Milestone 3 / the runbook,
   since it takes real Banner+Planner data to run and depends on Milestone 2 also being in place
   (the storage change is what `regenerate`'s final write path exercises). Given this milestone's
   findings, expect the real end-to-end number to be far below the historical ~19-minute baseline,
   but only the runbook step confirms the actual figure under production's real `work_mem` setting.

**Commit**: none — folds into Tasks 1.2/1.3/1.4/1.5's commits; this task is a verification
checkpoint, not new code.

> Ran the full `GRADES_RC_SQL` (all three fixes, exactly as it now reads in the repo, including the
> `SET enable_nestloop = off` the repository now applies) via `EXPLAIN (ANALYZE, BUFFERS)` against
> real production data for both periods, read-only. **202610**: 85,550 ms (1.43 min), 52,385 rows,
> `section_designated` scan at `loops=1` — matches the design-time candidate almost exactly (86,035
> ms). **202615**: 42,919 ms (43s), 18,333 rows (matches the proposal's known ~18,335), also
> `loops=1`. Only one `Nested Loop` remains in either plan. Both periods now scale proportionally
> with real data size — the original 11.8x disproportionate slowdown between periods (proposal's
> root Problem statement) is gone. Manual verify script: 40/40 green throughout. Milestone 1
> complete.

---

## Milestone 2 — Unify `gradesRc` onto `rows_data` storage (see ADR-004)

### Task 2.1 — Migration: drop `core.scraping_export_gradesrc_rows` ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/database/migrations/<CLI-timestamp>-drop-scraping-export-gradesrc-rows-table.ts` (create)

**Steps**

1. `pnpm migration:create src/database/migrations/drop-scraping-export-gradesrc-rows-table` — do
   **not** hand-pick the timestamp.
2. `up()`: `DROP TABLE IF EXISTS "core"."scraping_export_gradesrc_rows"` (the FK and index drop
   implicitly with it).
3. `down()`: recreate the table, its FK (`FK_scraping_export_gradesrc_rows_scraping_export_run_id`)
   and its index (`IDX_scraping_export_gradesrc_rows_run_generated_observations`) exactly as
   `1787378550454-add-scraping-export-gradesrc-rows-table.ts` created them — copy its `up()`
   verbatim into this migration's `down()`.
4. Run `pnpm migration:run` then `pnpm migration:revert` then `pnpm migration:run` again against a
   disposable/local database → confirm both directions succeed cleanly (this is the "test" for a
   migration; there is no jest spec for it).

**Commit**: `feat(scraping-exports): drop scraping_export_gradesrc_rows table`

> File: `1787446467593-drop-scraping-export-gradesrc-rows-table.ts`. Round trip confirmed against a
> disposable local Postgres seeded with all 47 existing migrations (run → revert → run) — `down()`
> recreates the table/FK/index exactly, `up()` cleanly drops it again.

### Task 2.2 — `ScrapingExportsService`: fetch/render gradesRc from an in-memory array ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/api/scraping-exports.service.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-exports.service.spec.ts` (test)

**Steps**

1. Write the failing spec first: assert `fetchGradesRcRows(academicPeriodId)` collects
   `GradesRcExportRepository.openGradesRcExport(...).rows()` into one array and closes the handle
   (mirroring the existing `materializeGradesRc` test's mock setup, minus the batch-insert
   assertions). Assert `renderGradesRc(rows, lang)` splits its input by `hasObservations` and
   writes both sheets via the existing `startSheet`/`ExcelJS.stream.xlsx.WorkbookWriter` path,
   given a small in-memory fixture array (no DB paging mocks needed) → expect **red** (methods
   don't exist yet with this signature).
2. Implement `fetchGradesRcRows` and the new `renderGradesRc(rows, lang)` signature per
   `design.md` § AC-4/AC-5. Delete `materializeGradesRc`, the old `renderGradesRc(runId,
generatedAt, lang)`, and `pageGradesRcRows`.
3. Re-run the spec → expect **green**.

**Commit**: `refactor(scraping-exports): fetch and render gradesRc from an in-memory row array`

> Red confirmed first (`fetchGradesRcRows is not a function`), then implemented. 13/13 green,
> including the existing sheet-content assertions unchanged (only the data source moved from a
> DB-paged read to an in-memory array). Deleted `MATERIALIZE_BATCH_SIZE`, `pageGradesRcRows`, and
> the `gradesRcRowRepository` constructor param along with the old two-arg signatures.

### Task 2.3 — `ScrapingExportGenerationService`: fold gradesRc into the shared `rowsData` path ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts` (test)

**Steps**

1. Write the failing spec first: assert `runGradesRcGeneration` calls `exportsService
.fetchGradesRcRows`, then `runRepository.upsertByKey('gradesRc', period, { status: 'completed',
rowsData: rows, ... })` — no `gradesRcRowRepository` call at all. Assert `download('gradesRc',
...)` reads `reconciled.rowsData` and calls `exportsService.renderGradesRc(reconciled.rowsData,
lang)`, returning `null` when `rowsData` is `null` — the same shape as the other four export
   types' branch, not the old `hasRows`/`finishedAt` check. Assert a `warn`-level log is emitted
   when the fetched row count exceeds a new exported threshold constant (propose
   `GRADES_RC_ROW_COUNT_WARNING_THRESHOLD = 150_000`, alongside `GENERATION_STALE_TIMEOUT_MS`) →
   expect **red**.
2. Implement: remove the `gradesRcRowRepository` constructor dependency; rewrite
   `runGradesRcGeneration` and the `gradesRc` branch of `download` per `design.md` § Backend.
   `GENERATION_STALE_TIMEOUT_MS`, `gradesRcMergeStartedAt`/`isGradesRcMergeInFlight`, and
   `GradesRcMergeBusyError` are untouched.
3. Re-run the spec → expect **green**.

**Commit**: `refactor(scraping-exports): persist gradesRc rows through the shared rowsData column`

> Rewrote the spec's gradesRc-specific blocks (trigger, download, generation, single-flight guard)
> to the new `fetchGradesRcRows`/`rowsData` shapes; deleted the two retention-ordering tests
> (`deleteStaleBatches` no longer exists) and added the two new threshold-warning tests instead,
> spying on `Logger.prototype.warn`. One test needed a fix beyond the rename: its mock
> implementation resolved `undefined` instead of `[]`, which is fine for the old `void`-returning
> `materializeGradesRc` but crashes `rows.length` on the new array-returning `fetchGradesRcRows` —
> caught immediately by the suite (a `.mockImplementationOnce` gate test), not a real code defect.
> 39/39 green.

### Task 2.4 — Delete the dedicated entity/repository; update wiring and comments ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/model/scraping-export-gradesrc-row.entity.ts` (delete)
- `src/modules/admin/scraping-exports/core/scraping-export-gradesrc-row.repository.ts` (delete)
- `src/modules/admin/scraping-exports/core/scraping-export-gradesrc-row.repository.spec.ts` (delete)
- `src/modules/admin/scraping-exports/scraping-exports.module.ts` (modify)
- `src/modules/admin/scraping-exports/model/scraping-export-run.entity.ts` (modify — `rowsData`
  comment)

**Steps**

1. Delete the three files. Confirm nothing else imports them:
   `grep -rn "ScrapingExportGradesRcRow" src/` → expect no matches once this task is done.
2. Remove `ScrapingExportGradesRcRowEntity` from `TypeOrmModule.forFeature([...])` and
   `ScrapingExportGradesRcRowRepository` from `providers` in `scraping-exports.module.ts`.
3. Update `ScrapingExportRunEntity.rowsData`'s doc comment — remove the "always null for gradesRc"
   claim, reference ADR-004.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json` → expect **green** (confirms no dangling
   references anywhere in the module or its tests).

**Commit**: `refactor(scraping-exports): delete the dedicated gradesRc row table's entity and repository`

> Also fixed three now-stale comments in files that weren't otherwise touched
> (`grades-rc-export.repository.ts`, `grades-rc-export.repository.spec.ts`, `grades-rc-export.sql.ts`)
> that referenced `ScrapingExportGradesRcRowRepository` by name — a dangling reference to a deleted
> class read as worse than leaving the comment alone. `grep -rn "ScrapingExportGradesRcRow" src/`
> confirmed clean; `tsc --noEmit` clean; full module suite 83/83 green.

### Task 2.5 — Update `docs/CONTEXT.md` ✅ DONE (2026-08-22)

- [x] Task complete

**Files**

- `docs/CONTEXT.md` (modify)

**Steps**

1. § Database, `core` schema row: remove the `scraping_export_gradesrc_rows` mention; add ADR-004
   as a citation alongside the existing ADR-003 one.
2. § Business Rules: remove the bullet describing the batch-delete retention rule for
   `core.scraping_export_gradesrc_rows` (it no longer exists); replace with a short note that
   `gradesRc` now writes through the same single-column `rowsData` path as the other four export
   types, citing ADR-004.
3. No test — this is documentation. Re-read the edited sections once to confirm they read
   correctly against the post-change code (per `docs/CONTEXT.md`'s own "the code is right and this
   file is stale" rule).

**Commit**: `docs(context): update scraping export storage description for ADR-004`

---

## Milestone 3 — Manual verification (see `runbook.md`)

### Task 3.1 — Full end-to-end verification against real data

- [ ] Task complete

**Files**

- None (manual verification, tracked in `runbook.md`)

**Steps**

1. Follow `runbook.md` in full: deploy order (migrate before deploying the new image), a timed
   `regenerate` for 202610 (AC-3's duration claim), a `download` diff against the pre-change output
   (AC-3/AC-5 content identity), and a memory watch during the generate+download cycle (AC-6).
2. Record the results (timings, memory peak, diff outcome) in the PR description.

**Commit**: none — this task has no code to commit; its outcome gates whether the PR is mergeable.

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
