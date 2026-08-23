# Design — Speed up gradesRc export generation and unify its storage with the other exports

**Slug**: `gradesrc-export-performance-and-storage`
**Proposal**: `./proposal.md`

## Read first

- `openspec/changes/gradesrc-export-performance-and-storage/proposal.md` — the full investigation,
  measurements and acceptance criteria this design implements.
- `docs/adr/ADR-003-language-neutral-scraping-export-generation.md` — the language-neutral
  generation model this change builds on, and the storage split (jsonb for four exports, a
  dedicated table for `gradesRc`) it originally decided.
- `docs/adr/ADR-004-gradesrc-rows-in-shared-jsonb-storage.md` — written as part of this design,
  because the proposal's storage goal contradicts ADR-003's own "Alternatives considered". Read
  this before touching storage — it carries the negative consequences this design accepts.
- `docs/POLICIES.md` § Migrations — forward-only; the already-applied
  `add-scraping-export-gradesrc-rows-table` migration cannot be edited, only reversed by a new one.
- `docs/CONTEXT.md` § Database, § Business Rules — the retention rule this change removes, and the
  `core` schema row this change edits.
- `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` — `GRADES_RC_SQL`'s
  `planner_raw` CTE (the query being rewritten) and `MATERIALIZE_GRADES_RC_SQL`/
  `READ_GRADES_RC_ALL_PAGE_SQL` (the temp-table paging the rewrite does not touch).
- `src/modules/admin/scraping-exports/core/grades-rc-export.repository.ts` — `openGradesRcExport`,
  the connection-pinning handle the storage change also touches.
- `src/modules/admin/scraping-exports/api/scraping-exports.service.ts` and
  `scraping-export-generation.service.ts` — `materializeGradesRc`/`renderGradesRc` and
  `runGradesRcGeneration`/`download`, all rewritten to the shared `rowsData` path.
- `src/modules/admin/scraping-exports/model/scraping-export-gradesrc-row.entity.ts` and
  `core/scraping-export-gradesrc-row.repository.ts` — deleted by this change.
- `test/manual/grades-rc-export.verify.ts` — the mandated manual verification script for
  `GRADES_RC_SQL` changes. **Found already broken on `develop`**: it imports
  `READ_GRADES_RC_PAGE_SQL`, which no longer exists (renamed to `READ_GRADES_RC_ALL_PAGE_SQL` by
  the already-merged `defer-export-language-to-download`), and its `verifySplit` helper calls the
  old three-argument page shape. This is fixed as Task 1.1, before any SQL rewrite, so there is a
  working baseline to diff against.
- **Live investigation, done as part of this design** (SSH, read-only `EXPLAIN`/`SELECT` only, no
  writes) against the production raw-scraping database for period 202610 — see "AC-1 / AC-2"
  below for the numbers. This reproduces and extends the proposal's own investigation, using the
  server's current real data (a fresh Banner/Planner run for 202610 completed the same day), so
  the baseline numbers differ slightly from the proposal's original measurement but confirm the
  same two root causes.
- **A second round of the same live investigation, this time against the full `GRADES_RC_SQL`
  query end-to-end** (all 16 bound parameters assembled from real data, not just the isolated
  `planner_raw` CTE) — see "AC-7" below. This is what found the change's actual dominant cost: a
  `section_designated` CTE the planner auto-inlines and re-executes once per output row (320,025
  times), not either of the two bugs named in the proposal's original problem statement. Confirmed
  fixed, three ways, against real production data (see AC-7).

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                                                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datastore, broker or cache choice             | No — stays Postgres, main datasource, same as ADR-003.                                                                                                                                                      |
| Auth or payments provider                     | No                                                                                                                                                                                                          |
| Public API contract change or breaking change | No — `status`/`download`/`regenerate` wire shapes are unchanged; `rowsData` was never exposed (`ScrapingExportStatusResponse` excludes it by design, per its own comment). No `openapi.json` change needed. |
| New module boundary or cross-repo split       | No — single-repo (backend only), same module.                                                                                                                                                               |
| Language, runtime or framework                | No                                                                                                                                                                                                          |
| Contradicting an existing ADR                 | **Yes** — ADR-003 explicitly rejected storing `gradesRc` rows in a single jsonb blob.                                                                                                                       |

