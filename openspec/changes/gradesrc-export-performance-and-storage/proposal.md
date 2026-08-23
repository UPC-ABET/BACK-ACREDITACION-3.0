# Speed up gradesRc export generation and unify its storage with the other exports

**Slug**: `gradesrc-export-performance-and-storage`
**Branch**: `feat/gradesrc-export-performance-and-storage`
**Repos affected**: backend
**Created**: 2026-08-22

## Problem

While implementing `defer-export-language-to-download` (branch `feat/defer-export-language-to-download`,
not yet merged), a live investigation against the real production database (SSH + `psql`, read-only,
against `db_sys_acc` and the raw scraping DB `db_scrape_raw`) surfaced two distinct problems with the
`gradesRc` export specifically:

**1. Generation is far slower than its data size explains.** Real measurements for the two academic
periods currently on the server:

|                     | 202610      | 202615     | ratio     |
| ------------------- | ----------- | ---------- | --------- |
| enrollments         | 55,101      | 15,615     | 3.5x      |
| final gradesRc rows | 52,387      | 18,335     | 2.9x      |
| generation time     | **19m 14s** | **1m 38s** | **11.8x** |

Every scale metric grows ~2.9–3.5x between the two periods except generation time, which grows 11.8x.
Root-caused with `EXPLAIN (ANALYZE, BUFFERS)` against the real data: `GRADES_RC_SQL`'s `planner_raw`
CTE (`src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts`) does not apply its
section-scope filter (the `$10` array — sections actually loaded into the app) until _after_ joining
`raw_planner_nota` against `raw_planner_evaluacion`. For 202610 this means ~2,006,932 raw Planner note
rows get processed through that join before ~80% of them are discarded as out of scope (only 470,293
belong to in-scope sections) — 202610's raw-to-relevant ratio (17.6% relevant) is far worse than
202615's (29.3% relevant), which is why the wasted work — and the time it costs — doesn't scale with
the "real" size of the period. A second, independently-confirmed inefficiency: the `e_nm` fallback
join (matching an evaluation by name when `component_id` doesn't resolve) runs unconditionally for
every row, even though a direct count against production data showed **0% of rows in either period
ever use it** (100% matched via the fast, indexed `component_id` path) — it is pure wasted work in
both periods, and became the single largest cost (~2.79M buffer hits) once the first inefficiency was
fixed.

Two fix attempts were tested live against production data in this investigation (read-only `EXPLAIN`,
nothing executed against the app):

- A naive `IN (SELECT ...)` semi-join pushdown made things **8x worse** (216.7s vs the 28.76s
  isolated-CTE baseline) — Postgres ran the full original plan and bolted the new filter on as an
  outer nested loop re-scanning `raw_planner_seccion` 403,545 times.
- An `= ANY(ARRAY(SELECT ...))` form correctly pushed the filter onto the existing
  `IDX_raw_planner_nota_section_id` index (confirmed via `Bitmap Index Scan ... rows=470293`,
  matching the true in-scope count exactly) and both attempts preserved the correct final row count
  (403,545) — but only cut the isolated CTE's time by ~26% (28.76s → 21.2s), because the `e_nm`
  problem above then dominated.

Neither fix has been applied to the codebase. This proposal is where that work belongs.

**A third, dominant inefficiency, found live against production during this change's own design
phase (`/abet-design-feature`), after the two above were already validated.** Timing the _full_
`GRADES_RC_SQL` end-to-end (all 16 bound parameters, real 202610 data, read-only `EXPLAIN (ANALYZE,
BUFFERS)`, nothing executed against the app) rather than just the isolated `planner_raw` CTE showed
that the two fixes above are a rounding error against the real baseline: **26 min 33s** for the full
query (52,385 rows — consistent with the 52,387 measured earlier in this investigation). Applying
only the `planner_raw` fixes measured **28 min 12s** (no improvement — noise, since the two named
bugs cost roughly a minute out of 26+). The dominant cost is a single join: `flagged`'s
`LEFT JOIN section_designated sd ON sd.section_code = r.section_code` was planned as a
`Nested Loop Left Join` that **re-executes `section_designated`'s own join/`WHERE`/`DISTINCT ON`
logic once per outer row — 320,025 times — removing 302 million rows via its join filter each time**,
costing **25 min 8s** of the 26 min 33s baseline (94.6% of the total). Root cause: `section_designated`
is referenced only once (in `flagged`), so PostgreSQL auto-inlines it (the default since PG12 for a
singly-referenced CTE) instead of materializing it; combined with a systemic cardinality
misestimate — every CTE built from `unnest($n::text[])`-style runtime array parameters is estimated
by the planner at `rows=1` regardless of how large the array actually is at execution time, and that
wrong estimate cascades through every join built on top of it — the planner has no signal that this
join is expensive and picks the cheapest-looking (but catastrophically wrong) strategy.

Two further live tests, same methodology, confirmed a fix:

- Marking the CTE `section_designated AS MATERIALIZED (...)` forces PostgreSQL to compute it once
  into a real tuplestore instead of inlining/re-running it. Measured: **3 min 54s** total (down from
  26 min 33s, an 85.3% reduction) — row count unchanged (52,385). The join to it is no longer
  re-executed per row, but it is still planned as a `Nested Loop` that fully scans the (now small,
  ~1,849-row) materialized set 320,025 times rather than building a hash table over it once — the
  same `rows=1` misestimate still applies, just against a far cheaper inner side.
- Forcing hash joins for this session (`SET enable_nestloop = off`, read-only diagnostic only —
  nothing was changed in the codebase or deployed) on top of the `MATERIALIZED` fix measured
  **1 min 26s** total (down from 26 min 33s, a 94.6% reduction) — row count unchanged (52,385). The
  `section_designated` scan dropped from `loops=320025` to `loops=1`, confirmed via `Hash Left Join`
  replacing the `Nested Loop Left Join` in the plan.

`GradesRcExportRepository.openGradesRcExport` already sets connection-scoped `work_mem` and `jit`
before running this exact query, for exactly this reason (tuning one known-difficult query without
touching global Postgres configuration) — adding a scoped `enable_nestloop = off` (`SET`, reset via
`RESET` before the connection returns to the pool, mirroring the existing pattern exactly, **not**
`SET LOCAL`, since this runner is never in an explicit transaction) is the same kind of change, not a
new category of risk. It is not applied globally — nested loops remain the right choice for most of
the application's other queries.

None of this has been applied to the codebase. This proposal now covers all three fixes.

**2. `gradesRc` is the only export type not using the storage pattern the other four now share.**
`defer-export-language-to-download` moved `staff`/`sections`/`enrolledStudents`/`studentSections` to a
single `rows_data` jsonb column on `core.scraping_export_runs`, fetched once per period and rendered
per language on demand. `gradesRc` instead got a dedicated child table,
`core.scraping_export_gradesrc_rows`, specifically because holding a full period's rows as one
in-memory array was judged too risky — `ScrapingExportsService`'s own historical comment records that
this exact pattern ("row array, sheet model, xlsx Buffer" all held at once) already OOM-crashed the
process in production once. That decision was made without real row-count data for gradesRc
specifically. This investigation now has it: the largest known period (202610) is **52,387 rows,
20.5MB of uncompressed row content** (measured by pulling the real generated file and inspecting the
unzipped XML — the 2.1MB _compressed_ `.xlsx` badly understates the real data volume, at a ~9.2x
compression ratio). The request driving this proposal is to re-evaluate that tradeoff with this real
number in hand, and — if it's judged acceptable — unify `gradesRc` onto the same `rows_data` jsonb
column the other four exports use, removing the dedicated table as unneeded complexity.

## What already exists

- `defer-export-language-to-download` (branch `feat/defer-export-language-to-download`, fully
  implemented and committed, not yet merged to `develop`): introduced
  `core.scraping_export_gradesrc_rows` (`ScrapingExportGradesRcRowEntity` /
  `ScrapingExportGradesRcRowRepository`), `ScrapingExportsService.materializeGradesRc` /
  `.renderGradesRc`, and the `rows_data jsonb` column on `core.scraping_export_runs` used by the other
  four export types. **This change depends on that one** — see Dependencies.
- `GRADES_RC_SQL` / `MATERIALIZE_GRADES_RC_SQL` in
  `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` — the ~500-line Banner+Planner
  cross-merge. Its own header comment already flags it as sensitive: _"IF YOU CHANGE GRADES_RC_SQL,
  RUN `test/manual/grades-rc-export.verify.ts` — nothing runs it for you, and the jest suite mocks
  `query`, so nothing else executes this SQL."_ A prior incident is recorded inline too: a second scope
  array over the same column once stopped Postgres from pushing a predicate down at all, and "the
  export then ran forever in production."
- `GradesRcExportRepository.buildGradesRcParams`
  (`src/modules/admin/scraping-exports/core/grades-rc-export.repository.ts`) — builds the merge's 16
  bound parameters, including `$10`, the scoped section-code array (intersection of uploaded sections
  and sections carrying a CONTROL outcome) that the slow filter in Problem #1 depends on.
- The raw scraping DB (`db_scrape_raw`, reached via the `exports-raw` / `EXPORTS_RAW_CONNECTION`
  datasource in application code) already has indexes on every table/column this investigation
  touched: `IDX_raw_planner_nota_run_id`, `IDX_raw_planner_nota_section_id`,
  `IDX_raw_planner_seccion_run_id`, `IDX_raw_planner_evaluacion_run_id`, and the composite unique
  `UQ_raw_planner_evaluacion_run_id_section_id_component` — the slowness is a query-shape problem, not
  a missing-index problem.

## Goals

- Fix the two confirmed inefficiencies in `GRADES_RC_SQL`'s Planner-side merge: push the section-scope
  filter onto `raw_planner_nota` before the `evaluacion` join, and make the `e_nm` name-fallback join
  conditional so it only runs when the `component_id` match actually fails.
- Fix the third, dominant inefficiency found during this change's design phase: force
  `section_designated` to materialize instead of being auto-inlined and re-executed once per output
  row, and give the query's connection the same session-scoped planner hint
  (`enable_nestloop = off`) it already gives `work_mem`/`jit`, so the join to that materialized CTE
  uses a hash join instead of a full per-row scan.
- Verify every fix with `EXPLAIN (ANALYZE, BUFFERS)` against real production data for at least both
  periods measured in this investigation (202610, 202615) before it's considered done — given this
  session's own experience that a plausible-looking rewrite made things 8x worse, "the SQL diff looks
  right" is not sufflicient evidence on its own. (The `section_designated` and `enable_nestloop` fixes
  were already validated this way during design — see Problem above — but must be re-confirmed
  against the applied code, not just the hand-built isolated query used to discover them.)
