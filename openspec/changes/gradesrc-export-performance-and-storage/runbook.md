# Runbook — Speed up gradesRc export generation and unify its storage with the other exports

**Slug**: `gradesrc-export-performance-and-storage`

Four of this proposal's acceptance criteria (AC-1, AC-2, AC-6, AC-7) and part of a fifth (AC-3's
duration claim) can only be verified against real, production-scale data — the `EXPLAIN` plan shape
these fixes target and the OOM risk ADR-004 accepts do not reproduce on toy fixtures. This runbook is
that verification plan.

**Expected magnitude, from design-time validation (see `design.md` § AC-7)**: the full
`GRADES_RC_SQL` query, run stand-alone via `EXPLAIN (ANALYZE, BUFFERS)` against real 202610 data
under Postgres's _default_ `work_mem`, dropped from 26m 33s to 1m 26s (94.6% reduction) once all
three SQL/connection fixes were applied — the two originally-scoped bugs (AC-1/AC-2) accounted for
only about a minute of that; the dominant fix was forcing `section_designated` to materialize and
forcing a hash join for it (AC-7). Step 3 below measures the _real_ application-level number, under
production's actual `work_mem = '128MB'` setting and the full generation pipeline (not just the raw
SQL) — expect it to land well under the historical ~19-minute baseline, but this design-time number
is a directional expectation, not the acceptance figure. Record whatever step 3 actually measures.

## ⚠️ Deploy prerequisite

```bash
# 1. Run migrations BEFORE deploying the new application image — the new image's code no longer
#    writes to core.scraping_export_gradesrc_rows, and the migration drops that table. Running the
#    migration after deploying the old image is harmless (the old image keeps writing to a table
#    that still exists); running the new image before the migration is also harmless (it simply
#    never touches the table). The only bad order is deploying an image OLDER than this change
#    AFTER the migration has run — that image would try to write rows into a table that no longer
#    exists and every gradesRc generation would fail. Do not roll back the application image past
#    this change without first running `pnpm migration:revert` for the migration below.
pnpm migration:run

# 2. No seed step, no permission sync — this change touches no auth/permission data.
```

## Manual validation

| #   | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Expected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Before deploying: capture the current `gradesRc` output for period 202610 — `POST .../gradesRc/regenerate`, wait for `status` to report `completed`, then `GET .../gradesRc/download?lang=es`. Save the file as `pre-fix-202610-es.xlsx`. Also record the wall-clock time from `regenerate` call to `completed` status.                                                                                                                                              | A file downloads; note its row count (Data sheet + observations sheet) and the elapsed time (expect close to the ~19m14s baseline, since this is pre-fix).                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2   | Deploy this change (migration first, per the deploy prerequisite above).                                                                                                                                                                                                                                                                                                                                                                                             | `GET .../gradesRc/status?period=202610` reports `notGenerated` until the next trigger — this is expected; nothing in this change repopulates old rows.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | `POST .../gradesRc/regenerate` for period 202610 again, post-fix. Time it the same way as step 1.                                                                                                                                                                                                                                                                                                                                                                    | Completes in **measurably less time** than step 1's baseline (AC-3). Given design-time validation (see above), expect a dramatic improvement, not a marginal one — if the real number is only marginally better than step 1, that is a signal the dominant fix (AC-7, `section_designated AS MATERIALIZED` + the `enable_nestloop` setting) did not take effect as expected in the deployed code, worth investigating before accepting the result. Record the exact before/after numbers in the PR description — no specific target duration was ever set as an SLA, only a measured improvement. |
| 3a  | While a real regenerate is inconvenient to `EXPLAIN` directly (it runs through the application, not a raw `psql` session), confirm AC-7 independently: connect to the raw datasource with the same credentials `GradesRcExportRepository` uses, and run `EXPLAIN (ANALYZE, BUFFERS)` on `MATERIALIZE_GRADES_RC_SQL` for period 202610 with `SET work_mem='128MB'; SET jit=off; SET enable_nestloop=off;` applied first, matching what `openGradesRcExport` now does. | The plan shows `section_designated` computed once (`loops=1`) and joined via a hash strategy, not a `Nested Loop` re-scanning it per output row.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | `GET .../gradesRc/download?lang=es` for the same period. Save as `post-fix-202610-es.xlsx`. Diff row-for-row against `pre-fix-202610-es.xlsx` (row count per sheet, and either a full diff or a content hash per row — sort both by `sectionCode`/`studentCode` first, since ordering is defined but a byte-identical `.xlsx` is not guaranteed across ExcelJS runs).                                                                                                | Identical row count and column values on both sheets (AC-3's content-identity clause, AC-5). Only generation speed and storage shape should differ — never content.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | While step 3's `regenerate` is running, and again immediately after it completes and the file downloads in step 4, watch the `sys_acc_back` container's memory (`docker stats sys_acc_back` or the platform's equivalent) against the documented 640MB `mem_limit`.                                                                                                                                                                                                  | Peak RSS stays under 640MB through both the generate and the download (render) phases (AC-6). If it does not, this is a real signal that ADR-004's accepted risk has already materialized at today's data volume, not a future concern — stop and escalate rather than shipping.                                                                                                                                                                                                                                                                                                                  |
| 6   | Repeat steps 3–4 (regenerate + download diff) for period 202615, for parity with the design's own two-period validation, if the account used has SSH/DB access equivalent to what design.md's investigation used.                                                                                                                                                                                                                                                    | Same content-identity result as period 202610; timing improvement need not be as dramatic (202615 was never the slow case).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7   | Confirm `core.scraping_export_gradesrc_rows` no longer exists post-migration: `\d core.scraping_export_gradesrc_rows` in `psql` against the main datasource.                                                                                                                                                                                                                                                                                                         | `Did not find any relation named ...` — the table is gone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Data validation