**Conclusion**: ADR required and written — **[ADR-004](../../../docs/adr/ADR-004-gradesrc-rows-in-shared-jsonb-storage.md)**. ADR-003's Status line is updated to point to it (partial supersession: only the `gradesRc` storage-shape decision changes; ADR-003's language-neutral generation model, the `(exportType, period)` key, and the single-flight guard all stand).

## Approach

### AC-1 — Section-scope filter pushed onto `raw_planner_nota` before the `evaluacion` join

**Root cause, confirmed against real production data (period 202610, `run_id
ce2d95f3-0805-45af-ae7a-291af5ed4135`, isolated `planner_raw` CTE, `EXPLAIN (ANALYZE, BUFFERS)`):**
the current query's only section-scope predicate is
`s.payload->>'sectionNumber' = ANY($10::text[])` on `raw_planner_seccion` (`s`), applied as a
`Filter` _after_ `raw_planner_nota` (`n`) is already fully scanned by `run_id` alone (a
`Parallel Index Scan using "IDX_raw_planner_nota_run_id"`, ~800k+ rows across workers) and hash-
joined against **both** `raw_planner_evaluacion` legs (`e_id` and `e_nm`). Measured baseline:
**86.35s** execution time for the isolated CTE.

**Fix**: resolve the scoped section codes to `raw_planner_seccion.section_id` first, then filter
`raw_planner_nota` directly on `section_id` — the exact `= ANY(ARRAY(SELECT ...))` shape the
proposal's own investigation confirmed pushes onto `IDX_raw_planner_nota_section_id` as a
`Bitmap Index Scan` (a naive `IN (SELECT ...)` was independently confirmed, both in the original
investigation and not re-tested here, to make Postgres bolt the filter on as an outer nested loop
instead):

```sql
scoped_planner_sections AS (
	SELECT section_id
	FROM raw_planner_seccion
	WHERE run_id = (SELECT id FROM planner_run)
	  AND payload->>'sectionNumber' = ANY($10::text[])
),
planner_raw AS (
	SELECT ...
	FROM raw_planner_nota n
	JOIN raw_planner_seccion s
	  ON s.run_id = n.run_id
	 AND s.section_id = n.section_id
	...
	WHERE n.run_id = (SELECT id FROM planner_run)
	  AND n.section_id = ANY(ARRAY(SELECT section_id FROM scoped_planner_sections))
	  AND ...
	  -- s.payload->>'sectionNumber' = ANY($10::text[]) and the NULLIF/TRIM check on it are DROPPED:
	  -- s is now reached only via section_ids already drawn from scoped_planner_sections, which
	  -- required exactly that match to produce them, so the predicate is guaranteed, not filtered.
)
```

**Confirmed on real data**: candidate plan shows `Bitmap Index Scan on "IDX_raw_planner_nota_section_id"`
narrowing to the scoped rows before the heap fetch, exactly matching AC-1's wording ("appears as an
index/bitmap condition directly on `raw_planner_nota`... not as a filter/join applied after the
full `nota`↔`evaluacion` join").

### AC-2 — `e_nm` fallback only evaluated when `component_id` doesn't match

**Root cause, confirmed on the same real data**: the current `LEFT JOIN raw_planner_evaluacion e_nm
ON e_id.id IS NULL AND ...` is still planned as a full `Parallel Hash Left Join` against the
**entire** `e_nm` relation for the run (`Parallel Hash` over `raw_planner_evaluacion`, ~32k rows
per worker) — the `e_id.id IS NULL` condition is a `Join Filter`, evaluated per probe, not a
predicate that stops the hash build from happening. This matches the proposal's own finding: 0% of
real rows ever need this fallback, so 100% of that hash build and probe is wasted work.

**Fix**: replace the second `LEFT JOIN` with a scalar correlated subquery inside the existing
`COALESCE`, relying on `COALESCE`'s documented left-to-right short-circuit evaluation — Postgres
does not evaluate a `COALESCE` argument once an earlier one is non-null:

