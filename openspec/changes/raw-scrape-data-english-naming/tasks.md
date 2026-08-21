# Tasks — Rename Spanish Raw-Scrape Identifiers to English

**Slug**: `raw-scrape-data-english-naming` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and
  fan the non-overlapping ones out to parallel subagents. Milestones 2/3 (Banner) and 4/5
  (Planner) touch entirely disjoint files and can run as one such batch.
- TDD throughout: write the test, **see it fail**, implement, see it pass. The exceptions are
  the two migrations, Task 1.1 and Task 6.1 — this repo has no `.spec.ts` for any migration
  (confirmed: `src/database/migrations-raw/*.spec.ts` doesn't exist anywhere in the tree), so
  their verification is the manual apply/revert procedure in `runbook.md`, not `pnpm test`.
  Task 1.1 must be created and merged before Task 6.1 is created (design.md § AC-1) — Task
  6.1's migration runs against the columns Task 1.1 renames.
- A task is complete when **its test passes** (or, for Tasks 1.1/6.1, when the manual
  verification in `runbook.md` has actually been run), not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the
  heading. Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*`.
- Run `pnpm exec tsc --noEmit -p tsconfig.build.json` after any task touching entities,
  repositories, services, or DTOs — the raw SQL in Milestone 7 is the one place a rename
  mistake won't be caught by the compiler (see design.md § AC-4), everywhere else it will.

## Goal

Rename every Spanish identifier in the raw-scrape datasource (Banner + Planner: DB columns,
entity properties, repository/service parameters, our own request/response DTOs, and the
`ScraperPhase`/`PlannerScraperPhase` literal values) to English, per `docs/POLICIES.md` §
Language Rules — and, since `RunSummaryResponseDto`/`PlannerRunSummaryResponseDto` are
already being touched, add a `triggeredByName` field that resolves the existing
`triggeredBy` (`"user:12"`) against `organization.users` to a display name, falling back to
`'-'` when it can't be resolved.

## Slicing

Vertical per subsystem: the raw migration first (everything downstream depends on the new
column names existing), then Banner's raw layer and scraper layer, then Planner's mirror,
then the two cross-cutting renames (`ScraperPhase`/`PlannerScraperPhase` values,
`scraping-exports` raw SQL), then the new `triggeredByName` feature, then the wire-level
close-out (`openapi.json`, full suite, docs).

---

## Milestone 1 — Raw-datasource migration (AC-1, AC-2)

### Task 1.1 — Rename raw-scrape columns and their unique constraints

- [ ] Task complete (code written and verified against design.md; manual `migration:raw:run`/`revert` step below not yet run — no raw DB connection available in this session)

> `pnpm migration:raw:create` produced `src/database/migrations-raw/1787346461765-rename-raw-scrape-spanish-columns.ts`. `up()`/`down()` match design.md § AC-1's column and constraint tables exactly (verified by direct read of the file, not just report). Not yet applied to any database — Task 6.1's migration was created immediately after, so timestamp ordering (1787346461765 < 1787346520613) is correct. Manual verification (apply, confirm, revert, re-apply) is a `runbook.md` step for whoever has access to a raw DB copy before this ships.

**Files**

- `src/database/migrations-raw/<timestamp>-rename-raw-scrape-spanish-columns.ts` (create, via CLI)

**Steps**

1. `pnpm migration:raw:create src/database/migrations/rename-raw-scrape-spanish-columns`
   (this stamps the file under `migrations-raw/` per the raw datasource's CLI config — do
   not hand-pick the timestamp).
2. Implement `up()`: one `ALTER TABLE ... RENAME COLUMN` per row in design.md § AC-1's
   column table, then drop+re-add the four renamed `UNIQUE` constraints per design.md's
   constraint table (`RENAME COLUMN` does not rename a constraint that references the
   column).
3. Implement `down()`: exact inverse order (constraints back to their Spanish names first,
   then columns).
4. Manual verification (see `runbook.md`): run `migration:raw:run` against a local/staging
   copy of the raw DB, confirm `\d scrape_run` etc. show the new column/constraint names and
   row counts are unchanged, then `migration:raw:revert` and confirm everything is back to
   the original Spanish names with the same row counts.

**Commit**: `feat(scraping-raw): rename Spanish raw-scrape columns to English`

---

## Milestone 2 — Banner raw entities and repositories (AC-3)

### Task 2.1 — Rename Banner raw entity properties and repository identifiers ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/banner/raw/model/scrape-run.entity.ts` (modify)
- `src/modules/admin/banner/raw/model/raw-horario.entity.ts` (modify)
- `src/modules/admin/banner/raw/model/raw-matricula.entity.ts` (modify)
- `src/modules/admin/banner/raw/model/raw-alumno.entity.ts` (modify)
- `src/modules/admin/banner/raw/model/raw-notas.entity.ts` (modify)
- `src/modules/admin/banner/raw/core/scrape-run.repository.ts` (modify)
- `src/modules/admin/banner/raw/core/raw-horario.repository.ts` (modify)
- `src/modules/admin/banner/raw/core/raw-matricula.repository.ts` (modify)
- `src/modules/admin/banner/raw/core/raw-alumno.repository.ts` (modify)
- `src/modules/admin/banner/raw/core/raw-notas.repository.ts` (modify)
- any existing `.spec.ts` for the above (modify — mechanical rename of fixtures/assertions)

**Steps (TDD)**

1. Run the existing suite for this directory first to capture the pre-rename baseline:
   `npx jest --no-coverage src/modules/admin/banner/raw` → expect **green** (baseline).
2. Rename entity properties and `@Unique(...)` TS-property arrays per design.md § AC-1/AC-3.
3. Rename `Insert` interface fields and any Spanish-named repository method
   params/locals in each `core/*.repository.ts`.
4. Update the corresponding `.spec.ts` fixtures/assertions to the new names — same
   assertions, renamed identifiers only (per AC-7, anything more is a signal something else
   changed).
5. `npx jest --no-coverage src/modules/admin/banner/raw` → expect **green** again.
6. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `refactor(banner-raw): rename Spanish entity and repository identifiers to English`

---

## Milestone 3 — Banner scraper service and DTOs (AC-3, AC-5)

### Task 3.1 — Rename Banner scraper service identifiers ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify)
- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (modify)

**Steps (TDD)**

1. `npx jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts` →
   expect **green** (baseline).
2. Rename every Spanish local/parameter (`nivel`→`level`, `periodo`→`period`,
   `departamentos`→`departments`, `departamento`→`department`, `codigoAlumno`→`studentCode`,
   `cursoCodigo`→`courseCode`) and the `RunSummary` interface fields, per design.md § AC-3.
   Leave `nrc` and every `payload.<field>`/`section.materia.codigo`/`numeroCurso`/
   `listaAlumnos` access untouched (Non-goals).
3. Update the spec's fixtures/mocks (e.g. the `listRuns` test's `nivel`/`periodo`/
   `departamentos`/`codigoAlumno` fixture keys) to match.