```sql
-- Run against the MAIN datasource (db_sys_acc), after the migration.
-- Expected: 0 rows (relation does not exist — this query itself should fail with
-- "relation core.scraping_export_gradesrc_rows does not exist", which is the pass condition).
SELECT count(*) FROM core.scraping_export_gradesrc_rows;

-- Confirm the gradesRc row for the regenerated period carries data in rows_data, the same column
-- the other four export types use. Expected: rows_data is a non-null jsonb array of length > 0.
SELECT
  export_type AS "exportType",
  period,
  status,
  jsonb_array_length(rows_data) AS "rowCount"
FROM core.scraping_export_runs
WHERE export_type = 'gradesRc' AND period = '202610';
```

## Symptom → diagnosis

| Symptom                                                                                                                                                                | Likely cause                                                                                                                                                                                                                                                    | Check                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regenerate` for `gradesRc` fails immediately after deploy, before the merge even starts                                                                               | Migration ran but an old (pre-fix) application image is still serving traffic and still tries to write `core.scraping_export_gradesrc_rows`                                                                                                                     | `docker ps` / deployment history for the image tag actually running; redeploy the correct image, or run `pnpm migration:revert` if rolling the image back is not immediately possible                                                                                                                                |
| `download` for `gradesRc` returns 404-equivalent (`null`) right after a successful `regenerate`                                                                        | `rowsData` ended up `null` or empty on the row — check `runGradesRcGeneration`'s upsert actually ran with a non-empty array                                                                                                                                     | `SELECT rows_data FROM core.scraping_export_runs WHERE export_type='gradesRc' AND period=...` — if `null`, check application logs for the generation's error path                                                                                                                                                    |
| Container OOM-kills during a `gradesRc` generate or download for a period larger than 202610                                                                           | ADR-004's accepted risk has materialized — a real period exceeds the size this change validated against                                                                                                                                                         | Check the `warn`-level oversized-batch log line (Task 2.3) fired before the crash; if it did not fire, the threshold constant needs lowering; if it did fire, this is expected per ADR-004 and needs a follow-up change (re-introducing streaming storage for `gradesRc` specifically), not a hotfix to this one     |
| The two-period `EXPLAIN` check (Task 1.6) shows the section-scope filter no longer hitting `IDX_raw_planner_nota_section_id` in production, despite passing in staging | Table statistics drift, or a real data-volume change since design (e.g. a much larger scrape) shifted the planner's cost estimate away from the bitmap plan                                                                                                     | Re-run `ANALYZE` on `raw_planner_nota`/`raw_planner_seccion`/`raw_planner_evaluacion` in the raw datasource, then re-check the plan                                                                                                                                                                                  |
| `regenerate` for `gradesRc` is only marginally faster than the pre-fix baseline (step 3), not dramatically                                                             | The dominant fix (AC-7 — `section_designated AS MATERIALIZED` plus `enable_nestloop = off` on the merge's connection) did not take effect: either the SQL edit didn't ship, or `enable_nestloop` isn't actually being reset/set on the connection actually used | Run step 3a's direct `EXPLAIN` check; confirm `section_designated` shows `loops=1` and a hash-based join, not a `Nested Loop` with a `loops` count in the thousands — if the loop count is still high, the `MATERIALIZED` keyword or the `SET`/`RESET enable_nestloop` calls did not make it into the deployed image |

## How to revert

```bash
# Application code: revert the PR's commits as usual.

# Migration: only necessary if the code revert would otherwise leave old code trying to write to
# a table this change dropped. Revert the migration BEFORE deploying the reverted (pre-fix) image.
pnpm migration:revert
```

Reverting the migration recreates `core.scraping_export_gradesrc_rows` (empty — see Task 2.1's
`down()`), matching what the pre-fix code expects. There is no data to restore: `gradesRc`'s
persisted rows are pure cache, regenerated on the next scrape completion or manual `regenerate`,
the same as every other export type.

## Do NOT

- Do **not** deploy the reverted (pre-fix) application image before running `pnpm migration:revert`
  — it will try to write to a table that no longer exists and every `gradesRc` generation will fail
  until the migration catches up.
- Do **not** treat a passing `test/manual/grades-rc-export.verify.ts` run as sufficient evidence for
  AC-1/AC-2 — it runs against small fixture data and cannot reproduce the row-count asymmetry (or
  the query-planner behavior) that this whole investigation is about. Only a real `EXPLAIN` against
  production-scale data satisfies those two ACs.
- Do **not** skip the memory watch in step 5 because "20.5MB sounds small." That number is
  uncompressed row _content_; `JSON.parse` plus `camelizeKeys` materializing a second camelCase copy
  of every object, plus whatever the streaming `.xlsx` writer holds concurrently, is the real number
  that matters against the 640MB ceiling — and it has not been directly measured, only estimated.