```sql
LEFT JOIN raw_planner_evaluacion e_id
  ON e_id.run_id = n.run_id
 AND e_id.eval_component_id = n.component_id
CROSS JOIN LATERAL (
	SELECT COALESCE(
		e_id.payload,
		(SELECT e_nm.payload
		 FROM raw_planner_evaluacion e_nm
		 WHERE e_nm.run_id = n.run_id
		   AND e_nm.section_id = n.section_id
		   AND e_nm.payload->>'evalComponentName' = n.payload->>'evaluation'
		 LIMIT 1)
	) AS payload
) ev
```

`e_id` stays a real `JOIN` — untouched — because it is already the fast path (matched via a hash
join keyed on `run_id`, cheap relative to the table sizes involved) and because converting it to a
scalar subquery would risk a real behavior change: `raw_planner_evaluacion` is only unique on
`(run_id, section_id, eval_component_id)` (`UQ_raw_planner_evaluacion_run_id_section_id_component`),
not on `(run_id, eval_component_id)` alone, so a `JOIN` on `(run_id, eval_component_id)` (no
`section_id`) could in principle match more than one row and legitimately fan out — a `LIMIT 1`
subquery would silently collapse that instead. This is pre-existing behavior (the `e_id` predicate
is identical before and after this change) and out of scope per the proposal's non-goals ("changing
anything about _what_ `gradesRc` computes"); only `e_nm` — which already carries no such uniqueness
guarantee and is added as a `LIMIT 1` for the first time here — gets the subquery form. Because 0%
of real rows exercise this path, `LIMIT 1`'s arbitrary tie-break is never actually reached against
real data.

**Confirmed on real data**: candidate plan shows the `e_nm` subplan **`(never executed)`** three
times over (once per its use inside the three `COALESCE` references the planner desugars it into),
directly proving AC-2's wording ("must not appear as an unconditional join in the plan").

### AC-7 — `section_designated` materialized and hash-joined, not inlined and re-evaluated per row

