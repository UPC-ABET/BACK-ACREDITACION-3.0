# Design — Retire Banner grades scraping (raw_notas) in favor of Planner

**Slug**: `retire-banner-grades-scraping`
**Proposal**: `./proposal.md`

## Read first

- `docs/POLICIES.md` § Migrations, § Database Access (Repository Boundary)
- `docs/CONTEXT.md` § Database (raw datasource, two-connection model, `partial`/`completed`
  retention), § Business Rules (scrape run status/retention, `gradesRc` storage)
- `docs/adr/ADR-005-planner-only-grades-source.md` — the decision this design implements
- `docs/adr/ADR-004-gradesrc-rows-in-shared-jsonb-storage.md` — adjacent storage decision;
  explicitly does not touch `GRADES_RC_SQL`'s source composition
- `openspec/specs/gradesrc-export-performance-and-storage/` — prior art on this same query;
  scoped Banner's leg as a non-goal at the time (different concern, performance not trust)
- `openspec/specs/scrape-retention-and-cached-exports/` — defines the `partial` cascade-delete
  behavior this change removes the trigger for
- `src/modules/admin/banner/scraper/api/scraper.service.ts` — `scrapeGrades`,
  `buildGradePairs`, `GradePair`, the `'studentsAndGrades'` phase (lines 235-249, 490-562)
- `src/modules/admin/banner/raw/model/raw-notas.entity.ts`,
  `src/modules/admin/banner/raw/core/raw-notas.repository.ts`,
  `src/modules/admin/banner/raw/raw-database.module.ts` — the storage being removed
- `src/database/migrations-raw/1781589368670-create-raw-notas-table.ts` and
  `1787346461765-rename-raw-scrape-spanish-columns.ts` — `raw_notas`'s current exact schema
  (see Backend § Migration below — two of its three original indexes were **never** renamed
  to English, unlike its columns; the drop migration must reference the names that actually
  exist today, not the ones a clean read of the entity would suggest)
- `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` — `GRADES_RC_SQL`, all
  ~30 CTEs; specifically `banner_run` (47-53, kept), `banner_grades`/`banner_sections`/
  `banner_legs` (61-133, removed), `planner_raw`/`planner_legs` (144-217, unchanged),
  `candidates` (226-247), `merged` (274-290, loses its `program_code` window)
- `src/modules/admin/scraping-exports/core/grades-rc-export.repository.ts` —
  `buildGradesRcParams`; unchanged, no bound parameter is Banner-grades-specific
- `test/manual/grades-rc-export.verify.ts` — the only executable check for `GRADES_RC_SQL`;
  read in full during design, see Testing strategy for exactly which fixtures move

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Datastore, broker or cache choice             | No                                                                                                                         |
| Auth or payments provider                     | No                                                                                                                         |
| Public API contract change or breaking change | No — proposal.md's Non-goals keep `RunSummary.counts`/`ScraperPhase` unchanged; AC-9 requires an empty `openapi.json` diff |
| New module boundary or cross-repo split       | No                                                                                                                         |
| Language, runtime or framework                | No                                                                                                                         |
| Contradicting an existing ADR                 | No — ADR-004's own "Neutral" section explicitly disclaims touching this query's source composition                         |

**Conclusion**: none of the six literal triggers hit — **escalated anyway**, and
`docs/adr/ADR-005-planner-only-grades-source.md` was written before this design. This
retires a live external integration and a production table on a data-completeness/trust
judgment call with an acknowledged, not-yet-quantified negative consequence (grades that
exist only in Banner disappear from `gradesRc`). ADR-002/003/004 are precedent for writing an
ADR over exactly this class of storage/architecture tradeoff even without a literal trigger
hit; this decision is materially larger than any of those three.

## Approach

### AC-1 — Banner scrape no longer calls the grades endpoint

