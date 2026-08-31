# Runbook — Retire Banner grades scraping (raw_notas) in favor of Planner

**Slug**: `retire-banner-grades-scraping`

This change drops a live table (`raw_notas`) and removes a whole leg of `GRADES_RC_SQL`. Two
things here cannot be verified by any automated test: the migration's reversibility, and
ADR-005's accepted-but-unquantified risk (a grade that exists only in Banner disappearing
from `gradesRc`). This runbook is both.

## ⚠️ Deploy prerequisite

**Deploy the new application image FIRST, then run the migration — not the other way
around.** The old (pre-fix) image is still calling Banner's grades endpoint and writing to
`raw_notas` until it is fully retired; dropping the table while it might still be live
(mid-scrape, or a scrape triggered during the rollout window) reintroduces the exact
`'partial'`-cascade failure mode this change fixes, just for the deploy window instead of
for a Banner outage.

```bash
# 1. Deploy the new application image and confirm it is serving traffic. It never touches
#    raw_notas regardless of whether the table still exists, so this step alone is safe
#    even before the migration runs.

# 2. Confirm no Banner scrape is currently in flight on the OLD image before proceeding
#    (GET .../banner/scraper/runs — no 'running' status for the period in question). If one
#    is in flight, wait for it to finish (or fail) before running the migration.

# 3. Only once the new image is confirmed live and no old-image scrape is in flight:
pnpm migration:raw:run

# 4. No seed step, no permission sync, no main-datasource migration — this change touches
#    only the raw datasource's schema and application code that reads/writes it.
```

**Reverting**: do not roll back the application image past this change without first
running `pnpm migration:raw:revert` for the migration below — an OLDER (pre-fix) image still
calls Banner's grades endpoint and writes into `raw_notas`, which would not exist yet if the
migration was never reverted.

## Manual validation

| #   | Step                                                                                                                                                                                                                                                                                    | Expected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Before merging: run `test/manual/grades-rc-export.verify.ts` per its own header instructions against a throwaway Postgres with this branch's migrations applied.                                                                                                                        | Every check reports `ok` (Task 3.5 / AC-6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2   | Trigger a real Banner scrape for a period whose grades endpoint you can independently confirm is currently erroring or slow (or, absent a real outage window, temporarily point `BANNER_BASE_API` at an unreachable host for a manual local test only — never in a shared environment). | The run's `status` still reaches `'completed'` once schedule/enrollment/students succeed — it is no longer possible for a grades-endpoint problem to produce `'partial'`, because nothing calls that endpoint (AC-1/AC-7).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | Confirm `raw_notas` no longer exists post-migration: `\d raw_notas` against the raw datasource (`psql` or the credentials `ScraperService`/`RawNotasRepository` used to use).                                                                                                           | `Did not find any relation named "raw_notas"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | Run Task 4.1's real-data diff, read-only, against production's raw DB (`scrape_pg`/`db_scrape_raw`, reached via SSH + `docker exec ... psql`).                                                                                                                                          | **Done 2026-08-31.** Period **202610** (the only period with real grades data as of this run — see below): 51,435 Banner `raw_notas` rows, all reducing to 51,435 distinct `(student_code, course_code)` pairs, against 373,124 distinct pairs derivable from Planner's 2,403,363 `raw_planner_nota` rows. **Every single Banner pair also has a Planner pair for the same `(student_code, course_code)` — 0 Banner-only pairs, 0.00%.** Period **202615**: both sources' completed runs currently hold **zero** grade rows (nothing graded yet at scrape time), so there is nothing to diff for it. This measures pair-level coverage (does Planner have _some_ grade for a course Banner also graded), not per-evaluation-type agreement — it is the same grain `GRADES_RC_SQL` itself reduces to per `(section, student)`, so a 0% finding here is strong evidence, not a full replay of the query's scope/weight logic. Query used, for reproduction: see "Task 4.1 query" below. |
| 5   | `POST .../scraping/exports/gradesRc/regenerate` for a period with both a completed Banner and Planner run, then `GET .../gradesRc/download`.                                                                                                                                            | Succeeds; `careerCode` is populated for students with a Banner `raw_alumno` record (via `program_lookup`) exactly as it was before this change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Data validation

```sql
-- Run against the raw datasource, after the migration.
-- Expected: this query itself fails with "relation raw_notas does not exist" -- that failure
-- is the pass condition.
SELECT count(*) FROM raw_notas;

-- Confirm raw_alumno (unaffected by this change) still backs careerCode resolution for the
-- period gradesRc was last regenerated for.
SELECT count(*) FROM raw_alumno WHERE run_id = (
  SELECT id FROM scrape_run WHERE period = '<period>' AND status = 'completed'
  ORDER BY started_at DESC LIMIT 1
);
```

