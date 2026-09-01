# Retire Banner grades scraping (raw_notas) in favor of Planner

**Slug**: `retire-banner-grades-scraping`
**Branch**: `feat/retire-banner-grades-scraping`
**Repos affected**: backend
**Created**: 2026-08-31

## Problem

Banner's grades endpoint (`/alumno/notaactual/notas/{studentCode}/{level}-{period}/{courseCode}`)
only exposes the currently-active academic period's notes — it cannot be used to see or
reconcile grades for any other period. Planner (`raw_planner_nota`) does not have this
limitation: it covers more periods and carries more detail per grade (per-evaluation
`evalComponentCode`, `percentage`/`weight`, submission/status fields Banner's `notas` array
does not have). Decision made after review, triggered by investigating a `partial` Banner
scrape run whose grades phase failed entirely on transient Banner 500s
(`/alumno/notaactual/notas/...`): continuing to scrape and store Banner grades data
(`raw_notas`) is not worth keeping — it is strictly worse than the Planner source the
`gradesRc` export already merges it with, and it is what made that scrape run fail and get
discarded (a `partial` run cascades-deletes its own rows, including 2,827 schedule / 60,938
enrollment / 20,487 student rows that succeeded, because the grades phase alone failed).
Removing the least reliable of the two upstream systems removes a whole class of otherwise-successful
scrapes turning into `partial` and losing everything.

## What already exists

- **Scraping** — `ScraperService.execute()` (`src/modules/admin/banner/scraper/api/scraper.service.ts`)
  runs `scrapeStudents` and `scrapeGrades` concurrently in its `'studentsAndGrades'` phase
  (line 235-249), sharing one `SCRAPE_CONCURRENCY = 80` limiter. `scrapeGrades` (lines
  490-539) calls the notaactual endpoint per `(studentCode, courseCode)` pair
  (`buildGradePairs`, lines 550-562) and writes hits to `raw_notas` via `RawNotasRepository`.
  A failed pair only appends to `stats.errors`, which is what flips the run's terminal
  status to `'partial'` (line 251-252) — and a `'partial'`/`'failed'`/`'expired'` run has its
  own rows deleted by `finalizeRun` (lines 275-296, cascade via `FK_raw_notas_run_id ON
DELETE CASCADE` and the equivalent FKs on `raw_horario`/`raw_matricula`/`raw_alumno`).
- **Storage** — `raw_notas` (table, `RawNotasEntity` /
  `src/modules/admin/banner/raw/model/raw-notas.entity.ts`, `RawNotasRepository` /
  `.../core/raw-notas.repository.ts`), registered in `RawDatabaseModule`
  (`src/modules/admin/banner/raw/raw-database.module.ts`). Lives on the `raw` TypeORM
  connection (`RAW_DB_URL`), created by migration
  `src/database/migrations-raw/1781589368670-create-raw-notas-table.ts` and later
  column-renamed to English by
  `src/database/migrations-raw/1787346461765-rename-raw-scrape-spanish-columns.ts`. FK to
  `scrape_run` with `ON DELETE CASCADE`.
- **Consumption** — `raw_notas` is read in exactly one place in the codebase:
  `GRADES_RC_SQL` (`src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts`),
  specifically the `banner_grades` (lines 61-85), `banner_sections` (lines 91-105) and
  `banner_legs` (lines 106-133) CTEs, unioned with `planner_legs` in `candidates` (line
  226-247) and reconciled per `(section_code, student_code, raw_type)` by recency/quality in
  `merged` (lines 274-290). **`source` is not part of that ordering** — Banner and Planner
  rows are picked on data quality (course-level status > numeric grade > any value) and
  `scraped_at`, not by which system produced them.
- **A load-bearing side effect of `banner_legs`, confirmed during investigation**: it is also
  the export's only source of `programCode` (`a.payload->'programa'->>'codigo'` from
  `raw_alumno`, line 124), which the `merged` window (`max(program_code) OVER (PARTITION BY
student_code)`, line 286) backfills onto every row for that student — Planner rows
  included, since Planner's own leg hard-codes `NULL::text AS program_code` (line 175,
  "No program in Planner; filled from the Banner leg"). `programCode` in turn resolves
  `careerCode` via the `careers` CTE (line 41) and the final `LEFT JOIN careers c ON
c.program_code = s.program_code` (line 499). Removing `banner_legs` wholesale would blank
  `careerCode` for the entire export, not just Banner-sourced rows. **Resolved with the
  requester**: `raw_alumno` is populated by `scrapeStudents`, independent of `scrapeGrades`/
  `raw_notas`, and stays in scope — `programCode` will be resolved through a small,
  standalone CTE against `raw_alumno` (scoped to the same `banner_run`), decoupled from the
  grades merge entirely, so this export column's output is unaffected by this change.