4. `npx jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts` →
   expect **green**.

**Commit**: `refactor(banner-scraper): rename Spanish service identifiers to English`

### Task 3.2 — Rename Banner scraper DTO fields ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/model/scraper.dtos.ts` (modify)
- `src/modules/admin/banner/scraper/api/scraper.controller.ts` (modify, if the DTO rename
  cascades into any destructuring here)

**Steps**

1. Rename `RunScrapeDto.nivel`→`.level`, `.departamentos`→`.departments`; rename
   `RunSummaryResponseDto`'s matching fields, keeping decorators (`@IsOptional`, etc.)
   attached to the renamed property.
2. `pnpm exec tsc --noEmit -p tsconfig.build.json` (DTOs have no dedicated spec in this
   module today — the controller/service specs already exercise them end-to-end via
   Milestone 3.1/Milestone 8).

**Commit**: `refactor(banner-scraper): rename Spanish DTO field names to English`

---

## Milestone 4 — Planner raw entities and repositories (AC-3)

### Task 4.1 — Rename Planner raw entity properties and repository identifiers ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/planner/raw/model/planner-scrape-run.entity.ts` (modify)
- `src/modules/admin/planner/raw/model/raw-planner-seccion.entity.ts` (modify)
- `src/modules/admin/planner/raw/core/planner-scrape-run.repository.ts` (modify)
- `src/modules/admin/planner/raw/core/raw-planner-seccion.repository.ts` (modify)
- any existing `.spec.ts` for the above (modify)

**Steps (TDD)**

1. `npx jest --no-coverage src/modules/admin/planner/raw` → expect **green** (baseline).
2. Rename `periodo`→`period` (both entities), `escuela`→`school`
   (`planner-scrape-run.entity.ts` only) and matching `Insert`/repository identifiers
   (`findByPeriodo`→`findByPeriod`, etc.). `raw-planner-evaluacion.entity.ts` and
   `raw-planner-nota.entity.ts` are already English — confirm untouched.