```sql
-- Task 4.1 query, as actually run against production (2026-08-31), read-only, at
-- (student_code, course_code) grain rather than replaying the full GRADES_RC_SQL merge --
-- see the note in Manual validation step 4 on what this does and doesn't prove.
-- Substitute the current latest-completed run ids for the period being checked.
WITH banner_pairs AS (
	SELECT DISTINCT student_code, course_code
	FROM raw_notas
	WHERE run_id = '<latest completed scrape_run.id for the period>'
	  AND NULLIF(TRIM(student_code), '') IS NOT NULL
	  AND NULLIF(TRIM(course_code), '') IS NOT NULL
),
planner_pairs AS (
	SELECT DISTINCT n.student_code, s.payload->'courses'->0->>'courseCode' AS course_code
	FROM raw_planner_nota n
	JOIN raw_planner_seccion s ON s.run_id = n.run_id AND s.section_id = n.section_id
	WHERE n.run_id = '<latest completed planner_scrape_run.id for the same period>'
	  AND NULLIF(TRIM(n.student_code), '') IS NOT NULL
),
banner_only AS (
	SELECT b.student_code, b.course_code
	FROM banner_pairs b
	LEFT JOIN planner_pairs p ON p.student_code = b.student_code AND p.course_code = b.course_code
	WHERE p.student_code IS NULL
)
SELECT
	(SELECT count(*) FROM banner_pairs)  AS banner_pairs,
	(SELECT count(*) FROM planner_pairs) AS planner_pairs,
	(SELECT count(*) FROM banner_only)   AS banner_only_pairs;
-- 2026-08-31 result for period 202610: 51435 | 373124 | 0.
```

## Symptom → diagnosis

| Symptom                                                                                           | Likely cause                                                                                                                                                                      | Check                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Banner scrape run's grades phase still appears in logs / `scrapeGrades` still runs after deploy | Old (pre-fix) application image still serving traffic                                                                                                                             | `docker ps` / deployment history for the image tag actually running; redeploy the correct image                                                                                                                                         |
| `gradesRc` generation fails with a Postgres error mentioning `raw_notas`                          | An old image (still calling the removed code path) is running against a database that already had the migration applied                                                           | Redeploy the correct image, or run `pnpm migration:raw:revert` if rolling the image back is not immediately possible (see deploy prerequisite above)                                                                                    |
| `careerCode` comes back empty for a student who previously had one                                | `program_lookup`'s `raw_alumno` scope (`banner_run`) resolved to a different/older run than expected, or that student's `raw_alumno` row is genuinely missing for the current run | `SELECT * FROM raw_alumno WHERE student_code = '<code>' AND run_id = (<banner_run's own subquery>)` — if no row, this is expected (same as before this change: a student with no Banner record has always gotten an empty `careerCode`) |
| Task 4.1's diff shows a non-trivial number of Banner-only pairs                                   | Some real courses/periods genuinely have grades Planner never captured                                                                                                            | Do not silently accept — this is exactly the risk ADR-005 flagged as unquantified; report the finding to the requester before merging, per the ADR's own "Alternatives considered" note                                                 |

## How to revert

```bash
# Application code: revert the PR's commits as usual.

# Migration: only necessary if the code revert would otherwise leave old code trying to call
# Banner's grades endpoint and write into a table this change dropped. Revert the migration
# BEFORE deploying the reverted (pre-fix) image.
pnpm migration:raw:revert
```

Reverting the migration recreates `raw_notas` (empty, with its original columns/constraints/
indexes — see `design.md` § AC-3 for the exact list, including the two stale Spanish index
names). There is no data to restore: `raw_notas` is scrape cache, repopulated by the next
Banner scrape run, the same as every other raw scraping table under the existing retention
rule.

Reverting the code also un-deletes `scrapeGrades`/`GradePair`/`buildGradePairs` and restores
the Banner leg of `GRADES_RC_SQL` (`banner_grades`/`banner_sections`/`banner_legs`) and the
window-function-based `program_code` backfill — all via normal git revert, nothing manual
beyond the migration step above.

## Do NOT

- Do **not** run `pnpm migration:raw:run` before the new application image is confirmed
  live and no Banner scrape is in flight on the old image — see the Deploy prerequisite
  above. Running it first is the same class of mistake as the rollback one below, just in
  the forward direction.
- Do **not** deploy the reverted (pre-fix) application image before running
  `pnpm migration:raw:revert` — it will try to scrape and store Banner grades into a table
  that no longer exists, and every Banner scrape's grades phase will error until the migration
  catches up (though, notably, under the _reverted_ code's own retention rule that failure
  would once again risk cascading the whole run to `'partial'` — exactly the bug this change
  fixes, now reintroduced by an out-of-order rollback).
- Do **not** treat a passing `test/manual/grades-rc-export.verify.ts` run as sufficient
  evidence that no real grade data is lost — it runs against a few dozen fixture rows built
  specifically to exercise merge _logic_, not to represent real Banner/Planner coverage
  overlap. Only Task 4.1's real-data diff answers that question.
- Do **not** leave step 4's row in Manual validation unfilled. An ADR that accepts a risk as
  "unquantified, mitigated by a required diff before merge" is not honored by skipping the
  diff.