- **`banner_sections`** (raw_matricula + raw_horario, lines 91-105) exists only to map
  `(student, NRC) -> course_code` for `banner_legs`. Once `banner_legs` is removed, this CTE
  has no other reader inside `GRADES_RC_SQL` — `raw_matricula`/`raw_horario` themselves stay
  in full use elsewhere (they back the Secciones and Alumnos Matriculados exports), only this
  one CTE goes away.
- **Manual verification** — `test/manual/grades-rc-export.verify.ts`'s own header: _"IF YOU
  CHANGE GRADES_RC_SQL, RUN `test/manual/grades-rc-export.verify.ts` — nothing runs it for
  you, and the jest suite mocks `query`, so nothing else executes this SQL."_ It currently
  has scenarios that assert Banner-only designated grades (`R4 designated grade only Banner
has`, line 640) and Banner-sourced career resolution (`R8 career resolved from the Banner
program code`, line 740; `R8 career filled from the Banner leg when the Planner row wins`,
  line 742) — these scenarios' premises no longer hold once the Banner grades leg is gone and
  must be rewritten, not just left to fail.
- **Prior art / adjacent decisions**: `openspec/specs/gradesrc-export-performance-and-storage/`
  explicitly scoped Banner's leg as a non-goal at the time ("Banner's raw row count scales
  with the period the same ~2.9x rate everything else does, unlike Planner's 5.7x" — i.e. it
  was not the slow path, so it was left alone). This change is a separate, trust-driven
  decision, not a reopening of that one. `openspec/specs/scrape-retention-and-cached-exports/`
  is where the `partial`/`completed` retention-and-cascade-delete behavior this problem
  surfaced through was itself introduced and documented.

## Goals

- Stop scraping Banner's grades endpoint: remove `scrapeGrades`, `buildGradePairs`,
  `GradePair`, and the grades-scraping half of the `'studentsAndGrades'` phase from
  `ScraperService`, so a Banner scrape's success no longer depends on that endpoint at all.
- Remove `raw_notas` from the schema (forward-only migration on the `raw` datasource,
  `pnpm migration:create:raw`) and remove `RawNotasEntity`/`RawNotasRepository`/their
  `RawDatabaseModule` registration from the codebase.
- Remove the Banner leg (`banner_grades`, `banner_sections`, `banner_legs`, the `UNION ALL`
  of `banner_legs` into `candidates`) from `GRADES_RC_SQL`, so `gradesRc` is generated from
  Planner (`raw_planner_nota`) alone.
- Preserve the export's current `careerCode` behavior: replace `banner_legs`'s incidental
  `programCode` resolution with a standalone CTE reading `raw_alumno` directly, so
  `careerCode` output is unchanged by this migration away from Banner grades.
- Update `test/manual/grades-rc-export.verify.ts` so every scenario reflects the Planner-only
  merge — Banner-only-grade scenarios are removed or rewritten to their new (post-change)
  expected behavior, and the career-code scenarios are re-pointed at the new `raw_alumno` CTE.
- Update `docs/CONTEXT.md`'s references to `raw_notas` and the Banner/Planner raw schema list.

## Non-goals