**This is the change's actual dominant fix, found live during design, after AC-1/AC-2 were already
validated.** Timing the isolated `planner_raw` CTE (AC-1/AC-2's own validation) said nothing about
the _full_ query, so this design also ran the complete `GRADES_RC_SQL` — all 16 bound parameters,
assembled from real data (period codes, type codes, the scoped-section array, the full enrollment
pairs, the static program→career map) — through `EXPLAIN (ANALYZE, BUFFERS)` against production,
end to end, four times:

| Run         | Change from baseline                          | Execution time                 | Rows   |
| ----------- | --------------------------------------------- | ------------------------------ | ------ |
| Baseline    | none (current `develop`)                      | **26m 33s** (1,593,220 ms)     | 52,385 |
| Candidate 1 | AC-1 + AC-2 fixes only                        | 28m 12s (1,692,345 ms) — noise | 52,385 |
| Candidate 2 | + `section_designated AS MATERIALIZED`        | **3m 54s** (233,855 ms)        | 52,385 |
| Candidate 3 | + `enable_nestloop = off` for this connection | **1m 26s** (86,035 ms)         | 52,385 |

Candidate 1 confirms AC-1/AC-2 are correct but not the dominant cost: fixing them alone is
indistinguishable from run-to-run noise against a 26-minute baseline. **Root cause of the real
26m 33s**: `flagged`'s `LEFT JOIN section_designated sd ON sd.section_code = r.section_code` planned
as a `Nested Loop Left Join` that **re-executed `section_designated`'s own
join/`WHERE`/`DISTINCT ON` logic once per outer row — 320,025 times** (`loops=320025` on the CTE's
scan), removing 302 million rows through its join filter along the way. This one node cost **25m 8s**
of the 26m 33s baseline — 94.6% of the total. `section_designated` is referenced only once (inside
`flagged`), and PostgreSQL auto-inlines a singly-referenced CTE by default (since PG12) instead of
materializing it. Combined with a systemic problem this query has throughout — every CTE built over
an `unnest($n::text[])`-style runtime array parameter (`designated`, `resolved`, `section_designated`
itself, and others) is estimated by the planner at `rows=1` regardless of the array's real size at
execution time, and that estimate cascades into every join built on top — the planner has no signal
that re-running this CTE per row is expensive, and picks the cheapest-_looking_ plan instead.

**Fix, part 1 — force materialization:**

```sql
section_designated AS MATERIALIZED (
	SELECT DISTINCT ON (r.section_code)
		r.section_code,
		r.grade_type_code AS designated_code,
		r.raw_type        AS designated_name,
		r.weight          AS designated_weight
	FROM resolved r
	JOIN designated d ON d.section_code = r.section_code
	WHERE r.grade_type_code = ANY(d.grade_type_codes)
	ORDER BY r.section_code, r.grade_type_code, r.student_code
),
```

Confirmed on real data (Candidate 2): the CTE is computed once; the join to it is no longer
re-executed, cutting 26m 33s to 3m 54s (85.3% reduction). It is still a `Nested Loop` against the
materialized set — cheap now (a full scan of ~1,849 rows, not a full re-computation) but still run
320,025 times, because the same `rows=1` misestimate applies to the _join_, not just the CTE's own
execution.

**Fix, part 2 — force a hash join for this one connection:**

```sql
-- alongside the existing SET work_mem / SET jit in GradesRcExportRepository.openGradesRcExport
SET enable_nestloop = off;
-- ... run MATERIALIZE_GRADES_RC_SQL ...
RESET enable_nestloop; -- alongside the existing RESET work_mem / RESET jit in closeGradesRcExport
```

Confirmed on real data (Candidate 3): `section_designated`'s scan drops from `loops=320025` to
`loops=1`, and the plan shows a `Hash Left Join` in place of the `Nested Loop Left Join` — cutting
3m 54s to 1m 26s (a further 63% reduction; 94.6% off the original baseline). Plain `SET`/`RESET`,
not `SET LOCAL` — this query's runner is never in an explicit transaction, matching the existing
`work_mem`/`jit` precedent on the same connection exactly (see `docs/CONTEXT.md`'s "connection is
reused by unrelated queries once returned" reasoning already documented for those two). This is
scoped to the one connection this one query borrows for the merge — not a global planner setting —
so it does not affect any other query in the application.

Row count was **52,385 across all four runs** — every fix (AC-1, AC-2, AC-7's two parts) is a pure
plan-shape change; none of them touched which rows are produced or what they contain.

### AC-3 — Measured generation-time improvement, identical output

AC-1/AC-2's isolated `planner_raw` CTE measured **86.35s → 53.22s** in isolation (a ~38% reduction
for that piece alone) — see AC-1/AC-2 above. But that isolated number understated how small a share
of the full pipeline those two fixes actually are: AC-7's full-query measurement (same
methodology, same real data) is the one that matters for AC-3's actual gate, and shows the change
as a whole — all three fixes together — taking the full `GRADES_RC_SQL` from **26m 33s to 1m 26s**,
a 94.6% reduction, with identical row counts and (by construction — none of the three fixes touch
row selection, computation, or ordering) identical content throughout.

This is still not the same as the application's own **19m14s** baseline from the original
investigation — these `EXPLAIN` runs use Postgres's default `work_mem` (~4MB), not the 128MB
`GradesRcExportRepository.openGradesRcExport` sets before the real merge, so absolute times are not
directly comparable across the two contexts (only the _relative_ improvement, measured consistently
across all four runs above, is trustworthy). AC-3's actual gate remains **"measurably lower than the
real 19m14s app-level baseline for 202610"**, verified by timing a real end-to-end `regenerate` — a
runbook step (real Banner+Planner data, historically ~19 minutes to run once), not a unit test. Given
the magnitude found here, that real number is expected to drop sharply, but the runbook step is what
actually confirms it, not this design-time estimate.

Content identity (row count, column values, both sheets) is verified two ways: the fixed
`test/manual/grades-rc-export.verify.ts` (behavioral assertions against fixture data covering
every branch of the merge, including the `e_nm` fallback path itself — this is the one place the
fallback _is_ exercised, by construction, since production data never does) run before and after
the SQL change; and, per the runbook, a diff of the real 202610 output (row count + a content hash
per row) generated before and after deploying the fix.

### AC-4 / AC-5 — `gradesRc` rows in `rows_data`; dedicated table deleted; download output unchanged

Per **ADR-004**: `gradesRc` generation stops writing to `core.scraping_export_gradesrc_rows` and
instead assembles the full row array in memory — the same shape `fetchStaffRows`/`fetchSectionRows`/
etc. already produce — then writes it through `ScrapingExportRunRepository.upsertByKey`'s existing
`rowsData` field, identically to the other four export types. `download` folds `gradesRc` into the
same `if (!reconciled.rowsData) return null;` branch the other four already use, instead of its
own `hasRows`/`finishedAt`-pinned read path.

This changes the _source_ of the array (an in-memory collect over `GradesRcExportRepository
.openGradesRcExport(...).rows()`, still keyset-paged off the `TEMP` table 5,000 rows at a time, per
`GRADES_RC_PAGE_SIZE` — unchanged) but not its _shape_: each element remains a
`GradeRcExportRow & { hasObservations: boolean }`, the same type the child table's rows held.
`renderGradesRc` splits the in-memory array by `row.hasObservations` (a plain `Array.prototype
.filter`) instead of two indexed `WHERE` reads, and still writes through
`ExcelJS.stream.xlsx.WorkbookWriter` (kept, not switched to the sync exports'
`ExcelJS.Workbook` in-memory model) — streaming the output workbook is a separate memory concern
from holding the row array, and there is no reason to give that up now that the _rows_ live in an
array; only the sync exports' small row counts make an in-memory `Workbook` acceptable for them.

`hasObservations` itself is _kept_ exactly as `MATERIALIZE_GRADES_RC_SQL` already computes it
(`COALESCE(cardinality(q."observations"), 0) > 0`) — not recomputed client-side — to avoid touching
that query's output shape at all; it is simply consumed from the in-memory array instead of a
`WHERE hasObservations = ...` on a table.

Deleting the dedicated storage requires, together:

- A new forward-only migration dropping `core.scraping_export_gradesrc_rows` (the existing
  `add-scraping-export-gradesrc-rows-table` migration is already applied in production and must
  not be edited — see `docs/POLICIES.md` § Migrations).
- Deleting `ScrapingExportGradesRcRowEntity`, `ScrapingExportGradesRcRowRepository`, and its spec.
- Removing both from `scraping-exports.module.ts` (`TypeOrmModule.forFeature` entry and the
  provider), and removing the now-unused constructor dependency from
  `ScrapingExportGenerationService` and `ScrapingExportsService`.
- Updating `ScrapingExportRunEntity.rowsData`'s doc comment, which currently states it is "Always
  null for gradesRc... too large to hold safely in one jsonb blob" — now false, and pointing at
  ADR-004 instead.

**Atomicity is a genuine simplification, not just a deletion.** The child table needed
`generatedAt`-tagged batches plus an explicit "insert new batch → flip parent to `completed` →
delete stale batch, in that order" sequence, entirely to make a multi-row write look atomic to a
concurrent `download`. A single `rowsData` column write is already one row — Postgres's own MVCC
gives that guarantee for free. `runGradesRcGeneration` drops the
`gradesRcRowRepository.deleteStaleBatches` call and the `generatedAt` parameter threading
entirely; there is no new batch/old batch distinction left to track.

**Named ADR-004 risk, given a concrete mitigation**: a future period growing meaningfully past
202610's 52,387 rows / 20.5MB has no per-row streaming safety net once rows live in one `jsonb`
value. Mitigation adopted here (see `Risks`): `ScrapingExportGenerationService` logs a `warn` if
the collected `gradesRc` row array exceeds a documented threshold (proposed:
150,000 rows — roughly 3x the largest known real period) right before persisting it, so growth
becomes visible in logs long before it becomes a production incident, without adding a hard cap or
any new abstraction.

### AC-6 — Memory ceiling (manual, runbook)

No automated test can assert real process RSS. The runbook directs a full generate + download
cycle for 202610 against a staging/production-like environment, watching container memory against
the documented 640MB `mem_limit`, per `docs/CONTEXT.md`. This is unchanged in kind from what
ADR-002/ADR-003 already required for the sync exports; ADR-004's own "Alternatives considered"
argues the measured 20.5MB is small enough that this is confirmatory, not exploratory.

## Backend

- **Module**: `src/modules/admin/scraping-exports/`
- **Migrations**:
  - `pnpm migration:create src/database/migrations/drop-scraping-export-gradesrc-rows-table` — new,
    CLI-timestamped, forward-only. `up()` drops `core.scraping_export_gradesrc_rows` (and its FK/
    index, dropped implicitly with the table). `down()` recreates the table/FK/index exactly as
    `1787378550454-add-scraping-export-gradesrc-rows-table.ts` created them, so a rollback restores
    the _shape_ (not the data).
    > **Correction (audit, 2026-08-22):** the assumption originally written here — "the table will
    > be empty either way by the time this runs, since `gradesRc` generation no longer writes to
    > it" — does not hold. `defer-export-language-to-download`, which created this table, is
    > already merged to `develop` and may have real rows in it by the time this migration deploys.
    > `up()` now backfills each run's latest batch into `rowsData` (guarded on `status = 'completed'`
    > and `rowsData IS NULL`) before dropping the table, and `down()` clears `gradesRc`'s `rowsData`
    > for symmetry. See the migration file and `tasks.md`'s "Audit fixes" section.
  - No migration needed for `rows_data` itself — that column and its `UQ_scraping_export_runs_export_type_period`
    constraint already exist from the already-merged `defer-export-language-to-download`.
