# Runbook — Rename Spanish Raw-Scrape Identifiers to English

**Slug**: `raw-scrape-data-english-naming`

## Deploy prerequisite

Three migrations across two physical databases. The two raw-datasource migrations have a
fixed order between themselves; the main-datasource one (Task 10.1) is independent of both
(different Postgres instance) but still must run before the new application code, same as
the other two:

1. **Task 1.1** — renames `nivel`/`periodo`/`departamentos`/`departamento`/`codigo_alumno`/
   `curso_codigo`/`escuela` and the four dependent `UNIQUE` constraints. Must run before the
   new application code is live — the renamed TypeScript identifiers (Milestones 2–5) map
   onto the new column names via `SnakeNamingStrategy`/`UpperPrefixSnakeNamingStrategy`, so
   old code against new columns or new code against old columns both fail outright (`column
"nivel" does not exist` or the reverse), not silently.
2. **Task 6.1** — renames `CK_scrape_run_phase`/`CK_planner_scrape_run_phase`'s values and
   backfills any currently-non-null `phase` row. Must run after Task 1.1 (it targets the
   already-renamed `scrape_run`/`planner_scrape_run` tables) and, like Task 1.1, before the
   new application code is live — the renamed `ScraperPhase`/`PlannerScraperPhase` TS types
   only match the post-migration constraint values. This is a **new** migration, not an edit
   to the already-applied `1787270797549-add-phase-to-scrape-runs.ts` (that one shipped with
   `scrape-progress-and-performance`, PR #121, and is already on `develop` — the original
   proposal assumed it was still unmerged; corrected during design, see design.md § AC-6).
3. **Task 10.1** (main datasource, `pnpm migration:run` — not `migration:raw:run`) — renames
   `core.scraping_export_runs.periodo` to `period` and its dependent `UNIQUE` constraint.
   Found post-implementation, during audit; see design.md § AC-9.

All three run as normal deploy-time steps ahead of the new application version, exactly like
every other migration here.

No backfill needed for Task 1.1: `ALTER TABLE ... RENAME COLUMN` preserves every row exactly,
under a new name. Task 6.1 **does** need a backfill (the `UPDATE ... SET phase = ...` step) —
covered below.

**Before applying Task 6.1's migration**, confirm no `scrape_run`/`planner_scrape_run` row is
currently `status = 'running'`. Its `up()` briefly leaves `phase` with no CHECK constraint at
all between `DROP CONSTRAINT` and `ADD CONSTRAINT` (the backfill runs in between, per AC-6's
required ordering) — a pre-migration app instance writing a Spanish `phase` literal via
`updatePhase()` during that exact window would succeed unconstrained, and the subsequent
`ADD CONSTRAINT` would then fail (Postgres validates existing rows on add) once it reaches
that row, aborting the migration. This fails loud — the migration errors out, not a silent
data problem — so the fix is simply: don't deploy while a scrape is in flight, and retry if it
happens anyway.

## Manual verification (staging)

### Migration apply/revert (AC-1, AC-2 — Task 1.1)

1. Snapshot row counts for `scrape_run`, `raw_horario`, `raw_matricula`, `raw_alumno`,
   `raw_notas`, `planner_scrape_run`, `raw_planner_seccion` on a staging (or local) copy of
   the raw DB.
2. `pnpm migration:raw:run`. Confirm via `\d <table>` that every renamed column and
   constraint (design.md § AC-1's two tables) now shows its new name, and that every row
   count from step 1 is unchanged.
3. `pnpm migration:raw:revert`. Confirm every column/constraint is back to its original
   Spanish name, and row counts are still unchanged.
4. Re-run `pnpm migration:raw:run` to leave the DB in the post-rename state before
   continuing to the next check.

### Phase-literal migration apply/revert with a seeded in-flight row (AC-6 — Task 6.1)

`phase` is cleared to `null` on every terminal run, so a real staging DB will almost never
have a non-null value to exercise the backfill against — seed one manually so the check is
real:

1. On the same copy of the raw DB (after Task 1.1's migration has already run — Task 6.1
   depends on it), manually `UPDATE scrape_run SET phase = 'horario' WHERE id = '<any row>'`
   (or insert a throwaway row with that value if none exists).
2. `pnpm migration:raw:run`. Confirm: the seeded row's `phase` is now `'schedule'`; every
   other non-null `phase` value in both tables (if any) mapped correctly per design.md §
   AC-6's table; `CK_scrape_run_phase`/`CK_planner_scrape_run_phase` now only accept the
   English values (try inserting a row with `phase = 'horario'` directly via SQL — it must
   be rejected).
3. `pnpm migration:raw:revert`. Confirm the seeded row's `phase` is back to `'horario'` and
   the old Spanish-only constraint is back in place.
4. Re-run `pnpm migration:raw:run` to leave the DB in the post-rename state, then clean up
   the seeded row/value if it wasn't already a real run.

### Scraping-exports output correctness (AC-4 — Task 7.2)

No fixture-DB or testcontainers harness exists in this repo to execute the real SQL in CI
(`scraping-exports.repository.spec.ts` / `grades-rc-export.repository.spec.ts` mock
`dataSource.query` and check SQL structure only — they cannot catch a column reference that
is syntactically fine but points at the wrong data). This is the actual check for AC-4:

1. Before Task 7.1's rename deploys, on staging, with a real completed scrape run for a test
   period, generate all five export types and save the output files: Docentes, Secciones,
   Alumnos Matriculados, Alumnos-Secciones, Grades RC.
2. Deploy Task 7.1's rename (migration from Task 1.1 must already be applied, per the deploy
   prerequisite above).