- Changing anything about Planner's own scraping, storage, or the `gradesRc` merge's
  precedence rules for Planner-sourced rows (`merged`'s `ORDER BY`) — only the Banner leg is
  removed, Planner's logic is untouched.
- Changing `raw_horario`, `raw_matricula`, or `raw_alumno` scraping, storage, or their use by
  the Secciones / Alumnos Matriculados / Alumnos-Secciones / Docentes exports — only
  `raw_notas` and `scrapeGrades` are removed; the rest of the Banner scrape (schedule,
  enrollment, students) is untouched, including `raw_alumno`'s continued role in resolving
  `careerCode` (see Goals).
- Changing the public `ScraperPhase` enum value `'studentsAndGrades'` or the
  `RunSummary.counts` shape (`{ schedule, enrollment, students, grades }`) — `grades` stays
  in the shape, structurally always `0` going forward, to avoid an unannounced response-shape
  change for the frontend. Renaming/removing either is explicitly out of scope for this
  change; a follow-up can revisit it once the frontend is confirmed to not depend on the
  literal value.
- Any change to `openspec/specs/gradesrc-export-performance-and-storage`'s already-shipped
  Planner-side performance fixes (`scoped_planner_sections`, the `e_nm` conditional join,
  `section_designated MATERIALIZED`, `enable_nestloop`) — this change only removes the
  Banner leg around them.
- Backfilling or migrating any historical `raw_notas` data anywhere before the table is
  dropped — per the existing retention rule (`scrape-retention-and-cached-exports`), only the
  latest completed run's rows exist at any time, and `gradesRc`'s own persisted `rows_data`
  (ADR-004) already holds whatever was last generated; nothing downstream reads `raw_notas`
  historically.

## Acceptance criteria

1. **AC-1** — Given a Banner scrape run, when it executes, then no request is made to
   `/alumno/notaactual/notas/...`, and the run's terminal status depends only on the
   schedule/enrollment/students phases succeeding or failing.
2. **AC-2** — Given the codebase after this change, when searched repo-wide, then
   `RawNotasEntity`, `RawNotasRepository`, `RawNotasInsert`, `scrapeGrades`,
   `buildGradePairs`, and `GradePair` no longer exist.
3. **AC-3** — Given the `raw` datasource schema after this change's migration runs, then the
   `raw_notas` table does not exist, and the migration's `down()` recreates it with its
   current columns/constraints/indexes exactly (verified by running `up()` then `down()`
   against a scratch database and diffing against the pre-migration schema).
4. **AC-4** — Given `GRADES_RC_SQL` after this change, when its structure is inspected, then
   `banner_grades`, `banner_sections`, and `banner_legs` no longer exist, `candidates` unions
   only `planner_legs`, and `raw_notas` does not appear anywhere in the query text.
5. **AC-5** — Given the same real-data scenario `test/manual/grades-rc-export.verify.ts`'s
   `R8` cases use, when `gradesRc` is generated after this change, then `careerCode` is
   resolved identically to before (same value, same emptiness for a student with no `raw_alumno`
   record) via the new standalone `raw_alumno` CTE, not through any Banner-grades path.
6. **AC-6** — Given `test/manual/grades-rc-export.verify.ts` after this change, when it is run
   against a scenario built with Planner-only fixtures, then every scenario passes, and no
   scenario asserts a Banner-grades-only code path (the `R4`/Banner-designated-grade case and
   any other Banner-grades-dependent assertions are removed or rewritten to their new expected
   behavior).
7. **AC-7** — Given a Banner scrape run whose schedule/enrollment/students phases all
   succeed, when the run finishes, then its status is `'completed'` (not `'partial'`) and its
   rows are retained per the existing retention rule — i.e. the specific failure mode that
   triggered this change (an otherwise-clean run losing everything to a Banner grades-endpoint
   outage) cannot recur, because that endpoint is no longer called.
8. **AC-8** — Given `docs/CONTEXT.md` after this change, when its raw-schema and business-rule
   sections are read, then no mention of `raw_notas` or Banner grades scraping remains stale
   (either removed or accurately describing the Planner-only state).
9. **AC-9** — Given `openapi.json` after this change, when regenerated, then no route, DTO, or
   response shape it describes has changed (this change touches no controller/DTO surface;
   `RunSummary.counts.grades` remains present and always `0`, per Non-goals) — the diff against
   the pre-change spec is empty or config-only.

### Traceability

| AC  | Criterion                                                            | Satisfied by                                                                              |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Banner scrape no longer calls the grades endpoint                    | `tasks.md` Tasks 1.1 (red) + 1.2 (green)                                                  |
| 2   | Grades-scraping symbols removed repo-wide                            | `tasks.md` Tasks 1.2, 2.1 (repo-wide grep)                                                |
| 3   | `raw_notas` dropped; `down()` recreates it exactly                   | `tasks.md` Task 2.2 (migration + scratch-DB up/down verification)                         |
| 4   | Banner leg removed from `GRADES_RC_SQL`; only `planner_legs` unioned | `tasks.md` Task 3.1; `design.md` § AC-4/AC-5                                              |
| 5   | `careerCode` resolution preserved via standalone `raw_alumno` CTE    | `tasks.md` Task 3.1 (`program_lookup` CTE) + Task 3.5 (verified via rewritten `R8` cases) |
| 6   | `grades-rc-export.verify.ts` scenarios updated, all passing          | `tasks.md` Tasks 3.2/3.3/3.4 (rewrite) + 3.5 (full run, all `ok`)                         |
| 7   | A clean schedule/enrollment/students run now finishes `'completed'`  | `tasks.md` Task 1.1                                                                       |
| 8   | `docs/CONTEXT.md` no longer stale about `raw_notas`/Banner grades    | `tasks.md` Task 4.2                                                                       |
| 9   | `openapi.json` unchanged                                             | `tasks.md` Task 4.3                                                                       |

## Dependencies

- `pnpm migration:raw:create src/database/migrations-raw/<kebab-case-name>` for the
  `raw_notas` drop, per `docs/POLICIES.md § Migrations` (CLI-stamped timestamp, forward-only,
  explicit `down()`).
- `test/manual/grades-rc-export.verify.ts` — must be run (and its Banner-only scenarios
  rewritten) as part of validating the `GRADES_RC_SQL` rewrite, per the file's own stated
  convention; this is the only executable check for that query short of hitting a real
  database.
- `openspec/specs/scrape-retention-and-cached-exports/` — the `partial`-run cascade-delete
  behavior this change's Problem statement is about is defined there; this change does not
  modify that behavior, only removes the failure mode's trigger (the grades endpoint call).
- `openspec/specs/gradesrc-export-performance-and-storage/` — the Planner-side performance
  fixes this change's surviving SQL must not regress; no new `EEXPLAIN` work is anticipated
  since the Planner leg itself is untouched, but the design phase should re-run
  `test/manual/grades-rc-export.verify.ts` against realistic data to confirm.

## Risks

| Risk                                                                                                                                                                                                                                                             | Impact                                                                                                                                                                                                                                     | Mitigation                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Removing `banner_legs` also removes its incidental `programCode` resolution, which silently backfills `careerCode` for every row (Banner and Planner) via a window function                                                                                      | High — the export's `careerCode` column could go blank for 100% of rows, not just Banner-sourced ones, if not explicitly preserved                                                                                                         | Resolved at proposal time (see What already exists): a standalone `raw_alumno`-based CTE replaces it, decoupled from grades data; AC-5 makes this a checked property, not an assumption                                                                                        |
| `GRADES_RC_SQL` is flagged in its own header comment as a query where "a plausible-looking rewrite" has previously caused an 8x regression and, separately, an unbounded production query — removing an entire leg is a large structural edit to that same query | High — a mistake here is a correctness bug in real grade data, or a performance regression, in a query nothing but the manual script exercises                                                                                             | `test/manual/grades-rc-export.verify.ts` re-run and updated (AC-6) before merging; design phase should also request an `EXPLAIN (ANALYZE, BUFFERS)` pass against real data for at least one period, mirroring the methodology `gradesrc-export-performance-and-storage` used   |
| Some school/programme may currently have grades that exist **only** in Banner and never made it into Planner (the reverse of the `R4`/`R8` scenarios this investigation found)                                                                                   | Medium — those specific grades would stop appearing in `gradesRc` after this change, a real (if judged acceptable) data-completeness regression, not just a reliability improvement                                                        | Not automatically checkable without a live data comparison; design/implementation phase should run both the old and new `GRADES_RC_SQL` against the same real period's raw data and diff row counts/content before this ships, to quantify what (if anything) is actually lost |
| Dropping `raw_notas` is irreversible for any data currently in it — the down() migration recreates the empty table/schema, not historical rows                                                                                                                   | Low — per Non-goals, only the latest completed run's rows ever exist at any time, and nothing downstream reads `raw_notas` historically (the persisted `gradesRc` export output already captured whatever was last generated, per ADR-004) | None needed beyond confirming the export's already-persisted `rows_data` for the current period is not itself derived from `raw_notas` in a way that would need reconciling — verify during design                                                                             |

## Open questions

None — the two decisions that would otherwise block design (careerCode resolution strategy;
keeping `counts.grades`/`'studentsAndGrades'` stable for the frontend) were resolved with the
requester during this proposal's investigation.

---

### Scope extension — drop `counts.grades` instead of keeping it at permanent zero (2026-08-31)

The original Non-goal above ("keeping `counts.grades`/`'studentsAndGrades'` stable for the
frontend") is **reversed for `counts.grades` only** (`'studentsAndGrades'` as a `ScraperPhase`
literal is unaffected and stays as originally scoped). After the change shipped, seeing a live
API response where `counts.grades` is permanently `0` forever made clear this reads as a bug,
not a deliberate state — worse than the response-shape risk the original Non-goal was written
to avoid.

Reversed after confirming it is safe to do so: `RunSummaryResponseDto.counts` /
`ScrapeRunStatusResponseDto.stats` are both typed `@ApiPropertyOptional({ type: Object,
nullable: true })` — opaque to Swagger, no field-level shape documented — so removing `grades`
from the runtime object changes **nothing** in `openapi.json` (confirmed: `pnpm openapi:export`
after the removal reproduces the exact same pre-existing, already-verified-unrelated drift as
before, byte-for-byte). This is not an API contract change in the OpenAPI sense; it is a
runtime JSON shape change for any consumer reading the field directly, which the requester
confirmed is acceptable and coordinated with the frontend side.

10. **AC-10** — Given a Banner scrape run's stats after this change, when `stats.counts` /
    `RunSummary.counts` is inspected, then it contains only `{ schedule, enrollment, students }`
    — no `grades` key at all, present-and-zero or otherwise.

| AC  | Criterion                                                    | Satisfied by                                                                                                                                          |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | `counts.grades` removed entirely, not kept at permanent zero | `ScrapeStats`/`RunSummary.counts` type in `scraper.service.ts`; verified via the full jest suite and a manual `openapi:export` diff showing no change |