3. Update `.spec.ts` fixtures/assertions to match.
4. `npx jest --no-coverage src/modules/admin/planner/raw` → expect **green**.
5. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `refactor(planner-raw): rename Spanish entity and repository identifiers to English`

---

## Milestone 5 — Planner scraper service and DTOs (AC-3, AC-5)

### Task 5.1 — Rename Planner scraper service identifiers ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (modify)

**Steps (TDD)**

1. `npx jest --no-coverage src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts`
   → expect **green** (baseline).
2. Rename `periodo`→`period`, `escuela`→`school`, `cursos`→`courses`, `curso`→`course`, and
   the `PlannerRunSummary` interface fields, per design.md § AC-3. `sectionId`,
   `evalComponentId`, `componentId`, `studentCode` are already English — leave untouched.
3. Update the spec's fixtures/mocks to match.
4. `npx jest --no-coverage src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts`
   → expect **green**.

**Commit**: `refactor(planner-scraper): rename Spanish service identifiers to English`

### Task 5.2 — Rename Planner scraper DTO fields ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/planner/scraper/model/planner-scraper.dtos.ts` (modify)
- `src/modules/admin/planner/scraper/api/planner-scraper.controller.ts` (modify, if needed)

**Steps**

1. Rename `RunPlannerScrapeDto.nivel`→`.level`, `.cursos`→`.courses`; rename
   `PlannerRunSummaryResponseDto`'s matching fields.
2. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `refactor(planner-scraper): rename Spanish DTO field names to English`

---

## Milestone 6 — English `ScraperPhase` / `PlannerScraperPhase` values (AC-6)

`1787270797549-add-phase-to-scrape-runs.ts` (`scrape-progress-and-performance`) is **already
applied on `develop`** (`git log develop -- src/database/migrations-raw/
1787270797549-add-phase-to-scrape-runs.ts` → commit `8f429715`, PR #121; archived at
`openspec/specs/scrape-progress-and-performance/`) — this corrects the original proposal's
assumption that it was still unmerged. It is **not** edited in place; Task 6.1 below is a new
forward-only migration instead.

### Task 6.1 — New migration: rename phase CHECK-constraint values, backfill any in-flight row

- [ ] Task complete (code written and verified against design.md; manual `migration:raw:run`/`revert`-with-seeded-row step below not yet run — no raw DB connection available in this session, same constraint as Task 1.1)

> `pnpm migration:raw:create` produced `src/database/migrations-raw/1787346520613-rename-scrape-phase-literals.ts`, created after Task 1.1's file so its timestamp (1787346520613) sorts later. `up()`/`down()` follow the drop-constraint → backfill → add-constraint order for both `scrape_run` and `planner_scrape_run`, matching design.md § AC-6 exactly. `ScraperPhase`/`PlannerScraperPhase` renamed in the same pass (verified — see Task 6.2). Precondition re-checked directly: `git log develop -- src/database/migrations-raw/1787270797549-add-phase-to-scrape-runs.ts` still returns only commit `8f429715` — no new commits landed on that file since design. `tsc --noEmit` after this task surfaced exactly the call-site errors Task 6.2 expected (in `admin/banner/scraper/**`/`admin/planner/scraper/**` only), confirming nothing else referenced the old literals. Manual apply/revert-with-seeded-row verification is a `runbook.md` step, not run here — per this file's own completion rule for Tasks 1.1/6.1, left unchecked rather than marked done on code-review alone.

**Files**

