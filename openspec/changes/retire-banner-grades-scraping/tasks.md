# Tasks — Retire Banner grades scraping (raw_notas) in favor of Planner

**Slug**: `retire-banner-grades-scraping` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Milestone 3's tasks touch the same two files
  sequentially (`grades-rc-export.sql.ts` then `grades-rc-export.verify.ts`) — do not fan
  those out to parallel subagents; Milestones 1, 2, and 4 have no file overlap with each
  other and can run in parallel batches.
- TDD throughout: write the test, **see it fail**, implement, see it pass. For the migration
  task (2.1), the equivalent of "red/green" is applying `up()` then `down()` against a scratch
  database and diffing the schema — there is no jest test for a migration in this repo.
- A task is complete when **its test passes** (or, for 2.1/3.5/4.1, its manual verification
  step succeeds), not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the
  heading. Never one without the other.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*` — `docs/adr/ADR-005-planner-only-grades-source.md`
  is already written and is not part of this task list.
- `pnpm test` / `npx jest --no-coverage <path>` for jest. `pnpm exec tsc --noEmit -p
tsconfig.build.json` after every implementation task, before its commit.

## Goal

Stop scraping and storing Banner grades data (`raw_notas`), so a Banner scrape's success no
longer depends on Banner's grades endpoint, and regenerate the `gradesRc` export from Planner
(`raw_planner_nota`) alone — per ADR-005.

## Slicing

Vertical. Milestone 1 removes the failure mode at the source and is independently
demonstrable (a Banner scrape run whose grades endpoint is down now still finishes
`'completed'`). Milestone 2 removes the now-dead storage. Milestone 3 removes the now-dead
query leg and its test coverage, replacing `careerCode` resolution and every Banner-only
fixture scenario. Milestone 4 closes the loop: quantifies the ADR-005 mitigation risk against
real data, and brings the docs current.

---

## Milestone 1 — Stop scraping Banner grades

### Task 1.1 — Red: a clean run should finish `'completed'` with no grades wiring ✅ DONE (2026-08-31)

- [x] Task complete

> `execute()`'s real `createLimiter(SCRAPE_CONCURRENCY)` call has no stubbable seam (unlike
> `scrapeSchedule`'s `createScheduleLimit()`), so the happy-path test as originally worded
> couldn't reach `'completed'` under this repo's `module: nodenext` ts-jest setup — the same
> documented limitation the file's own top comment already calls out. Added a
> `createScrapeLimit()` method (Task 1.2) mirroring the existing `createScheduleLimit()`
> pattern, purely as a test seam. Confirmed genuinely red first: `createScrapeLimit` didn't
> exist yet (`jest.spyOn` failed) and `scrapeGrades` still did.

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (modify/test)

**Steps (TDD)**

1. Add a case: given schedule/enrollment/students all succeed (nothing mocked to fail,
   `mockRawNotasRepository` removed from the test's setup), when `execute()` runs, then the
   final `status` is `'completed'`. Also assert `this.http.get` is never called with a path
   matching `/alumno/notaactual/notas/`.
2. `npx jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts` →
   expect **red** (current code still calls `scrapeGrades`, which needs a mocked
   `rawNotasRepository`/grades response to avoid an error that flips status to `'partial'`).

**Commit**: `test(banner-scraper): assert a clean run completes without grades scraping`

### Task 1.2 — Green: remove `scrapeGrades` and the grades half of `studentsAndGrades` ✅ DONE (2026-08-31)

- [x] Task complete

> Also dropped `GradePair`, `buildGradePairs`, and the now-dead `courseByNrc`/`enrollments`
> destructuring in `execute()` (both methods still compute and return them internally,
> untouched — only the now-pointless extraction at the call site was removed, to keep this a
> minimal diff rather than refactoring `scrapeSchedule`/`scrapeEnrollment`). 23/23 tests green,
> `tsc --noEmit` clean on the first attempt after the edit.

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)

**Steps (TDD)**

1. Delete `scrapeGrades`, `buildGradePairs`, the `GradePair` interface, and the
   `RawNotasRepository`/`RawNotasInsert` import and constructor parameter.
2. Change the `'studentsAndGrades'` phase (lines 235-249) to a single
   `await this.scrapeStudents(runId, level, studentCodes, stats, limit)` call — drop the
   `Promise.all([...])` and the now-single-purpose `limit`'s justification comment about
   sharing between two scrapers (keep the limiter itself; `scrapeStudents` still uses it).
3. `stats.counts.grades` stays in the `ScrapeStats`/`counts` shape, initialized to `0`
   (`execute()` line 211) — do not remove the field (see proposal.md Non-goals).
4. `npx jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts` →
   expect **green**.
5. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(banner-scraper): stop scraping Banner grades`