- **Entities**: delete `ScrapingExportGradesRcRowEntity`
  (`model/scraping-export-gradesrc-row.entity.ts`). Update `ScrapingExportRunEntity.rowsData`'s
  comment (`model/scraping-export-run.entity.ts`) to drop the "always null for gradesRc" claim and
  reference ADR-004.
- **Repositories**: delete `ScrapingExportGradesRcRowRepository`
  (`core/scraping-export-gradesrc-row.repository.ts`) and its spec. `GradesRcExportRepository`
  (`core/grades-rc-export.repository.ts`) keeps its shape (`openGradesRcExport` /
  `GradesRcExportHandle`); `grades-rc-export.sql.ts`'s `GRADES_RC_SQL` changes (AC-1/AC-2/AC-7's
  `section_designated AS MATERIALIZED`), and `openGradesRcExport`/`closeGradesRcExport` add
  `SET enable_nestloop = off` / `RESET enable_nestloop` alongside the existing `work_mem`/`jit`
  pair (AC-7 part 2).
- **Services**:
  - `ScrapingExportsService` — replace `materializeGradesRc(academicPeriodId, runId, generatedAt)`
    with `fetchGradesRcRows(academicPeriodId): Promise<Array<GradeRcExportRow & { hasObservations: boolean }>>`,
    mirroring `fetchStaffRows` et al. (collects `handle.rows()` into one array, still page-reading
    the `TEMP` table at `GRADES_RC_PAGE_SIZE`). Replace `renderGradesRc(scrapingExportRunId,
generatedAt, lang)` with `renderGradesRc(rows: Array<GradeRcExportRow & { hasObservations:
boolean }>, lang)`, splitting via `rows.filter((r) => !r.hasObservations)` /
    `rows.filter((r) => r.hasObservations)` instead of two `gradesRcRowRepository.readPage` calls;
    `pageGradesRcRows`'s DB-paging generator is deleted (no longer needed — the array is already
    in memory).
  - `ScrapingExportGenerationService.runGradesRcGeneration` — call `fetchGradesRcRows`, log the
    oversized-batch warning (see AC-4/5 above) if `rows.length` exceeds the threshold constant, then
    a single `runRepository.upsertByKey('gradesRc', period, { status: 'completed', rowsData: rows,
... })` — identical shape to the non-gradesRc branch of `runGeneration`. Delete the
    `gradesRcRowRepository.deleteStaleBatches` call and its try/catch, and the `gradesRcRowRepository`
    constructor dependency.
  - `ScrapingExportGenerationService.download` — delete the `gradesRc`-specific branch
    (`hasRows`/`finishedAt`-pinned read); `gradesRc` falls through to the same
    `if (!reconciled.rowsData) return null; return this.renderSyncExport(...)`-shaped path, except
    it calls `exportsService.renderGradesRc(reconciled.rowsData, lang)` instead of
    `renderSyncExport` (different render signature, same `rowsData` source). `GENERATION_STALE_TIMEOUT_MS`,
    `gradesRcMergeStartedAt`/`isGradesRcMergeInFlight`, and `GradesRcMergeBusyError` are **unchanged**
    — the single-flight guard exists because of connection-pinning during the merge, which this
    change does not remove (see ADR-004 Neutral).