- Replace `core.scraping_export_gradesrc_rows` with the shared `rows_data` jsonb column pattern, so
  all five export types use one consistent storage shape and `gradesRc`'s dedicated table/entity/
  repository can be deleted.
- Preserve exact output correctness throughout: the generated `.xlsx` content (row count, column
  values, the clean/observations sheet split) must not change for either query rewrite or the storage
  change — only speed and storage shape change, never what the export contains.

## Non-goals

- Changing anything about _what_ `gradesRc` computes — grade resolution, the fallback/observation
  rules, which sections are in scope, column contents. Only _how fast_ it's computed and _how_ the
  result is stored.
- Re-opening the language-decoupling work itself (`defer-export-language-to-download`'s own scope) —
  this change builds on top of it, not instead of it.
- A guaranteed target duration (e.g. "under N minutes"). No such SLA has been set; the goal is a
  measured, verified improvement over the ~19-minute baseline for 202610, not a specific number.
- Migrating any other export type's storage shape — only `gradesRc` changes; the other four already
  use `rows_data`.
- Fixing the Banner-side (`banner_legs`/`banner_sections`) query path — it was checked in this
  investigation and does not show the same pathology (Banner's raw row count scales with the period
  the same ~2.9x rate everything else does, unlike Planner's 5.7x).

## Acceptance criteria

1. **AC-1** — Given the fixed `planner_raw` CTE run against real production data for period 202610,
   when its query plan is inspected with `EXPLAIN (ANALYZE, BUFFERS)`, then the section-scope filter
   appears as an index/bitmap condition directly on `raw_planner_nota` (or equivalent early pruning),
   not as a filter/join applied after the full `nota`↔`evaluacion` join.
2. **AC-2** — Given the same real data, when the `e_nm` fallback join's plan is inspected, then it is
   not evaluated for rows whose `component_id` already matched via `e_id` — it must not appear as an
   unconditional join in the plan.
3. **AC-3** — Given period 202610 (the largest known period, 52,387 rows), when `gradesRc` is
   regenerated end-to-end after the fix, then total generation time is measurably lower than the
   19m14s baseline measured in this investigation, and the resulting file's row count and content
   (both sheets) are identical to the pre-fix output for the same source data.
4. **AC-4** — Given `gradesRc`'s stored rows, when generation completes, then they are persisted in
   `core.scraping_export_runs.rows_data` (the same column/shape the other four export types use), and
   `core.scraping_export_gradesrc_rows` (table, entity, repository) no longer exists in the codebase
   or schema.
5. **AC-5** — Given a download request for `gradesRc` in either language after the storage change,
   when the file is rendered, then its content (row count, column values, sheet split) is identical to
   what the dedicated-table implementation produced for the same source data.
6. **AC-6** — Given the largest known real period (202610), when `gradesRc` is generated and then
   downloaded end-to-end in a staging/production-like environment, then the process does not exceed
   the documented 640MB container memory ceiling (`docs/CONTEXT.md`) — verified manually (see
   Dependencies on a runbook), since no automated test can assert real process memory.
7. **AC-7** — Given the fixed `flagged` CTE's join to `section_designated` run against real
   production data for period 202610, when its query plan is inspected with `EXPLAIN (ANALYZE,
BUFFERS)`, then `section_designated` is materialized (evaluated once, not inlined/re-evaluated per
   outer row — no `loops` count in the thousands on any node scanning or computing it), and the join
   to it uses a hash-based strategy rather than a `Nested Loop` scanning the full materialized set per
   outer row.

### Traceability

| AC  | Criterion                                                                           | Satisfied by |
| --- | ----------------------------------------------------------------------------------- | ------------ |
| 1   | Section-scope filter pushed down before the nota↔evaluacion join                    | TBD          |
| 2   | `e_nm` fallback join only runs when `component_id` doesn't match                    | TBD          |
| 3   | Measured generation-time improvement + identical output for 202610                  | TBD          |
| 4   | `gradesRc` rows stored in `rows_data`; dedicated table/entity/repository removed    | TBD          |
| 5   | Download output identical to the dedicated-table implementation                     | TBD          |
| 6   | Full generate+download cycle for 202610 stays within the 640MB container ceiling    | TBD          |
| 7   | `section_designated` materialized and hash-joined, not inlined/re-evaluated per row | TBD          |

## Dependencies

- **`defer-export-language-to-download`** — **already merged to `develop`** (PR #126) and archived
  to `openspec/specs/defer-export-language-to-download/` (PR #127) as of design time. This change's
  starting point — the `rows_data` column and five-export-type architecture — is already live; no
  merge-order coordination is needed.
- `test/manual/grades-rc-export.verify.ts` — the existing manual verification script for
  `GRADES_RC_SQL` changes; should be run (and updated if needed) as part of validating the query
  rewrite, per the file's own stated convention.
- Read/write access to a real or realistic-scale Postgres instance for both the query-rewrite
  validation and the memory/AC-6 check — a toy local dataset cannot reproduce the row-count asymmetry
  this whole investigation was built on.

## Risks

| Risk                                                                                                                                                                                                                                                                                                                                                    | Impact                                                                                                                                                                                 | Mitigation                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query rewrites to `GRADES_RC_SQL` are non-intuitive — this investigation's own first attempt made things 8x worse, not better                                                                                                                                                                                                                           | A "fix" could ship a regression, or worse, silently change which rows are included/excluded (a correctness bug in real grade data)                                                     | Every rewrite validated with `EXPLAIN (ANALYZE, BUFFERS)` against real data for multiple periods before merging (AC-1/AC-2), plus explicit row-count/content diffing against the pre-fix output (AC-3/AC-5), plus the existing manual verify script                                                        |
| Moving `gradesRc` to a single `rows_data` jsonb column reintroduces the class of risk the dedicated table was built to avoid — a full period held as one in-memory array/ExcelJS model, the same pattern that already OOM-crashed production once                                                                                                       | A future period larger than 202610 could crash the process the same way; JSON.parse + camelizeKeys over a large row array is not paginated the way the child table's reads were        | This proposal accepts real data (52,387 rows / 20.5MB) as evidence the risk is currently small, but design must explicitly reason about it (estimated in-memory footprint vs. the 640MB cap) rather than assume "smaller file size" is sufficient proof — AC-6 makes this a checked, not assumed, property |
| This change reverses recently-written, not-yet-merged code from `defer-export-language-to-download`                                                                                                                                                                                                                                                     | Wasted work if that change's design is revisited before merging; migration sequencing gets more complex if both are in flight at once                                                  | Explicit dependency called out above; design phase should state merge order                                                                                                                                                                                                                                |
| Disabling `enable_nestloop` for `GRADES_RC_SQL`'s connection is a blunt, query-wide planner override, not a targeted fix for the one join site that needs it                                                                                                                                                                                            | A future edit to `GRADES_RC_SQL` could rely on a nested loop being genuinely cheaper somewhere else in the same query and regress under this setting without anyone connecting the two | Scoped to exactly the one connection this query already tunes `work_mem`/`jit` on, reset immediately after (mirrors existing precedent, not a new pattern); re-validated with `EXPLAIN` (AC-7) whenever `GRADES_RC_SQL` changes, per the file's own existing convention                                    |
| `section_designated`'s per-row re-execution (AC-7) was found live during design, not anticipated at proposal time — the same class of `unnest($n::text[])`-driven cardinality misestimate could exist elsewhere in this ~500-line query and simply hasn't surfaced yet (no other node showed `loops` in the thousands during this investigation's runs) | A different, still-undiscovered instance of the same pathology could keep the fixed query slower than necessary, or resurface after an unrelated future edit                           | Not treated as fully closed by this proposal — the fixed query's own `EXPLAIN` output (AC-1/AC-2/AC-7) is the check; a future change touching this query should look for the same signature (`loops` in the thousands feeding an unconditionally-scanned CTE) before assuming a slowdown is unrelated      |

## Open questions

None blocking. The two things above that read like open questions — whether the memory tradeoff is
truly acceptable, and exact merge-order sequencing with `defer-export-language-to-download` — are
scoped as explicit, checkable acceptance criteria and dependencies instead, for `/abet-design-feature`
to resolve with a real answer rather than a guess at proposal time.