- `src/database/migrations-raw/<timestamp>-rename-scrape-phase-literals.ts` (create, via CLI — created _after_ Task 1.1's migration exists, so its timestamp sorts later)
- `src/modules/admin/banner/raw/model/scrape-run.entity.ts` (modify — `ScraperPhase` type)
- `src/modules/admin/planner/raw/model/planner-scrape-run.entity.ts` (modify — `PlannerScraperPhase` type)

**Steps**

1. `pnpm migration:raw:create src/database/migrations/rename-scrape-phase-literals` (run
   this after Task 1.1's migration file already exists in the repo).
2. Implement `up()`, in this order (per design.md § AC-6 — order matters, a row with a
   backfilled value that hasn't landed yet cannot pass a constraint already renamed):
   drop `CK_scrape_run_phase` → `UPDATE scrape_run SET phase = ...` (Spanish→English per
   design.md's table, `WHERE phase IS NOT NULL`) → add `CK_scrape_run_phase` with the new
   `IN (...)` list; repeat the same three steps for `planner_scrape_run`/
   `CK_planner_scrape_run_phase`.
3. Implement `down()` as the exact inverse (drop new constraint → `UPDATE` back to Spanish →
   add old constraint back), for both tables.
4. Rename the CHECK constraint values used above and both TS union types
   (`ScraperPhase`/`PlannerScraperPhase`) to match design.md § AC-6's table
   (`'horario'`→`'schedule'`, `'matricula'`→`'enrollment'`, `'alumnosYNotas'`→
   `'studentsAndGrades'`, `'secciones'`→`'sections'`, `'evaluaciones'`→`'evaluations'`,
   `'notas'`→`'grades'`).
5. Manual verification (see `runbook.md`): on a local/staging copy of the raw DB, manually
   set one `scrape_run` row's `phase` to `'horario'` (simulating an in-flight run at
   migration time). Run `migration:raw:run`, confirm that row's `phase` is now `'schedule'`
   and the new constraint is in place. Run `migration:raw:revert`, confirm it's back to
   `'horario'` under the old constraint.
6. `pnpm exec tsc --noEmit -p tsconfig.build.json` — every call site that references the old
   literals fails to compile until fixed; that is the mechanism catching every call site
   (Task 6.2 fixes what this surfaces).

**Commit**: `feat(scraping-raw): rename scrape phase literals to English`

### Task 6.2 — Update every phase call site and its test assertions ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify — `updatePhase(...)` calls)
- `src/modules/admin/banner/scraper/model/scraper.dtos.ts` (modify — `SCRAPER_PHASE_VALUES`, `ScrapeRunStatusResponseDto`/`RunSummaryResponseDto` enum/example)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify — `updatePhase(...)` calls)
- `src/modules/admin/planner/scraper/model/planner-scraper.dtos.ts` (modify — Planner phase enum/example)
- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (modify — phase-tracking assertions)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (modify — phase-tracking assertions)

**Steps (TDD)**

1. `npx jest --no-coverage src/modules/admin/banner/scraper src/modules/admin/planner/scraper`
   → expect **red** (Task 6.1 broke these on purpose).
2. Update every `updatePhase('horario' | ...)` call site and every DTO enum/example/default
   to the new literals.
3. Update the phase-tracking spec assertions (e.g. "includes phase in each run summary",
   the `execute phase tracking` describe blocks) to expect the new literals.
4. `npx jest --no-coverage src/modules/admin/banner/scraper src/modules/admin/planner/scraper`
   → expect **green**.

**Commit**: `refactor(scraping): update phase call sites for renamed English literals`

---

## Milestone 7 — `scraping-exports` raw SQL (AC-4)

### Task 7.1 — Update raw SQL column references and their structural assertions ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/scraping-exports/core/scraping-exports.repository.ts` (modify)
- `src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts` (modify)
- `src/modules/admin/scraping-exports/core/scraping-exports.repository.spec.ts` (modify)
- `src/modules/admin/scraping-exports/core/grades-rc-export.repository.spec.ts` (modify)

**Steps (TDD)**

1. `npx jest --no-coverage src/modules/admin/scraping-exports/core` → expect **green**
   (baseline — these tests mock `dataSource.query`, so they check SQL _structure_, not
   result correctness; that gap is why Task 7.2 exists).
2. Rewrite every renamed column reference in the two SQL files: `periodo`→`period`,
   `codigo_alumno`→`student_code`, `curso_codigo`→`course_code` (design.md § AC-4 has the
   grep-confirmed line list — recheck with a fresh grep, since Milestones 2–5 may have
   shifted line numbers).
3. Update the spec files' string-structure assertions (e.g.
   `MATERIALIZE_GRADES_RC_SQL.split('banner_grades AS')`) to remain valid against the
   renamed SQL — same assertions, new column names only.
4. `npx jest --no-coverage src/modules/admin/scraping-exports/core` → expect **green**.
5. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `refactor(scraping-exports): rename raw SQL column references to English`

### Task 7.2 — Staging output-correctness verification (manual, see runbook.md)

- [ ] Task complete (not run — no staging environment reachable from this session; see runbook.md)

**Files**

- none (verification-only task; no code changes)

**Steps**

1. Follow `runbook.md` § "Verifying scraping-exports output correctness": on staging, with
   the same completed scrape run, generate all five export types
   (Docentes, Secciones, Alumnos Matriculados, Alumnos-Secciones, Grades RC) before Task 7.1
   deploys and again after, and diff the generated files.
2. Record the result (pass/fail, and the diff if any) in this task's completion note.

**Commit**: none (no code change — mark complete once the manual check has actually run and
passed; this task exists so AC-4's actual acceptance criterion, not just Task 7.1's unit
tests, is checked off before the PR is considered done)

---

## Milestone 8 — `triggeredByName` (AC-8)

### Task 8.1 — `UserRepository.findDisplayNamesByIds` and export from `UserModule` ✅ DONE (2026-08-21)

- [x] Task complete

> Created `src/modules/organization/users/core/users.repository.spec.ts` (no prior spec existed for this repository). 3 cases: empty input short-circuits without querying, found ids map to `"firstName lastName"`, not-found ids are simply absent from the map. `UserRepository` added to `UserModule`'s `exports`.

**Files**

- `src/modules/organization/users/core/users.repository.ts` (modify)
- `src/modules/organization/users/core/users.repository.spec.ts` (modify, or create if it
  doesn't already cover repository methods directly — check first)
- `src/modules/organization/users/users.module.ts` (modify — add `UserRepository` to `exports`)

**Steps (TDD)**

1. Write a failing test for `findDisplayNamesByIds`: given `userIds`, calls
   `findByCondition` with `{ where: { id: In(userIds) }, select: [...] }` and returns a
   `Map<id, "firstName lastName">`; given `[]`, returns an empty `Map` without calling
   `findByCondition` at all. `npx jest --no-coverage
src/modules/organization/users/core/users.repository.spec.ts` → expect **red**.
2. Implement `findDisplayNamesByIds` per design.md § AC-8.
3. Add `UserRepository` to `UserModule`'s `exports` array.
4. `npx jest --no-coverage src/modules/organization/users/core/users.repository.spec.ts` →
   expect **green**.

**Commit**: `feat(users): add findDisplayNamesByIds for cross-module triggeredBy resolution`

### Task 8.2 — Wire `triggeredByName` into Banner's `listRuns` ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/banner/scraper/scraper.module.ts` (modify — import `UserModule`)
- `src/modules/admin/banner/scraper/api/scraper.service.ts` (modify — inject `UserRepository`, update `listRuns`, add `parseUserId`)
- `src/modules/admin/banner/scraper/model/scraper.dtos.ts` (modify — add `triggeredByName` to `RunSummaryResponseDto`)
- `src/modules/admin/banner/scraper/api/scraper.service.spec.ts` (modify — new `buildService()` mock param, new `listRuns` cases)

**Steps (TDD)**

1. Add `mockUserRepository = { findDisplayNamesByIds: jest.fn() }` to the spec and thread it
   into `buildService()`. Write three new failing cases under `ScraperService.listRuns`:
   resolves a known `triggeredBy` to the mocked name; falls back to `'-'` when
   `findDisplayNamesByIds` doesn't have that id; falls back to `'-'` when `triggeredBy` is
   `null`. `npx jest --no-coverage
src/modules/admin/banner/scraper/api/scraper.service.spec.ts` → expect **red** on the
   three new cases (constructor arity will also fail every existing case until step 2).
2. Implement per design.md § AC-8: constructor takes `UserRepository`; `listRuns` batches
   the lookup and maps `triggeredByName`; add the module-scope `parseUserId` helper.
3. Add `triggeredByName: string` to `RunSummaryResponseDto` (`@ApiProperty`, not optional).
4. Import `UserModule` into `ScraperModule`.
5. `npx jest --no-coverage src/modules/admin/banner/scraper/api/scraper.service.spec.ts` →
   expect **green**.

**Commit**: `feat(banner-scraper): resolve triggeredBy to a display name`

### Task 8.3 — Wire `triggeredByName` into Planner's `listRuns` ✅ DONE (2026-08-21)

- [x] Task complete

**Files**

- `src/modules/admin/planner/scraper/planner-scraper.module.ts` (modify — import `UserModule`)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.ts` (modify — inject `UserRepository`, update `listRuns`, add `parseUserId`)
- `src/modules/admin/planner/scraper/model/planner-scraper.dtos.ts` (modify — add `triggeredByName` to `PlannerRunSummaryResponseDto`)
- `src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` (modify — same shape of new cases as Task 8.2)

**Steps (TDD)**

1. Mirror Task 8.2 step 1 for `PlannerScraperService.listRuns`.
2. Mirror Task 8.2 step 2 for `PlannerScraperService`.
3. Add `triggeredByName: string` to `PlannerRunSummaryResponseDto`.
4. Import `UserModule` into `PlannerScraperModule`.
5. `npx jest --no-coverage
src/modules/admin/planner/scraper/api/planner-scraper.service.spec.ts` → expect **green**.

**Commit**: `feat(planner-scraper): resolve triggeredBy to a display name`

---

## Milestone 9 — Close-out (AC-5, AC-7)

### Task 9.1 — Regenerate `openapi.json` and run the full affected-module suite ✅ DONE (2026-08-21)

- [x] Task complete

> Full affected-module suite (`admin/banner`, `admin/planner`, `admin/scraping-exports`,
> `organization/users`): 23 suites, 348 passed, 2 pre-existing skips. Full repo suite (all
> 133 suites): 1308 passed, 2 skips, 0 failures — no collateral damage outside the touched
> modules. `pnpm openapi:export` regenerated `openapi.json`: `RunScrapeDto`/
> `RunSummaryResponseDto`/`RunPlannerScrapeDto`/`PlannerRunSummaryResponseDto` show only
> English field names, `phase` enums show the renamed literals, and `triggeredByName`
> appears (required, non-nullable) on both run-summary schemas — verified by reading the
> generated schemas directly, not just diff size. `docs/CONTEXT.md` § Business Rules'
> retention and `phase` bullets updated to the renamed identifiers/literals. `pnpm lint` and
> `pnpm format` both clean. A few stray Spanish words in code comments (not identifiers) were
> also caught by a final grep sweep and fixed for consistency, outside this task's own file
> list: `scraper.service.ts`'s `finalizeRun`/`NotaPair` docblocks.

**Files**

- `openapi.json` (modify — generated)
- `docs/CONTEXT.md` (modify — § Business Rules, per design.md § Docs to update)

**Steps**

1. `npx jest --no-coverage src/modules/admin/banner src/modules/admin/planner
src/modules/admin/scraping-exports src/modules/organization/users` → expect **green**
   (AC-7 — the full affected-module suite, not just the individual files touched above).
2. `pnpm openapi:export` and review the diff: confirm no Spanish field names remain on any
   of the four DTOs, and `triggeredByName` appears on both run-summary schemas.
3. Update `docs/CONTEXT.md` § Business Rules per design.md's two flagged bullets (retention,
   `phase`) to use the renamed English identifiers and phase literals.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json` (final full check across everything
   touched by this change).

**Commit**: `chore(scraping): regenerate openapi.json and update CONTEXT.md for renamed identifiers`

---

## Unplanned — `scraping-export-generation.service.ts` also called the renamed repository methods

Neither `design.md` nor this file's own task list listed
`src/modules/admin/scraping-exports/api/scraping-export-generation.service.ts` as a file to
touch — but it calls `ScrapeRunRepository.findByPeriodo`/`PlannerScrapeRunRepository
.findByPeriodo` (4 call sites) directly, which Task 2.1/4.1 renamed to `findByPeriod`. Caught
by `tsc --noEmit` after Milestone 2/4 landed, before Milestone 3/5 started.

### Task U.1 — Rename the 4 `findByPeriodo` call sites in `scraping-export-generation.service.ts` ✅ DONE (2026-08-21)

- [x] Task complete

> Mechanical only: the 4 method-call names (`findByPeriodo` → `findByPeriod`), nothing else —
> this file's own `periodo` local variables/params stay as-is, since they refer to
> `core.scraping_export_runs.periodo` (main datasource), a column this change does not touch
> (out of scope per proposal.md's Goals table, which lists only the seven raw-datasource
> tables). Also updated the matching 12 mock-call-site references in
> `scraping-export-generation.service.spec.ts`. `npx jest --no-coverage
src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts` → 30
> passed.

**Files**

- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.ts` (modify)
- `src/modules/admin/scraping-exports/api/scraping-export-generation.service.spec.ts` (modify)

**Commit**: `fix(scraping-exports): update findByPeriod call sites after the raw-repository rename`

<!--
Append-only sections below. These record what actually happened, not what was planned,
and they are the best input to the next design.

## Post-QA fixes

## Audit fixes (/abet-audit-pr)

### Review round 1
-->