- **Module wiring**: `scraping-exports.module.ts` — remove `ScrapingExportGradesRcRowEntity` from
  `TypeOrmModule.forFeature([...])` and `ScrapingExportGradesRcRowRepository` from `providers`.
- **Guards / scope**: unchanged — this module's endpoints already use the existing header
  decorators; no new endpoint, no new scope requirement.
- **i18n keys**: none added or removed. `scrapingExportsValidationStrings` is untouched.
- **Validation**: no DTO or business-rule validation changes — this is an internal storage/
  performance change behind an unchanged wire contract.
- **`openapi.json`**: not regenerated — no route, DTO, or response shape changes (see ADR gate).

## Testing strategy

| AC  | Covered by                                                                                                                                                                                                                                                                                                                                                                                            | Kind             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Confirmed during design via `EXPLAIN (ANALYZE, BUFFERS)` against real production data (see Approach). Re-confirmed during implementation the same way, against the applied code (not a hand-built isolated query) — manual, per the file's own convention (`GRADES_RC_SQL` changes require `test/manual/grades-rc-export.verify.ts` plus this).                                                       | manual           |
| 2   | Same as AC-1 — the `(never executed)` subplan check, re-run against the applied code.                                                                                                                                                                                                                                                                                                                 | manual           |
| 3   | `test/manual/grades-rc-export.verify.ts` (fixed in Task 1.1) for content-identical output on fixture data; a timed end-to-end `regenerate` for real 202610 data, before/after, for the duration claim.                                                                                                                                                                                                | manual           |
| 7   | Confirmed during design via full-query `EXPLAIN (ANALYZE, BUFFERS)` against real production data (see Approach) — `section_designated`'s `loops` count and join strategy. Re-confirmed during implementation against the applied code (a hand-assembled query with real params stands in for an actual `regenerate` call during investigation, but is not the same as running the shipped code path). | manual           |
| 4   | `scraping-export-generation.service.spec.ts` / `scraping-exports.service.spec.ts` unit tests asserting the `rowsData`-based write/read path and the deleted `gradesRcRowRepository` dependency; the migration itself is exercised by running it against a disposable database (`pnpm migration:run` / `migration:revert` round trip) — not a jest test.                                               | unit + manual    |
| 5   | Unit tests asserting `renderGradesRc`'s split-by-`hasObservations` produces the same two sheets as the old two-read path, given the same input array; `test/manual/grades-rc-export.verify.ts`'s `verifySplit` checks (rewritten for the array shape) as a second, real-Postgres-backed confirmation.                                                                                                 | unit + manual    |
| 6   | Real generate+download cycle for 202610 in a staging/production-like environment, watching container RSS against the 640MB `mem_limit` — no automated test can assert real process memory.                                                                                                                                                                                                            | manual (runbook) |

