# Runbook — Scrape Data Retention and Cached Scraping Exports

**Slug**: `scrape-retention-and-cached-exports`

## Deploy prerequisite

The migration from Task 3.3 (`add-scraping-export-runs-table`, creating
`core.scraping_export_runs`) **must run before** the new code path is live. Once deployed,
`ScraperService.execute()` and `PlannerScraperService.execute()` call into
`ScrapingExportGenerationService` on every completed run — if the table doesn't exist yet,
every scrape completion will throw inside the fire-and-forget trigger call. That failure is
caught and does not fail the scrape run itself (per design.md's fire-and-forget contract),
but it means **zero exports get generated** until the migration lands — silent from the
scrape's point of view, loud from "why is nothing downloadable." Run the migration as a
normal deploy-time step ahead of the new application version, not after it.

No backfill is needed: the table starts empty and is populated by the next scrape
completion for each period.

## Manual verification (staging)

Nothing in this change is unit-testable end-to-end against real Banner/Planner endpoints —
the scrapers themselves talk to real external systems. Verify by hand on staging before
this reaches production:

1. **Retention.** Note the current `scrape_run`/`planner_scrape_run` row count for a test
   period. Trigger a Banner scrape for that period, let it reach `'completed'`. Confirm:
   - exactly one `scrape_run` row remains for that period (the new one),
   - its raw child rows (`raw_horario`, `raw_matricula`, `raw_alumno`, `raw_notas`) are
     present,
   - the previous run's raw rows are gone (cascade delete worked).
     Repeat for Planner against `planner_scrape_run` / `raw_planner_seccion` /
     `raw_planner_evaluacion` / `raw_planner_nota`.
2. **Partial/failed cleanup.** If a scrape can be forced to fail on staging (e.g. temporarily
   bad credentials), confirm the failed run's own raw rows are deleted while the
   previously-completed run for that period is untouched — i.e. downloads for that period
   still work using the older data while the broken run leaves no trace.
3. **Auto-generation.** After the Banner scrape above completes, poll
   `GET /scraping/exports/docentes/status` (and the other three Banner export types) for that
   period until `status: 'completed'`, then confirm `GET .../download` returns a valid
   `.xlsx` file. Then run the matching Planner scrape for the same period and confirm
   `GET /scraping/exports/grades-rc/status` transitions to `'completed'` only once **both**
   scrapes are done — not after either one alone.
4. **Manual regenerate.** Call `POST /scraping/exports/docentes/regenerate` for a period
   that already has a completed export; confirm `status` goes `'completed'` → `'running'` →
   `'completed'` again, and `download` keeps serving the old file while `'running'` (no gap
   in availability), then serves the new one once done.
5. **Stale detection.** Hard to force organically — if feasible, manually flip a row to
   `'running'` with an old `updatedAt` via SQL on staging and confirm the next `status`/
   `download` call flips it to `'failed'` with `error.scrapingExports.staleGenerationDetected`
   instead of leaving it stuck.
6. **Contract.** Confirm the frontend (once its paired change lands) can actually drive the
   new status → download flow — this is the first real integration test of the new contract,
   since it was designed sequentially without a frontend implementation to validate against
   during backend development.

## Revert plan

- Code: a normal PR revert. The four old sync export endpoints and three old Grades RC
  endpoints are removed by this change — reverting restores them along with the removed
  `JobRegistry`-based Grades RC path.
- Data: the migration's `down()` drops `core.scraping_export_runs` — safe, since it holds
  only generated/derivable state, not source-of-truth data.
- Raw scrape data: **retention deletions are not reversible.** Reverting this change stops
  _future_ deletions but does not restore rows already deleted by a prior completed run. If
  a rollback needs the deleted raw data back, it has to come from the next scrape re-run
  against Banner/Planner, not from this application's database.