3. Regenerate all five export types against the **same** scrape run (do not re-scrape between
   the two runs — the comparison is only valid if the underlying raw data is identical).
4. Diff each new file against its step-1 counterpart. Expected result: byte-for-byte
   identical content (this is a naming change, not a behavior change — any difference means
   Task 7.1 missed a column reference or renamed one incorrectly).

### `triggeredByName` (AC-8 — Milestone 8)

Unit tests cover the resolution logic in isolation (mocked `UserRepository`); this checks the
real cross-connection wiring:

1. Trigger a Banner scrape as a real logged-in user, let `GET /banner/scrape` list it.
   Confirm `triggeredByName` shows that user's actual `firstName lastName` from
   `organization.users`.
2. On staging, manually set one `scrape_run.triggered_by` to `NULL` via SQL. Confirm that
   run's `triggeredByName` is `'-'`.
3. Manually set one `scrape_run.triggered_by` to `'user:999999'` (an id that doesn't exist in
   `organization.users`). Confirm `triggeredByName` is `'-'`, not an error.
4. Repeat steps 1–3 for `POST /planner/scrape` / `GET /planner/scrape` against
   `planner_scrape_run`.

### Main-datasource migration apply/revert (AC-9 — Task 10.1)

1. Snapshot the `core.scraping_export_runs` row count on a staging (or local) copy of the
   main DB.
2. `pnpm migration:run`. Confirm via `\d core.scraping_export_runs` that the column is now
   `period` and the constraint is `UQ_scraping_export_runs_export_type_period_lang`, and the
   row count is unchanged.
3. `pnpm migration:revert`. Confirm both are back to `periodo`/
   `UQ_scraping_export_runs_export_type_periodo_lang`, row count still unchanged.
4. Re-run `pnpm migration:run` to leave the DB in the post-rename state.
5. Exercise `GET /scraping/exports/staff/status` (or any export type) and confirm the
   response's `period` field is populated — this is the first real check that
   `ScrapingExportRunRepository`'s renamed `conflictPaths` still resolves to the right column
   at runtime, not just at compile time (see design.md § AC-9's risk note).

## Revert plan

- **Code**: a normal PR revert restores the Spanish identifiers, DTOs without
  `triggeredByName`, and the Spanish phase literals in application code.
- **Raw-datasource columns (Task 1.1)**: `down()` renames every column and constraint back
  to Spanish — safe, reversible, no data loss (verified in the apply/revert check above).
- **Phase-literal migration (Task 6.1)**: `down()` reverses the CHECK constraints and
  backfills `phase` back to Spanish values — safe, reversible, no data loss (verified above).
  Both migrations must run as part of any rollback that also reverts the application code,
  in reverse order from how they were applied (Task 6.1's `down()` before Task 1.1's, since
  Task 6.1 depends on Task 1.1's renamed columns existing) — and, matching the forward
  deploy's ordering rule, application code reverts before migrations revert.
- **`triggeredByName`**: purely computed at read time — no persisted data to revert.
- **`core.scraping_export_runs.periodo` migration (Task 10.1)**: `down()` renames the column
  and constraint back to Spanish — safe, reversible, no data loss (verified in the apply/
  revert check above). Independent of the two raw-datasource migrations (separate physical
  Postgres instance), so no ordering dependency with them — but still application-code-reverts
  -before-migration-reverts, same as the others.