`ScraperService.execute()` (`scraper.service.ts:235-249`) currently runs
`Promise.all([this.scrapeStudents(...), this.scrapeGrades(...)])` under one shared
`SCRAPE_CONCURRENCY` limiter inside the `'studentsAndGrades'` phase. `scrapeGrades` and its
two helpers (`buildGradePairs`, the `GradePair` interface) are deleted outright; the phase
becomes a single `await this.scrapeStudents(runId, level, studentCodes, stats, limit)` call.
`RawNotasRepository`/`RawNotasInsert` are removed from the constructor injection list. The
phase literal `'studentsAndGrades'` is **kept** (see Non-goals) even though it now only
covers students — renaming it is explicitly out of scope for this change.

### AC-2 — grades-scraping symbols removed repo-wide

Deleted: `RawNotasEntity`, `RawNotasRepository`, `RawNotasInsert`, `scrapeGrades`,
`buildGradePairs`, `GradePair`. Verified by a repo-wide grep in the task step, not a test —
there is nothing to unit-test about a symbol's absence.

### AC-3 — `raw_notas` dropped via a correct, reversible migration

New migration via `pnpm migration:raw:create src/database/migrations-raw/drop-raw-notas-table`
(CLI-stamped timestamp, per `docs/POLICIES.md § Migrations`). `up()` drops the table (and,
implicitly, its indexes/constraints/FK — Postgres does this atomically on `DROP TABLE`).
`down()` must recreate the table **exactly as it exists in production today**, which is not
the same as re-running the original creation migration verbatim: the column-rename migration
(`1787346461765-rename-raw-scrape-spanish-columns.ts`) renamed the columns and the `UNIQUE`
constraint to English, but **left two of the original three index names untouched**:

| Object  | Name today                                                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table   | `raw_notas`                                                                                                                                                                           |
| Columns | `id bigserial`, `run_id uuid`, `level text`, `period text`, `student_code text`, `course_code text`, `payload jsonb`, `payload_hash char(64)`, `scraped_at timestamptz default now()` |
| PK      | `PK_raw_notas`                                                                                                                                                                        |
| FK      | `FK_raw_notas_run_id` → `scrape_run(id)`, `ON DELETE CASCADE`                                                                                                                         |
| UNIQUE  | `UQ_raw_notas_run_id_student_code_course_code` on `(run_id, student_code, course_code)` — **renamed** by the 2026-08 migration                                                        |
| Index   | `IDX_raw_notas_run_id` on `(run_id)`                                                                                                                                                  |
| Index   | `IDX_raw_notas_periodo_curso_codigo` on `(period, course_code)` — **name still Spanish**, columns are the renamed ones                                                                |
| Index   | `IDX_raw_notas_codigo_alumno` on `(student_code)` — **name still Spanish**                                                                                                            |

`down()` recreates all of the above with these exact current names (including the two stale
Spanish index names — this migration is not the place to also fix that naming
inconsistency; doing so here would conflate an unrelated cleanup with a revert path, and the
migration would need to survive being applied against a database that still has the old
names). Verified manually against a scratch database (`runbook.md`).

### AC-4 / AC-5 — `GRADES_RC_SQL` reads Planner alone; `careerCode` unaffected

Remove `banner_grades`, `banner_sections`, `banner_legs` entirely. **Keep `banner_run`** —
it is not solely the grades leg's dependency; it is repurposed as the scope for a new,
grades-independent CTE:

```sql
-- Kept to scope program_lookup below; the grades leg that used to read from it
-- (banner_grades/banner_sections/banner_legs) was retired — see ADR-005.
banner_run AS (
	SELECT id FROM scrape_run
	WHERE ($1::text IS NULL OR period = $1)
	  AND status IN ('completed')
	ORDER BY started_at DESC
	LIMIT 1
),
-- programCode -> careerCode no longer rides through the grades merge (it used to be
-- backfilled from banner_legs via a window function over every row for a student). Resolved
-- directly, once per student, independent of which source(s) have grade rows for them.
program_lookup AS (
	SELECT
		student_code,
		NULLIF(TRIM(payload->'programa'->>'codigo'), '') AS program_code
	FROM raw_alumno
	WHERE run_id = (SELECT id FROM banner_run)
),
```