## Risks

| Risk                                                                                                                                                                                                                                          | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Query rewrites to `GRADES_RC_SQL` are non-intuitive — a prior naive rewrite attempt (in the original investigation, not repeated here) made things 8x worse                                                                                   | The rewrite adopted here was validated against real production data during design (see Approach, AC-1/AC-2), not hand-derived; re-validated again during implementation against the applied code, plus the fixed manual verify script and a runbook-level before/after diff.                                                                                                                                                                                                                                |
| ADR-004's accepted risk: a future period larger than 202610 could OOM the process the way the original (unmeasured) incident did, now that rows live in one jsonb value with no per-row streaming                                             | A `warn`-level log line when a `gradesRc` generation's row count exceeds a documented threshold (proposed 150,000 — ~3x today's largest known period), added in Task 2.3, so growth is visible in logs before it becomes an incident. Does not add a hard cap or block generation — this proposal's own non-goals rule out changing what gets computed, and a silent failure mode is worse than a documented, monitorable one.                                                                              |
| `test/manual/grades-rc-export.verify.ts` was already broken on `develop` before this change (stale import from the already-merged `defer-export-language-to-download`)                                                                        | Fixed as the very first task (1.1), establishing a working baseline before any `GRADES_RC_SQL` edit — otherwise a real regression could not be told apart from a script that was already failing to run.                                                                                                                                                                                                                                                                                                    |
| `enable_nestloop = off` is a blunt, query-wide planner override, not a targeted fix for the one join site (AC-7) that needs it                                                                                                                | A future edit to `GRADES_RC_SQL` could rely on a nested loop being genuinely cheaper somewhere else in the same query and silently regress under this setting                                                                                                                                                                                                                                                                                                                                               | Scoped to exactly the one connection this query already tunes `work_mem`/`jit` on, reset immediately after (mirrors existing precedent, not a new pattern); re-EXPLAIN the full query (AC-7) whenever `GRADES_RC_SQL` changes, not just the piece being edited |
| AC-7's `section_designated` pathology was found live during design, not anticipated at proposal time — the same `unnest($n::text[])`-driven cardinality misestimate could exist elsewhere in this ~500-line query without having surfaced yet | A different, still-undiscovered instance of the same pathology could keep the fixed query slower than necessary, or resurface after a future edit                                                                                                                                                                                                                                                                                                                                                           | Not treated as fully closed — a future change touching `GRADES_RC_SQL` should scan its own `EXPLAIN` output for the same signature (`loops` in the thousands feeding a CTE scan) before assuming an unrelated slowdown                                         |
| This change reverses ADR-003's explicit rejection of the single-jsonb-blob approach for `gradesRc`                                                                                                                                            | Documented as ADR-004, including the specific negative consequences accepted (see ADR-004). Not treated as free — the mitigation above (oversized-batch logging) is a direct response to the named risk.                                                                                                                                                                                                                                                                                                    |
| Deleting `core.scraping_export_gradesrc_rows` while a generation is mid-flight (a rare race: the migration deploys between a `runGradesRcGeneration` call reading old code and its write)                                                     | Not applicable in practice — `regenerate`'s `claimForGeneration` single-flight-per-key check means at most one `gradesRc` generation is `running` at a time per period, and a deploy naturally happens between requests, not mid-request, in this system's normal rolling-restart deploy model (no blue/green DB-schema overlap is assumed elsewhere in this codebase either). Flagged in the runbook as a deploy-ordering note (migrate, then deploy the new image) rather than engineered around in code. |

## Docs to update in this PR

- [ ] `docs/CONTEXT.md` § Database (the `core` schema table row) — remove
      `plus scraping_export_gradesrc_rows for the materialized gradesRc merge`, since that table no
      longer exists; keep the `scraping_export_runs` / ADR-003 reference, and add ADR-004 as the
      citation for `gradesRc` now sharing `rows_data`.
- [ ] `docs/CONTEXT.md` § Business Rules — remove the bullet describing
      `core.scraping_export_gradesrc_rows`'s batch-delete retention rule (enforced in
      `ScrapingExportGenerationService.runGradesRcGeneration()`); that rule no longer exists once
      writes are a single-row `rowsData` update. Replace with a short note (or fold into the
      existing "download-while-stale" prior art reference) that `gradesRc` now follows the same
      single-column-write atomicity as the other four export types, citing ADR-004.
- [x] `docs/adr/ADR-004-gradesrc-rows-in-shared-jsonb-storage.md` — written as part of this design.
- [x] `docs/adr/ADR-003-language-neutral-scraping-export-generation.md` — Status line updated to
      point to ADR-004, done as part of this design.