---

## Milestone 2 — Remove `raw_notas` storage

### Task 2.1 — Remove `RawNotasEntity`/`RawNotasRepository`/module registration ✅ DONE (2026-08-31)

- [x] Task complete

> Also fixed a now-stale doc comment in `scraper.service.spec.ts` (the "phase tracking" describe
> block's header still listed `scrapeGrades` among the stubbed methods and described the old
> unconditional `createLimiter` call). Repo-wide grep for `RawNotasEntity`/`RawNotasRepository`/
> `RawNotasInsert`/`scrapeGrades`/`buildGradePairs`/`GradePair` under `src/` returns nothing.

**Files**

- `src/modules/admin/banner/raw/model/raw-notas.entity.ts` (delete)
- `src/modules/admin/banner/raw/core/raw-notas.repository.ts` (delete)
- `src/modules/admin/banner/raw/raw-database.module.ts` (modify)

**Steps**

1. Delete both files.
2. Remove `RawNotasEntity`/`RawNotasRepository` from `RAW_ENTITIES`/`RAW_REPOSITORIES` and
   their imports in `raw-database.module.ts`.
3. Repo-wide grep confirms zero remaining references to `RawNotasEntity`, `RawNotasRepository`,
   `RawNotasInsert` (AC-2).
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `refactor(banner-raw): remove RawNotasEntity and RawNotasRepository`

### Task 2.2 — Migration: drop `raw_notas` ✅ DONE (2026-08-31)

- [x] Task complete

> Verified against a throwaway `postgres:16` container (`abet-raw-verify`, port 55433):
> `migration:raw:run` applied all migrations including this one cleanly, `\d raw_notas`
> confirmed the table gone, `migration:raw:revert` recreated it, and `\d raw_notas` afterward
> matched production's current schema exactly — columns, `PK_raw_notas`, `FK_raw_notas_run_id`,
> `UQ_raw_notas_run_id_student_code_course_code`, and both stale-named indexes
> (`IDX_raw_notas_periodo_curso_codigo`, `IDX_raw_notas_codigo_alumno`) present with their
> current (not "cleaned up") names, per design.md's explicit table.

**Files**

- `src/database/migrations-raw/<timestamp>-drop-raw-notas-table.ts` (create, via CLI)

**Steps**

1. `pnpm migration:raw:create src/database/migrations-raw/drop-raw-notas-table`.
2. `up()`: `DROP TABLE "raw_notas"`.
3. `down()`: recreate the table exactly as it exists today — see `design.md` § AC-3 for the
   full column/constraint/index list, **including the two indexes whose names were never
   renamed to English** (`IDX_raw_notas_periodo_curso_codigo`,
   `IDX_raw_notas_codigo_alumno` — cover the current, renamed columns `period`/`course_code`
   and `student_code` respectively, despite their Spanish names).