`candidates` (226-247) drops its `UNION ALL` — it becomes a plain `SELECT ... FROM
planner_legs`. `planner_raw`/`planner_legs` themselves are unchanged, **except**
`planner_raw`'s `NULL::text AS program_code` column is deleted — `program_code` is no longer
threaded through `candidates` → `classified` → `merged` → `deduped` → `resolved` → `flagged`
→ `shaped` at all. `merged`'s `max(program_code) OVER (PARTITION BY student_code)
AS program_code` window (line 286) is deleted along with it — that backfill existed
specifically to let a Planner-only row inherit a Banner-only row's `program_code` for the
same student, which no longer applies once there is exactly one source for `program_code`.

The final `SELECT` (`FROM final s ... LEFT JOIN careers c ON c.program_code = s.program_code`,
lines 498-499) changes to join through the new CTE instead of a column carried on `s`:

```sql
FROM final s
LEFT JOIN program_lookup pl ON pl.student_code = s.student_code
LEFT JOIN careers c ON c.program_code = pl.program_code
```

`COALESCE(c.career_code, '')  AS "careerCode"` (line 451) is unchanged — only how `c` gets
joined changes. This is a strictly simpler shape than before (one join instead of a value
threaded through six CTEs and a window function), not just an equivalent one.

### AC-6 — `test/manual/grades-rc-export.verify.ts` rewritten for Planner-only reality

Read in full during design (see Testing strategy — this is a bigger rewrite than
`proposal.md`'s Risk table anticipated; most of the file's scenario groups, not just R4/R8,
are currently anchored on Banner-only fixture sections).

### AC-7 — a clean run now finishes `'completed'`

Direct consequence of AC-1: with no `scrapeGrades` call, nothing in the
`'studentsAndGrades'` phase can push an entry onto `stats.errors` for a grades failure, so
`stats.errors.length > 0 || stats.departments.failed.length > 0` (the `'partial'` condition,
`scraper.service.ts:251-252`) can no longer be true because of a grades-endpoint problem.
Verified by a `scraper.service.spec.ts` case that runs the full happy path (schedule,
enrollment, students all succeed, nothing mocked to fail) and asserts `status === 'completed'`
— today that same setup would need a mocked `rawNotasRepository`/grades call to reach
`'completed'` at all.

### AC-8 — `docs/CONTEXT.md` accurate

Two spots (see Docs to update below): the `raw_notas`-mentioning business-rule bullet this
change's proposal itself is adjacent to (added during ADR-005's "Link it" step, currently
reads "Not yet implemented as of this writing" — that caveat is removed once this ships), and
the `core` schema row's `raw_notas` shape references if any exist elsewhere (none found beyond
the one already-updated bullet — verified by grep as part of the task).

### AC-9 — `openapi.json` unchanged

No controller, DTO, or route is touched by this change — `pnpm openapi:export` is run as a
verification step (not because a diff is expected), and the task fails if the diff is
non-empty.

## Backend

- **Module**: `src/modules/admin/banner/` (scraper + raw), `src/modules/admin/scraping-exports/`
- **Entities / migrations**: `RawNotasEntity` deleted; one new migration on the `raw`
  datasource (`migration:raw:create`) drops `raw_notas` — see AC-3 above for its exact `up()`/
  `down()` contents
- **Endpoints**: none added, changed, or removed — `POST /banner/scrape/run`,
  `GET /banner/scrape/:runId`, `GET /banner/scrape` (`listRuns`) all keep their current
  request/response shapes (`RunSummary.counts.grades` stays present, always `0`)
- **Guards / scope**: unchanged — no endpoint touched
- **i18n keys**: none added or removed
- **Validation**: none — no DTO changes

## Testing strategy

| AC                     | Covered by                                                                                                                                                                                                                | Kind                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1                      | `scraper.service.spec.ts` — assert `scrapeGrades`/`RawNotasRepository` no longer exist on the class; a happy-path run makes no request matching `/alumno/notaactual/notas/`                                               | unit                                                           |
| 2                      | Repo-wide grep (`RawNotasEntity`, `RawNotasRepository`, `RawNotasInsert`, `scrapeGrades`, `buildGradePairs`, `GradePair`) returns nothing                                                                                 | manual (task step)                                             |
| 3                      | `migration:raw:run` then `migration:raw:revert` against a scratch Postgres, schema diffed against pre-migration state (table/columns/PK/FK/UNIQUE/both indexes present with their exact current names)                    | manual (`runbook.md`)                                          |
| 4                      | Static read of `grades-rc-export.sql.ts` post-change (no `raw_notas` text, no `banner_grades`/`banner_sections`/`banner_legs`) + `test/manual/grades-rc-export.verify.ts` exercising the rewritten query end-to-end       | manual (`runbook.md`)                                          |
| 5                      | `test/manual/grades-rc-export.verify.ts`'s rewritten `R8` group, run against a real scratch Postgres — `careerCode` resolution via the new `program_lookup` CTE, including the "no `raw_alumno` record" empty-string case | manual (`runbook.md`)                                          |
| 6                      | `test/manual/grades-rc-export.verify.ts` full run, all scenarios passing (see rewrite plan below)                                                                                                                         | manual (`runbook.md`)                                          |
| 7                      | `scraper.service.spec.ts` — happy-path case asserts `status === 'completed'` with nothing grades-related mocked                                                                                                           | unit                                                           |
| 8                      | Manual doc review against the grep from AC-2/AC-4                                                                                                                                                                         | manual (task step)                                             |
| 9                      | `pnpm openapi:export`, `git diff openapi.json` empty                                                                                                                                                                      | manual (task step)                                             |
| — (ADR-005 mitigation) | Old-vs-new `GRADES_RC_SQL` row-count/content diff against one real period's raw data (read-only, mirrors `gradesrc-export-performance-and-storage`'s own SSH+`psql` methodology)                                          | manual (`runbook.md`), **required before merge**, not optional |

### `grades-rc-export.verify.ts` rewrite plan

Read in full during design. Current fixture sections and which source they depend on:

| Section                                          | Source today                                                                                          | Scenarios exercised                                                                                                                                                                                                                                                     | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NRC1`/`NRC1B` (A1, A1B, A1C, A1D, A1E, A1F)     | **Banner only** (no Planner counterpart at all)                                                       | R1 (unfinished run), R2 (dedup, out-of-scope, no-CONTROL-outcome... — partially, see NRC9/NRC14 below), R5a/R5b/R5c (matriculation scope), R6 ("only designated ships"), R7 (numeric→ASISTIO, non-numeric→status, unknown status passthrough, unregistered-status flag) | **Rebuild as Planner fixtures** (`seccion`/`evaluacion`/`notaPlanner`) reproducing the same shapes: an "unfinished" Planner run for R1 (`planner_scrape_run` row with `status = 'running'`, mirroring `BANNER_UNFINISHED_RUN`'s role), a non-numeric `gradeFormat` for the status-passthrough cases (the `status_text` fallback-from-`grade_raw` mechanism in `candidates` is source-agnostic — reachable via Planner the same way)                                                                                                                                                                          |
| `NRC5` (A5)                                      | **Banner only**                                                                                       | R6 fallback rescue (raw unregistered type code), R8 (program outside career map)                                                                                                                                                                                        | Rebuild as Planner: a section with no `DESIGNATED` entry, one ungraded-type evaluation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `NRC6` (A6, A6B, A6C)                            | **Banner only**                                                                                       | R6 (two designated types, weight tiebreak, missing-designated fallback)                                                                                                                                                                                                 | Rebuild as Planner: two evaluations with `evalComponentCode`s matching two `DESIGNATED` entries for one section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `NRC8` (A8, A8B)                                 | **Banner only**                                                                                       | R6 (course-level status explains a missing designated grade)                                                                                                                                                                                                            | Rebuild as Planner: use `isSanctioned`/`statusName` on one evaluation row instead of a Banner `'RET'` grade-text value — same `status_is_course_level` classification path                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `NRC13` (A13)                                    | **Banner only**                                                                                       | R7 (designated type present, blank value, no status → defaulted-and-flagged)                                                                                                                                                                                            | Rebuild as Planner: an evaluation row matching the designated type with `grade`/`gradeFormat` both null/blank and no status fields set                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `NRC14` (A14)                                    | **Banner only**                                                                                       | R2 (course with no CONTROL outcome excluded)                                                                                                                                                                                                                            | Rebuild as Planner: any graded section simply left out of `CONTROL_SECTIONS`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `NRC9` (A9)                                      | Banner only                                                                                           | R2 (section outside `academic.course_sections` dropped)                                                                                                                                                                                                                 | Rebuild as Planner: a graded section left out of `LOADED_SECTIONS`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `NRC2`, `NRC3`, `NRC4`, `NRC7`, `NRC11`, `NRC12` | Already Planner-sourced (some also had a Banner row for cross-source precedence, e.g. `NRC2`/`NRC12`) | R3, R4 (agreement/disagreement/newest-wins), R6 (name-fallback match), R7 (sanction, pending)                                                                                                                                                                           | Keep as-is; **drop only the Banner-side fixture calls** (`notas(...)` for `A2`/`A12`) and any assertion whose premise was specifically "the other source" (`R4 designated grade only Banner has`, `R7 a course-level status beats a numeric grade from the other source, however new`, `R8 career filled from the Banner leg when the Planner row wins`) — rewritten to assert the same underlying rule (course-level status beats numeric; newest-scrape-wins within a tier) using two Planner rows with different `scraped_at` instead of a cross-source pair, where the rule still has something to prove |
| `R9` split-worksheet checks                      | Source-independent                                                                                    | unchanged                                                                                                                                                                                                                                                               |

`assertThrowaway`'s own schema check (`to_regclass('public.raw_notas')`) is updated to stop
requiring `raw_notas` to exist (AC-3 removes the table) while still requiring
`raw_planner_nota`.

## Risks

| Risk                                                                                                                                                                                                                                     | Mitigation                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A grade that exists only in Banner, never in Planner, silently disappears from `gradesRc`                                                                                                                                                | Required, not optional: old-vs-new `GRADES_RC_SQL` diff against one real period's raw data before merge (see Testing strategy, `runbook.md`). ADR-005 already records this as an accepted-but-unquantified risk at decision time — this diff is what quantifies it.                             |
| `GRADES_RC_SQL` is exactly the query whose own header comment records a prior 8x-regression rewrite attempt and a separate "ran forever in production" incident                                                                          | No structural rewrite of the surviving Planner-side CTEs — only removal of the Banner leg and the `program_code` window/join change described in AC-4/AC-5, both mechanical deletions/substitutions, not new query logic. `test/manual/grades-rc-export.verify.ts` re-run in full before merge. |
| `test/manual/grades-rc-export.verify.ts`'s rewrite is large (see table above) and could itself introduce a fixture bug that masks a real regression                                                                                      | Each rebuilt scenario keeps the same assertion it replaces (same `R`-label, same expected value/shape) — the rewrite table above is the checklist; a scenario whose assertion changes meaning is called out explicitly (the three cross-source ones) rather than silently reworded              |
| The stale Spanish index names on `raw_notas` (`IDX_raw_notas_periodo_curso_codigo`, `IDX_raw_notas_codigo_alumno`) could be missed if `down()` is written from the entity/current-columns view instead of the actual current index names | AC-3's table above states them explicitly; migration `down()` is verified against a scratch DB, not just read for plausibility                                                                                                                                                                  |

## Docs to update in this PR

- [ ] `docs/CONTEXT.md` § Business Rules — the `raw_notas`/ADR-005 bullet (already added
      during ADR-005's own "Link it" step) loses its "Not yet implemented as of this writing"
      caveat and is updated to describe the Planner-only state as current
- [ ] `docs/CONTEXT.md` § Database — grep for any other `raw_notas` mention (the schema table
      row for `core` does not mention it; the two-datasource paragraph lists
      `raw_horario`/`raw_matricula`/`raw_alumno`/`raw_notas` together and must drop `raw_notas`
      from that list)
- [ ] `docs/adr/ADR-005-planner-only-grades-source.md` — **not edited by this change**
      (`tasks.md`'s preamble forbids touching `docs/adr/*`); its Status transition to
      `Accepted` is a separate governance step, consistent with ADR-004 which remains
      `Proposed` despite its own change already being merged and archived