4. Against a scratch Postgres (e.g. the `abet-rc-verify` container pattern documented in
   `test/manual/grades-rc-export.verify.ts`'s header, or any throwaway raw-schema DB): run
   `pnpm migration:raw:run`, confirm `raw_notas` no longer exists (`\d raw_notas` in `psql`
   reports nothing), run `pnpm migration:raw:revert`, confirm the table and every
   constraint/index listed above exists again with the exact names given.

**Commit**: `feat(banner-raw): drop raw_notas table`

---

## Milestone 3 — Planner-only `gradesRc`, verified end-to-end

### Task 3.1 — Remove the Banner leg from `GRADES_RC_SQL`; resolve `careerCode` via `program_lookup` ✅ DONE (2026-08-31)

- [x] Task complete

> Found and fixed three things design.md didn't anticipate: (1) `grades-rc-export.repository.spec.ts`
> had a test literally splitting `MATERIALIZE_GRADES_RC_SQL` on the string `'banner_grades AS'` —
> repointed it at `'program_lookup AS'`, which now sits in the same position (right after
> `planner_run`). (2) Several stale "Banner+Planner"/"both scrapings" comments in
> `grades-rc-export.repository.ts`, `scraping-exports.types.ts`, and `scraping-exports.service.ts`
> — updated to describe the Planner-only merge, referencing ADR-005. (3) A backtick inside a new
> SQL-comment string broke out of the enclosing JS template literal (`GRADES_RC_SQL` is itself a
> backtick-delimited string) — caught immediately by `tsc`, fixed by dropping the backticks from
> that comment's prose. 95/95 tests green across the whole `scraping-exports` module,
> `tsc --noEmit` clean. `test/manual/grades-rc-export.verify.ts` deliberately not run yet — its
> fixtures still target the now-removed Banner leg (Tasks 3.2–3.4).

**Files**

- `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` (modify)

**Steps**

1. Delete the `banner_grades`, `banner_sections`, and `banner_legs` CTEs.
2. Add the `program_lookup` CTE (reads `raw_alumno`, scoped by the retained `banner_run` CTE)
   exactly as specified in `design.md` § AC-4/AC-5, with the explanatory comment on why
   `banner_run` is kept.
3. Remove `program_code` from `planner_raw`/`planner_legs`, from `candidates`'s inner
   `SELECT`s, and from `merged`'s window-function column list (its `max(program_code) OVER
(PARTITION BY student_code)` line).
4. Collapse `candidates`'s `UNION ALL` to a plain `SELECT ... FROM planner_legs`.
5. Change the final `SELECT`'s `careers` join to go through `program_lookup` by
   `student_code`, per `design.md` § AC-4/AC-5's exact SQL. `COALESCE(c.career_code, '')`
   stays unchanged.
6. Grep the file confirms no remaining reference to `raw_notas`, `banner_grades`,
   `banner_sections`, or `banner_legs` (AC-4).
7. This task alone will not pass `test/manual/grades-rc-export.verify.ts` yet — its fixtures
   still write to `raw_notas` (dropped in Milestone 2) and assert Banner-only behavior. Do not
   run it until Task 3.4 lands; `pnpm exec tsc --noEmit -p tsconfig.build.json` is the only
   check for this task in isolation.

**Commit**: `feat(scraping-exports): read gradesRc from Planner only`

### Task 3.2 — Rewrite the `NRC1` fixture family (R1, R2 dedup/scope, R5a-c, R6, R7) as Planner-only ✅ DONE (2026-08-31)

- [x] Task complete

**Files**

- `test/manual/grades-rc-export.verify.ts` (modify)

**Steps**

1. Per `design.md`'s rewrite-plan table: replace the `notas('A1'/'A1B'/'A1C'/'A1D'/'A1E'/'A1F',
...)` Banner fixture calls for `NRC1`/`NRC1B` with equivalent `seccion`/`evaluacion`/
   `notaPlanner` Planner calls, preserving each scenario's shape:
   - an "unfinished run" case for R1, using a `planner_scrape_run` row with
     `status = 'running'` (mirrors `BANNER_UNFINISHED_RUN`'s role for the `banner_run` CTE,
     but against `planner_run`);
   - two loaded sections sharing one course for R2's dedup (`NRC1`/`NRC1B` both resolving to
     the same `courseCode` in their `seccion` payload);
   - the R7 non-numeric/unknown-status cases via a Planner nota whose `gradeFormat`/`grade` is
     itself non-numeric text (e.g. `'RET'`, `'XXX'`) rather than Banner's overloaded `nota`
     field — `candidates`'s `status_text` fallback is source-agnostic, so this reaches the
     same code path.
2. Update every assertion in this family (`R1`, `R2`, `R5a`, `R5b`, `R5c`, `R6 only the
designated grade ships`, `R7` numeric/non-numeric/unknown-status/unregistered-status) to
   reference the new Planner-sourced rows — same expected values, same `NRC1`/`A1`-family
   keys (the section/student naming stays the same; only how the row is produced changes).
3. Do not run the script yet (Task 3.4 still owes the cross-source assertion rewrites and the
   `assertThrowaway` schema-check update).

**Commit**: `test(scraping-exports): rebuild grades-rc-export.verify.ts's NRC1 fixtures on Planner`

### Task 3.3 — Rewrite the `NRC5`/`NRC6`/`NRC8`/`NRC9`/`NRC13`/`NRC14` fixture families as Planner-only ✅ DONE (2026-08-31)

- [x] Task complete

> Found one real constraint design.md didn't anticipate: `raw_planner_nota` has
> `UQ_raw_planner_nota_run_id_component_id_student_code` — no `scraped_at` in the key, so two
> competing scrapes of "the same evaluation" can't be two rows with the same `component_id`.
> Worked around it the same way Planner's own re-evaluation flow would: two different
> `component_id`s that both resolve to the same `raw_type` via their own `evalComponentCode`
> compete correctly in `merged`'s `DISTINCT ON`. Used for NRC12's rework in Task 3.4. Also
> discovered `raw_horario`/`raw_matricula` fixture setup (the old `banner`/`horario`/`matricula`
> helpers) was now 100% dead weight — nothing in the rewritten `GRADES_RC_SQL` reads them anymore
> — so removed them entirely rather than leaving unused inserts around.

**Files**

- `test/manual/grades-rc-export.verify.ts` (modify)

**Steps**

1. Per `design.md`'s rewrite-plan table, replace each section's Banner `notas(...)` fixture(s)
   with equivalent Planner `seccion`/`evaluacion`/`notaPlanner` calls:
   - `NRC5` — fallback rescue of an unregistered raw type code (R6, R8's
     outside-career-map case);
   - `NRC6` — two designated types on one section with disagreeing weights, plus the
     no-designated-grade fallback (R6);
   - `NRC8` — a course-level status (`isSanctioned`/`statusName`) explaining a missing
     designated grade (R6);
   - `NRC9` — a graded section left out of `LOADED_SECTIONS` (R2, out-of-scope);
   - `NRC13` — the designated type present with a blank/null grade and no status (R7,
     defaulted-and-flagged);
   - `NRC14` — a graded section left out of `CONTROL_SECTIONS` (R2, no-CONTROL-outcome).
2. Update the corresponding assertions to reference the new rows (same expected values).

**Commit**: `test(scraping-exports): rebuild grades-rc-export.verify.ts's fallback/status fixtures on Planner`

### Task 3.4 — Rework cross-source assertions; drop the schema's `raw_notas` requirement ✅ DONE (2026-08-31)

- [x] Task complete

> Scope was larger than the task text: every one of the ~19 original `notas(...)` Banner-helper
> calls had to go, not just A2/A12 (raw_notas no longer exists post-migration, so any leftover
> call would error at runtime) — this included NRC3's `notas('A3', ...)`, which the task text
> didn't name but design.md's own rewrite-plan table's "e.g." already implied. Removed the
> `notas`/`horario`/`matricula` helpers and the `banner` fixture array entirely (dead once their
> only consumer, `banner_legs`, was gone). `NRC3`'s "both sources agree -> one row" and `NRC2`'s
> "newest scrape wins" assertions are now trivially true (only one source contributes at all) --
> left as-is per design's explicit scope, not strengthened. NRC12's rework (see Task 3.3's retro)
> covers same-source "status beats numeric" properly.

**Files**

- `test/manual/grades-rc-export.verify.ts` (modify)

**Steps**

1. Remove the Banner-side `notas(...)` calls for `A2` (`NRC2`) and `A12` (`NRC12`) — their
   Planner-side fixtures already exist and are unchanged.
2. Rewrite the three assertions whose premise was specifically "the other source":
   - `R4 designated grade only Banner has` → remove (no longer meaningful; `R4 designated
grade only Planner has` already covers "a designated grade with a single source").
   - `R7 a course-level status beats a numeric grade from the other source, however new` →
     rephrase as a same-source precedence case: two Planner nota rows for the same
     `(section, student, raw_type)` with different `scraped_at`, one a course-level status and
     one numeric, asserting the status wins regardless of recency (the underlying rule
     `merged`'s `ORDER BY status_is_course_level DESC, ...` still needs proving; it no longer
     needs a cross-source pair to prove it).
   - `R8 career filled from the Banner leg when the Planner row wins` → rephrase as `R8 career
resolved independently of which row carries the grade` — same `NRC2`/`A2` key, asserting
     `careerCode === 'CC'` now comes from `program_lookup` regardless of the grade's own
     source.
3. Update `assertThrowaway`'s schema check to stop requiring `to_regclass('public.raw_notas')`
   — only `raw_planner_nota` is required going forward.
4. `pnpm exec tsc --noEmit -p tsconfig.json` (this file is plain `ts-node`, not part of the
   jest suite, but must still typecheck — note `tsconfig.build.json` excludes `test/`
   entirely, so it must be the base `tsconfig.json` here, not the build one).

**Commit**: `test(scraping-exports): rework grades-rc-export.verify.ts's cross-source assertions`

### Task 3.5 — Run the full verification against a scratch Postgres ✅ DONE (2026-08-31)

- [x] Task complete

> `docker run postgres:16` on a throwaway port, `migration:raw:run`, then
> `VERIFY_DB_URL=... RAW_DB_URL=<distinct-placeholder> npx ts-node -T -r tsconfig-paths/register
test/manual/grades-rc-export.verify.ts`. All 41 checks passed on the first real run against
> Postgres -- no fixture/SQL mismatches needed fixing. (RAW_DB_URL has to point at some URL
> distinct from VERIFY_DB_URL even when nothing reads it, purely to satisfy the script's own
> anti-footgun guard comparing the two.)

**Files**

- None (verification only)

**Steps**

1. Follow `test/manual/grades-rc-export.verify.ts`'s own header instructions: bring up a
   throwaway Postgres, `RAW_DB_URL=<throwaway> pnpm migration:raw:run` (now including Task
   2.2's `raw_notas` drop), then `VERIFY_DB_URL=<throwaway> npx ts-node -T -r
tsconfig-paths/register test/manual/grades-rc-export.verify.ts`.
2. Every check reports `ok` (AC-6). If any fails, fix the fixture or the SQL — do not adjust
   an assertion to match a wrong result.

**Commit**: none (verification step folded into Task 3.4's commit if fixes are needed, otherwise no commit)

---

## Milestone 4 — Quantify the ADR-005 risk; bring docs current

### Task 4.1 — Diff old vs new `GRADES_RC_SQL` against one real period's raw data ✅ DONE (2026-08-31)

- [x] Task complete

> Ran a targeted, read-only diff against production's raw DB directly (SSH + `docker exec
scrape_pg psql`), rather than replaying the full ~30-CTE query with all 17 bound parameters by
> hand (too much surface for a one-off hand-reconstruction to get right safely against
> production). Compared coverage at `(student_code, course_code)` grain instead — the same grain
> `GRADES_RC_SQL` itself collapses to per `(section, student)`. Result for period 202610 (the only
> period with real grades data right now): **0 of 51,435 Banner-graded pairs have no Planner
> counterpart** — full result and the exact query are in `runbook.md`. This is real, strong
> evidence for ADR-005's premise, not a full formal proof (a pair-level match doesn't confirm
> every individual evaluation-type/weight also agrees), but it directly answers the question this
> task existed to answer: at real production scale, Planner's coverage is a strict superset of
> Banner's, not a partial one.

**Files**

- None (read-only investigation; findings recorded in `runbook.md`'s Data validation section)

**Steps**

1. Per `runbook.md`, connect read-only to the raw datasource (same methodology as
   `gradesrc-export-performance-and-storage`'s own investigation: SSH + `psql`, or
   `EXPLAIN`/`SELECT` via the app's own credentials, nothing executed against the running
   app).
2. Run the **pre-change** `GRADES_RC_SQL` (from `develop`, before Task 3.1) and the
   **post-change** version (this branch) against the same real period's raw data, and diff:
   row count, and specifically any `(section, student)` pair present in the old output but
   absent from the new one — those are grades that existed only in Banner.
3. Record the exact finding (a count, and, if non-zero, which periods/sections are affected)
   in `runbook.md`. This is the ADR-005 mitigation — the ADR explicitly does not claim the
   loss is zero, and this is what makes it a known number instead of an assumption.
4. If the diff shows non-trivial loss, stop and flag it to the requester before proceeding —
   this is a product question (per the ADR's own "Alternatives considered" note), not one to
   resolve unilaterally mid-implementation.

**Commit**: none (finding recorded in `runbook.md`, not code)

### Task 4.2 — Update `docs/CONTEXT.md` ✅ DONE (2026-08-31)

- [x] Task complete

> The ADR-005 bullet (added when the ADR was written) had a stale "see the retention rule below"
> pointer — the retention rule is actually above it in the file — fixed while rewording the bullet
> to describe the now-implemented Planner-only state, including the real 0-of-51,435 production
> measurement from Task 4.1. Grepped the whole repo's `*.md` for `raw_notas`: the only other hits
> are archived `openspec/specs/*` records of past changes, correctly describing production as it
> was at the time — left untouched, per that convention.

**Files**

- `docs/CONTEXT.md` (modify)

**Steps**

1. Remove the "Not yet implemented as of this writing" caveat from the ADR-005 bullet added
   during the ADR's own "Link it" step (§ Business Rules), and update its wording to describe
   the Planner-only state as current.
2. In § Database's two-datasource paragraph, remove `raw_notas` from the
   `raw_horario`/`raw_matricula`/`raw_alumno`/`raw_notas` list.
3. Grep `docs/CONTEXT.md` for any other `raw_notas` mention; update or remove.

**Commit**: `docs(context): update raw_notas removal and Planner-only gradesRc state`

### Task 4.3 — Confirm `openapi.json` is unchanged ✅ DONE (2026-08-31)

- [x] Task complete

> `pnpm openapi:export` produced a 16-line diff (a `StartAuthSessionDto`/Planner-auth
> `requestBody` and a reworded `campusIds` description on the semaphore report filter DTO) —
> neither touched by this change. Verified it's pre-existing drift, not something this branch
> introduced: reproduced the identical diff after `git stash`ing every change on this branch
> (i.e. against this branch's base commit, same as `develop`). Left `openapi.json` untouched
> (reverted the diagnostic regen) — fixing unrelated drift is out of scope for this PR; AC-9 (no
> diff caused **by this change**) holds.

**Files**

- `openapi.json` (verify only — no expected diff)

**Steps**

1. `pnpm openapi:export`.
2. `git diff openapi.json` — expect empty (AC-9). If not empty, something in this change
   touched a route/DTO/response shape that wasn't supposed to; investigate before proceeding.

**Commit**: none unless the diff is non-empty and legitimately needs regenerating (should not
happen per design.md; if it does, note why in the PR description)

---

## Audit fixes (/abet-audit-pr)

Six parallel auditors (code quality, architecture/docs, testing, antipatterns, security,
runtime robustness) reviewed the diff. Verdict: **NOT READY** — 2 majors, 5 minors, 2
suggestions. Full report is in the conversation; tasks below implement the fixes.

### Review round 1

### Task AF.1 — Fix the runbook's deploy-order race (major) ✅ DONE (2026-08-31)

- [x] Task complete

> Flipped the deploy prerequisite order (deploy image first, confirm no in-flight Banner
> scrape, then migrate), added a matching "Do NOT" bullet for symmetry with the existing
> rollback-order one, and left "How to revert" untouched — it already had the correct order
> for a rollback (revert migration before deploying the old image back).

**Files**

- `openspec/changes/retire-banner-grades-scraping/runbook.md` (modify)

**Steps**

1. Reorder the "⚠️ Deploy prerequisite" section: recommend running `pnpm migration:raw:run`
   only **after** the new image is confirmed serving traffic (already documented as
   "harmless" in the existing text), not before. State explicitly why: an in-flight or
   newly-triggered Banner scrape on the still-live **old** image calls `scrapeGrades` and
   writes to `raw_notas` — dropping that table before the old image is fully retired
   reintroduces the exact `'partial'`-cascade failure mode this change fixes, for the
   deploy window itself.
2. Update the "How to revert" section if its ordering logic is affected by this change.

**Commit**: `docs(runbook): migrate raw_notas after deploy, not before`

### Task AF.2 — Add a fixture proving the pure newest-scrape-wins tie-break (major) ✅ DONE (2026-08-31)

- [x] Task complete

> Added a second `component_id` on NRC2 resolving to the same `raw_type` (`PC1`), older,
> losing grade `10.00` vs. the existing newer `12.00` — same two-`component_id` technique
> NRC12 already used, needed because `raw_planner_nota`'s unique constraint has no
> `scraped_at` column. Ran the negative check explicitly: temporarily made the losing row
> newer instead — `'R4 sources disagree -> newest scrape wins'` failed as expected (1 of 41),
> confirming the assertion is now genuinely load-bearing, not vacuous. Reverted to the
> correct state; re-ran, 41/41 green again.

**Files**

- `test/manual/grades-rc-export.verify.ts` (modify)

**Steps (TDD-equivalent: red then green against a real Postgres)**

1. Add a second Planner evaluation/nota competing on NRC2 for the same `raw_type` (a new
   `component_id` resolving to `PC1` via its own `evalComponentCode`, mirroring the
   NRC12 two-`component_id` technique already used for the status-vs-numeric case),
   with an OLDER `scraped_at` and a different grade value than the existing (newer)
   `338001` row.
2. Confirm the existing 'R4 sources disagree -> newest scrape wins' assertion
   (`of('NRC2|A2')?.grade === '12.00'`) now actually has two competing rows to prove
   the recency tie-break over, instead of being vacuously true.
3. Fix the stale fixture comment above NRC2's `notaPlanner` call, which already claims
   "a later Planner scrape... replaces an earlier one" despite there being only one row.
4. Run against a scratch Postgres per the file's own header instructions
   (`docker run postgres:16`, `migration:raw:run`, `ts-node -T -r tsconfig-paths/register
test/manual/grades-rc-export.verify.ts`) — confirm all checks still pass, and that
   removing the new competing row's `scraped_at` ordering (as a manual sanity check) would
   make the assertion fail, proving it's now load-bearing.

**Commit**: `test(scraping-exports): cover the newest-scrape-wins tie-break with two competing Planner rows`

### Task AF.3 — Remove dead `courseByNrc`/`enrollments` computation (minor) ✅ DONE (2026-08-31)

- [x] Task complete

> Also fixed an adjacent stale comment in `scrapeSchedule` ("...downstream enrollment/
> students/grades steps" — grades no longer exists) while touching that exact line. No test
> referenced the removed fields, so this was a pure internal cleanup — 23/23 green, `tsc`
> clean.

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)
- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (modify if any test asserts on the removed return fields)

**Steps**

1. `scrapeSchedule`: drop the `courseByNrc` `Map`, its population in the department loop,
   and its field in the return type — return `Promise<{ nrcs: string[] }>` (or just
   `string[]`, adjusting the one call site in `execute()` accordingly).
2. `scrapeEnrollment`: drop the `enrollments` array, its population, the now-unused
   `Enrollment` interface, and the field in the return type — return
   `Promise<{ studentCodes: string[] }>` (or just `string[]`).
3. `pnpm exec jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts`
   → confirm still green (no test currently asserts on `courseByNrc`/`enrollments`, so this
   should be a pure internal cleanup).
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `refactor(banner-scraper): remove dead courseByNrc/enrollments computation`

### Task AF.4 — Disambiguate NRC12's two now-identical assertions (minor) ✅ DONE (2026-08-31)

- [x] Task complete

> Changed the second assertion to `inSection('NRC12').length === 1 && grade !== '15.00'`
> (the newer competitor's own value) — genuinely distinct from the first assertion's
> `grade === '0' && qualificationStatusCode === 'TG404-T006'` now. Verified as part of the
> same 41/41 scratch-Postgres run as AF.2.

**Files**

- `test/manual/grades-rc-export.verify.ts` (modify)

**Steps**

1. Change the second NRC12 assertion ('R7 a course-level status beats a newer numeric
   grade of the same evaluation type') so its condition is no longer byte-identical to
   the first ('R7 sanctioned designated grade -> 0 + SAN') — e.g. additionally assert the
   newer numeric row's own value (`'15.00'`) does NOT appear as the grade, so a future
   regression that let the newer row win is caught by this assertion specifically, not
   just coincidentally by the first one.
2. Re-run against a scratch Postgres to confirm both assertions still pass.

**Commit**: `test(scraping-exports): make NRC12's two RC7 assertions independently meaningful`

### Task AF.5 — Comment `ScrapeStats.counts.grades`'s permanent zero (minor) ✅ DONE (2026-08-31)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)

**Steps**

1. Add a one-line comment at the `counts` object's `grades` field (or its initializer)
   noting it stays permanently `0` since ADR-005 retired Banner grades scraping, kept in
   the shape only for `RunSummary`/response-shape stability.
2. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `docs(banner-scraper): comment why counts.grades stays permanently zero`

### Task AF.6 — Correct tasks.md Task 3.4's retro (minor, doc-only) ✅ DONE (2026-08-31)

- [x] Task complete

> Corrected step 4 in Task 3.4's own body text (line 314) — it cited
> `tsc -p tsconfig.build.json`, which excludes `test/` entirely and therefore never actually
> typechecked this file. Fixed to cite `tsconfig.json`, matching what was actually run.

**Files**

- `openspec/changes/retire-banner-grades-scraping/tasks.md` (modify)

**Steps**

1. Task 3.4's step 4 claims `pnpm exec tsc --noEmit -p tsconfig.build.json` typechecks
   `grades-rc-export.verify.ts` — `tsconfig.build.json` excludes `test/` entirely. Correct
   it to cite `tsconfig.json` (which does include `test/`) and/or the live `ts-node` run
   (Task 3.5) as what actually verified this file's types.

**Commit**: folded into this same audit-fixes commit batch, no separate test/build step

### Task AF.7 — Fix the stale `SCRAPE_CONCURRENCY` comment (minor) ✅ DONE (2026-08-31)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)

**Steps**

1. The comment justifying `SCRAPE_CONCURRENCY = 80` cites benchmarking "the grades
   endpoint directly against Banner" — that endpoint's code path (`scrapeGrades`) is now
   deleted; the constant governs `scrapeStudents` alone via the new `createScrapeLimit()`.
   Amend the comment to note the benchmark predates this change and hasn't been
   re-validated against the students-only path in isolation.

**Commit**: folded into the same commit as AF.5 (both are comment-only edits to this file)

### Task AF.8 — Clarify Banner's role in `docs/CONTEXT.md` (suggestion) ✅ DONE (2026-08-31)

- [x] Task complete

### Review round 2 (re-audit after round 1's fixes)

Six auditors re-ran against the HEAD produced by AF.1–AF.8. **No blockers or majors** — both
round-1 majors independently reproduced as genuinely resolved (Auditor C went further than
asked and simulated two different `merged` `ORDER BY` regressions in the SQL itself, confirming
the NRC12 assertions actually catch what they claim to; Auditor F traced the deploy-order fix
at both the runbook and code level). Three new minors, all mechanical/non-logic, fixed below.

### Task AF.9 — Restore the "why" trimmed from `NUMERIC_GRADE_PATTERN`'s comment (minor) ✅ DONE (2026-08-31)

- [x] Task complete

> Two auditors (A and D) independently flagged the same over-trim: the earlier comment cut
> removed the actual reason the pattern exists (a source's grade field can hold status text
> like `'RET'`, not just numbers) and left only a restatement of the adjacent `candidates` CTE
> comment. Restored the "why" in one sentence, still shorter than the pre-audit-round-1
> original.

**Files**

- `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` (modify)

**Commit**: `docs(scraping-exports): restore the why in NUMERIC_GRADE_PATTERN's comment`

### Task AF.10 — Remove stale mock fields from the new regression test (minor) ✅ DONE (2026-08-31)

- [x] Task complete

> Auditor D found the "reaches completed without grades scraping" test's `mockResolvedValue`
> calls still passed `courseByNrc`/`enrollments` — fields removed from the real return types by
> Task AF.3 — copy-pasted from a pre-existing block elsewhere in the file. Not a type error, but
> misleading in a test whose whole point is proving those fields are gone. Fixed only this PR's
> own new block; the pre-existing occurrence elsewhere in the file predates this change and is
> out of scope.

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (modify)

**Commit**: `test(banner-scraper): drop stale courseByNrc/enrollments from a new mock`

### Task AF.11 — Fix the nonexistent endpoint path in the runbook (minor) ✅ DONE (2026-08-31)

- [x] Task complete

> Auditor F caught that the deploy prerequisite's in-flight-scrape check cited
> `GET .../banner/scraper/runs`, which doesn't exist — verified the real route directly against
> `scraper.routes.ts`: `GET /banner/scrape`, scoped by the `X-Academic-Period-Id` header, not a
> path segment. Also folded in the auditor's suggestion that the check is period-scoped while
> `raw_notas` is not, so the runbook now says to check every period with a plausibly-active
> scrape, not just the one being migrated for.

**Files**

- `openspec/changes/retire-banner-grades-scraping/runbook.md` (modify)

**Commit**: `docs(runbook): fix the in-flight-scrape check's endpoint path`

> **Note on process**: these three fixes were applied without a third full six-auditor round.
> All three are mechanical (comment content, removing already-inert stale mock properties, a
> doc'd URL correction) — none touch application logic, and round 2 already independently
> re-verified every substantive behavioral fix, including by simulating actual regressions.
> Verified via `tsc --noEmit` + the affected jest suites (135/135) after applying all three.

**Files**

- `docs/CONTEXT.md` (modify)

**Steps**

1. In the External Integrations table, Banner's "Role" cell still reads "...enrolment,
   schedules and grades" with no note that grades are no longer scraped from it. Add a
   short clause pointing at ADR-005.

**Commit**: `docs(context): note Banner grades are no longer scraped, per ADR-005`

<!--
Append-only sections below. These record what actually happened, not what was planned,
and they are the best input to the next design.

## Unplanned — <what and why>

### Task U.1 — <title>
- [ ] Task complete

## Post-QA fixes
-->
