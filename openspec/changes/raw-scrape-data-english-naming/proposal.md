# Rename Spanish Raw-Scrape Identifiers to English

**Slug**: `raw-scrape-data-english-naming`
**Branch**: `feat/raw-scrape-data-english-naming`
**Repos affected**: both (backend renames its own columns/code/wire fields here; frontend
consumes the renamed wire fields in a paired change)
**Created**: 2026-08-20

## Problem

`docs/POLICIES.md` § Language Rules is unambiguous: "All code, comments, variable names,
error keys, commit messages, and documentation must be in English," with the only carve-out
being i18n seed values and JSONB display strings. The raw scraping datasource — the tables
Banner's and Planner's scrapers write to, and the columns/TypeScript identifiers that mirror
them — does not follow this: `nivel`, `periodo`, `departamento(s)`, `codigoAlumno`,
`cursoCodigo`, `escuela` appear as DB columns, entity properties, repository method
parameters, service-layer local variables, and — in four places — our own public request/
response DTO field names. A developer working in this area has to context-switch between
Spanish domain terms and the English convention used everywhere else in the codebase, and our
own API surface exposes Spanish field names to the frontend even though nothing about Banner's
or Planner's actual external contract requires that (those systems' query parameters are
already handled separately — see Non-goals). This is a straightforward compliance gap against
the team's own written rulebook, not a judgment call about whether English naming is correct.

## What already exists

Read-only inventory (no code changed to produce this list) across every module that touches
these raw tables:

**Banner raw** (`src/modules/admin/banner/raw/`) — `scrape-run.entity.ts`
(`nivel`, `periodo`, `departamentos: string[]`), `raw-horario.entity.ts` (`nivel`, `periodo`,
`departamento`), `raw-matricula.entity.ts` (`nivel`, `periodo`, `codigoAlumno`),
`raw-alumno.entity.ts` (`nivel`, `codigoAlumno`), `raw-notas.entity.ts` (`nivel`, `periodo`,
`codigoAlumno`, `cursoCodigo`) — plus the matching `Insert` interfaces and method parameters in
each entity's `core/*.repository.ts`, and the `@Unique(...)` constraint arrays that reference
these TS property names.

**Banner scraper** (`src/modules/admin/banner/scraper/`) — `scraper.service.ts` uses `nivel`,
`periodo`, `departamentos`, `departamento`, `codigoAlumno`, `cursoCodigo` as local
variables/params throughout `run()`/`execute()`/`scrapeHorario`/`scrapeMatricula`/
`scrapeAlumnos`/`scrapeNotas`, and in the `Enrollment`/`NotaPair`/`RunSummary` interfaces.
`scraper.dtos.ts` carries this onto the wire: `RunScrapeDto.nivel?`/`.departamentos?` (request
body) and `RunSummaryResponseDto.nivel`/`.periodo`/`.departamentos` (response, added by the
just-landed `scrape-progress-and-performance` change).

**Planner raw** (`src/modules/admin/planner/raw/`) — `planner-scrape-run.entity.ts` (`periodo`,
`escuela`), `raw-planner-seccion.entity.ts` (`periodo` only). `raw-planner-evaluacion.entity.ts`
and `raw-planner-nota.entity.ts` are already fully English (`sectionId`, `evalComponentId`,
`componentId`, `studentCode`) — no action needed there.

**Planner scraper** (`src/modules/admin/planner/scraper/`) — `planner-scraper.service.ts` uses
`periodo`, `escuela`, `cursos`, `curso` as locals/params and in `PlannerRunSummary`.
`planner-scraper.dtos.ts` carries this onto the wire: `RunPlannerScrapeDto.nivel?`/`.cursos?`
and `PlannerRunSummaryResponseDto.periodo`/`.escuela` (also added by
`scrape-progress-and-performance`).

**`admin/scraping-exports`** — the largest, previously-underestimated consumer. Two files
build raw SQL directly against the Spanish snake_case column names:
`core/scraping-exports.repository.ts` (`RUN_FOR_PERIOD` CTE filters `periodo = $1`, joins read
`raw_alumno.codigo_alumno`, `raw_matricula.codigo_alumno`, `raw_matricula.nrc`/
`raw_horario.nrc`) and, far more extensively, `core/grades-rc-export.sql.ts` (~580 lines, two
`RUN_FOR_PERIOD`-style CTEs plus dozens of references to `raw_notas.codigo_alumno`/
`.curso_codigo`, `raw_matricula.codigo_alumno`, `raw_alumno.codigo_alumno`,
`raw_planner_seccion.section_id`, `raw_planner_evaluacion.section_id`/`.eval_component_id`,
`raw_planner_nota.student_code`/`.component_id`/`.section_id`). None of this is type-checked —
a rename that misses one of these raw SQL string references fails only at query time.

**Correction, confirmed against `develop` at design time**: `scrape-progress-and-performance`
(the change that added `ScraperPhase = 'horario' | 'matricula' | 'alumnosYNotas'` and
`PlannerScraperPhase = 'secciones' | 'evaluaciones' | 'notas'`) has already merged —
`git log develop -- src/database/migrations-raw/1787270797549-add-phase-to-scrape-runs.ts`
returns commit `8f429715` (PR #121), and its change folder is archived at
`openspec/specs/scrape-progress-and-performance/`, not `openspec/changes/`. The migration
that added `CK_scrape_run_phase`/`CK_planner_scrape_run_phase` has therefore already run
against real databases. Renaming these Spanish union-literal/CHECK-constraint values is still
in scope (same rule, `docs/POLICIES.md` § Language Rules applies to them exactly as it does
to a property name), but it can no longer be a plain edit to that migration file —
`docs/POLICIES.md` § Migrations is explicit that an already-applied migration is never edited
in place. It requires its own new, forward-only migration that both alters the CHECK
constraints and back-fills any existing `phase` value on a currently-`running` row (a `phase`
column is cleared to `null` on every terminal run by `finish()`, per
`docs/CONTEXT.md` § Business Rules, so only in-flight runs at migration time can hold a
non-null value — but the migration must handle that case correctly, not assume it's always
empty). See design.md § AC-6 for the corrected approach.

**Correction, found after the rename's first pass shipped**: `core.scraping_export_runs`
(main datasource, `admin/scraping-exports/model/scraping-export-run.entity.ts`) also has a
Spanish column, `periodo` — missed in the original inventory above because it isn't a raw
Banner/Planner table, it's this feature's own persisted generation state (see ADR-002). This
is squarely the same violation the rest of this proposal targets (our own column, not
external payload), not the "~40 unrelated files" class of gap in Non-goals below — it was
simply not found until an audit of the first implementation pass flagged it. In scope: the
column itself, `ScrapingExportRunEntity.periodo`, its `@Unique(...)` constraint,
`ScrapingExportStatusResponse`/`ScrapingExportStatusResponseDto.periodo` (a wire-facing
field the frontend's export-download screen already consumes), `ScrapingExportRunRepository`'s
`periodo` parameters and `conflictPaths`, and `ScrapingExportsRepository.resolvePeriodoCode`/
`ScrapingExportGenerationService.resolvePeriodo`'s naming. See AC-9.

**Confirmed out of scope, correctly untouched today**: the `nrc` field (Banner's own domain
term, not a translation gap), JSONB `payload` column contents (`section.materia.codigo`,
`section.numeroCurso`, `alumno.apellidos`, etc. — verbatim external data), and the query
parameter keys/URL path segments Banner's and Planner's HTTP clients send to the external APIs
(`codigoNivel`, `codigoPeriodo`, `codigoDepartamento`, the `/notas/{codigoAlumno}/...` path) —
those are the external systems' own contract, not ours to rename.

**Also found, explicitly not pursued here**: broad greps for `periodo`/`escuela` also hit
~40 unrelated files — spot-checked, and those are Spanish text inside Swagger `summary`
strings and seed-data comments across `evidence/ifcs`, `academic/academic-periods`,
`organization/charts`, `organization/schools`, etc. That is a real, separate
`docs/POLICIES.md` gap (Spanish in API documentation strings), but it is a different, much
broader problem than renaming raw-datasource identifiers and does not belong in this change.

**Also found while cross-checking the wire shape against the committed `openapi.json`**
(both `RunScrapeDto`/`RunSummaryResponseDto` and their Planner equivalents match the current
code exactly — no drift): `RunSummaryResponseDto.triggeredBy` and
`PlannerRunSummaryResponseDto.triggeredBy` already expose only the raw internal reference
written by `ScraperController`/`PlannerScraperController` (`` `user:${user.userId}` ``, e.g.
`"user:12"`), nullable, with no human-readable name — the frontend would have to resolve that
itself, and cannot, since it has no direct access to `organization.users`. Both DTOs are already in scope for this change (AC-5), and `organization.users`' owning
module (`src/modules/organization/users/`) is a straightforward same-repo dependency for
`ScraperService.listRuns`/`PlannerScraperService.listRuns` to resolve against, so doing this
alongside the rename avoids a second breaking-adjacent change to the same two response shapes
shortly after this one ships.

## Goals

- Every DB column, TypeORM entity property, repository/service parameter and local variable
  in the raw datasource that is currently a Spanish word is renamed to its English equivalent,
  via a migration for the columns and a mechanical rename for the TypeScript:

  | Spanish                          | English                        | Where                                                 |
  | -------------------------------- | ------------------------------ | ----------------------------------------------------- |
  | `nivel`                          | `level`                        | Banner raw entities, `scraper.service.ts`, DTOs       |
  | `periodo`                        | `period`                       | Banner + Planner raw entities, both services, DTOs    |
  | `departamento` / `departamentos` | `department` / `departments`   | Banner raw, `scraper.service.ts`, DTOs                |
  | `codigoAlumno` / `codigo_alumno` | `studentCode` / `student_code` | Banner raw entities, `scraping-exports` raw SQL       |
  | `cursoCodigo` / `curso_codigo`   | `courseCode` / `course_code`   | `raw-notas.entity.ts`, `grades-rc-export.sql.ts`      |
  | `escuela`                        | `school`                       | Planner raw entity, `planner-scraper.service.ts`, DTO |
  | `cursos`                         | `courses`                      | `RunPlannerScrapeDto`, `planner-scraper.service.ts`   |

  (Final names are confirmed, not re-litigated, in design — this table is the proposed mapping
  the ACs below are written against.)

- `admin/scraping-exports`' raw SQL (`scraping-exports.repository.ts`,
  `grades-rc-export.sql.ts`, `grades-rc-export.repository.ts`) is updated to reference the
  renamed columns, and every export type it generates (Docentes, Secciones, Alumnos
  Matriculados, Alumnos-Secciones, Grades RC) is verified to still produce correct output.
- `ScraperPhase`/`PlannerScraperPhase`'s Spanish literal values are renamed to English
  (e.g. `'horario'` → `'schedule'`) before this reaches `develop`, since the migration that
  introduces them has not shipped past this branch yet.
- Our own request/response DTOs (`RunScrapeDto`, `RunSummaryResponseDto`,
  `RunPlannerScrapeDto`, `PlannerRunSummaryResponseDto`) expose only English field names, and
  `openapi.json` is regenerated in the same PR to reflect the new wire shape.
- `RunSummaryResponseDto`/`PlannerRunSummaryResponseDto` gain a `triggeredByName` field: the
  run's `triggeredBy` reference (`` `user:${userId}` ``) resolved against
  `organization.users` to a display name (`` `${firstName} ${lastName}` ``), falling back to
  the literal placeholder `'-'` when `triggeredBy` is null, malformed, or the user no longer
  exists. Additive to the existing `triggeredBy` field — not a replacement, and not itself a
  breaking change (unlike the field renames above, this needs no dual-support window).
- Every existing test in the affected modules passes after the rename with only mechanical
  identifier updates — this is a naming change, not a behavior change, and the ACs below treat
  any test needing more than a rename to stay green as a signal something was misunderstood.
- `core.scraping_export_runs.periodo` (main datasource) is renamed to `period`, via its own
  new migration — column, entity property, `@Unique(...)` constraint,
  `ScrapingExportStatusResponse`/`ScrapingExportStatusResponseDto.periodo`,
  `ScrapingExportRunRepository`'s `periodo` params/`conflictPaths`, and the
  `resolvePeriodoCode`/`resolvePeriodo` method names across `ScrapingExportsRepository`/
  `ScrapingExportGenerationService`/`ScrapingExportsController`. Same no-compatibility-shim
  rule as the rest of this proposal; `openapi.json` regenerated in the same PR.

## Non-goals

- **Not renaming the raw table names themselves** (`raw_horario`, `raw_matricula`,
  `raw_notas`, `raw_planner_seccion`, `raw_planner_evaluacion`, `raw_planner_nota`) or the
  entity/file/class names that mirror them. The request that started this change specifically
  said "column names"; renaming tables is a larger, separable, higher-risk change (cascades
  through every migration's FK definitions, every raw SQL `FROM` clause, and every file name
  in these two modules) that can follow as its own proposal if wanted. This does leave a real
  inconsistency — English columns inside Spanish-named tables — flagged here rather than
  silently decided; see Open questions.
- Not touching `nrc`, JSONB payload content, or the external Banner/Planner API's own query
  parameter keys/paths — see "What already exists" above for the full confirmed list.
- Not touching the ~40 unrelated files carrying Spanish text in Swagger `summary` strings and
  seed comments outside the raw scrape datasource — a real but separate, much broader
  `docs/POLICIES.md` gap.
- Not introducing a transitional/dual-name compatibility layer (e.g. a DB view aliasing old to
  new column names, or DTOs accepting both spellings). `docs/POLICIES.md` § Don'ts rules out
  backwards-compatibility shims when the code can simply be changed instead, and the raw
  datasource is retention-limited (latest-completed-run-only per period per existing business
  rules), so there is no long-lived data that a phased rollout would need to bridge.

## Acceptance criteria

1. **AC-1** — Given the raw-datasource migration in this change runs, when it completes, then
   every column listed in Goals is renamed (`ALTER TABLE ... RENAME COLUMN`, not drop-and-
   recreate) across `scrape_run`, `raw_horario`, `raw_matricula`, `raw_alumno`, `raw_notas`,
   `planner_scrape_run`, `raw_planner_seccion`, and existing row data is preserved unchanged.
2. **AC-2** — Given the migration in AC-1, when `down()` runs against a database that has it
   applied, then every column is renamed back to its original Spanish name and no data is
   lost.
3. **AC-3** — Given the TypeScript rename, when the Banner and Planner raw entities,
   repositories, and scraper services are read, then no Spanish identifier from the Goals
   table remains as a property name, parameter name, or local variable name in those files
   (the `nrc` field and JSONB payload field accesses are explicitly exempt, per Non-goals).
4. **AC-4** — Given `admin/scraping-exports`' raw SQL, when `scraping-exports.repository.ts`
   and `grades-rc-export.sql.ts` are updated for the renamed columns, then every export type
   (Docentes, Secciones, Alumnos Matriculados, Alumnos-Secciones, Grades RC) is generated
   against a real or fixture dataset and produces output identical in content to what it
   produced before the rename — this is checked explicitly because none of this SQL is
   type-checked, so a missed reference fails only at query time, not at build time.
5. **AC-5** — Given `RunScrapeDto`, `RunSummaryResponseDto`, `RunPlannerScrapeDto`, and
   `PlannerRunSummaryResponseDto`, when their fields are read, then every field name is
   English, and `openapi.json` is regenerated in the same PR showing only the new field names
   (no dual old/new fields, per the Non-goals decision against a compatibility layer).
6. **AC-6** — Given `ScraperPhase`/`PlannerScraperPhase`, when their union-type values and the
   corresponding `CK_scrape_run_phase`/`CK_planner_scrape_run_phase` CHECK constraints are
   read, then every value is English.
7. **AC-7** — Given the full test suite for the affected modules
   (`admin/banner/**`, `admin/planner/**`, `admin/scraping-exports/**`), when it runs after
   the rename, then every test passes, having required only identifier renames inside the test
   files themselves — no test's assertions or fixtures needed to change in a way that reflects
   a behavior change.
8. **AC-8** — Given `ScraperService.listRuns`/`PlannerScraperService.listRuns`, when a run's
   `triggeredBy` is a well-formed `` `user:<id>` `` reference to a row in
   `organization.users`, then the returned `triggeredByName` is that user's
   `` `${firstName} ${lastName}` ``; when `triggeredBy` is `null`, does not match that
   pattern, or names a user id that no longer exists in `organization.users`, then
   `triggeredByName` is the literal string `'-'`. `triggeredBy` itself is unchanged.
9. **AC-9** — Given `core.scraping_export_runs`, when its migration completes, then the
   `periodo` column is renamed to `period` (`ALTER TABLE ... RENAME COLUMN`, data preserved,
   `down()` reverses cleanly) and every TypeScript reference — `ScrapingExportRunEntity`,
   `ScrapingExportStatusResponse`, `ScrapingExportStatusResponseDto`,
   `ScrapingExportRunRepository`, `ScrapingExportsRepository.resolvePeriodoCode`,
   `ScrapingExportGenerationService.resolvePeriodo`, `ScrapingExportsController` — is renamed
   to match, with `openapi.json` regenerated showing only `period` on
   `ScrapingExportStatusResponseDto`.

### Traceability

| AC  | Criterion                                                                  | Satisfied by |
| --- | -------------------------------------------------------------------------- | ------------ |
| 1   | Raw-datasource columns renamed via migration, data preserved               | TBD          |
| 2   | Migration `down()` reverses cleanly                                        | TBD          |
| 3   | Banner/Planner raw + scraper TS identifiers are English                    | TBD          |
| 4   | `scraping-exports` raw SQL updated, all export types verified correct      | TBD          |
| 5   | Public DTOs are English-only, `openapi.json` regenerated                   | TBD          |
| 6   | `ScraperPhase`/`PlannerScraperPhase` values are English                    | TBD          |
| 7   | Full affected-module test suite green after rename                         | TBD          |
| 8   | `triggeredBy` resolved to a display name, `'-'` fallback when unresolvable | TBD          |
| 9   | `core.scraping_export_runs.periodo` renamed, `openapi.json` regenerated    | TBD          |

## Dependencies

- **`scrape-progress-and-performance` is already merged to `develop`** (confirmed at design
  time: `git log develop -- src/database/migrations-raw/*` shows commit `8f429715`/PR #121,
  and its change folder is archived under `openspec/specs/`, not `openspec/changes/`) — this
  branch is created directly off current `develop`, not stacked on an unmerged branch. This
  corrects an assumption made when this proposal was first written; see "What already exists"
  above and design.md § AC-6 for what it changes: `CK_scrape_run_phase`/
  `CK_planner_scrape_run_phase` are already-applied constraints, so AC-6 needs its own new
  forward-only migration rather than an in-place edit to the migration that created them.
- Two raw-datasource migrations in this change, in a fixed order: Task 1.1's column rename
  first (AC-1/AC-2), then AC-6's phase-literal migration — AC-6's `UPDATE ... SET phase =
CASE ...` and its CHECK constraints reference `scrape_run`/`planner_scrape_run`, the same
  tables Task 1.1 renames columns on, so AC-6 must run against the already-renamed schema.
  The CLI's `Date.now()` timestamp naturally orders them correctly as long as Task 1.1 is
  created first.
- `openapi.json` regeneration and a paired frontend change — sequential cross-repo mode, same
  pattern as `scrape-progress-and-performance` and `scrape-retention-and-cached-exports`: this
  backend PR reaches `staging` before the frontend PR merges. This now also covers the
  `phase` field's renamed values (AC-6), which the frontend already consumes in production
  since `scrape-progress-and-performance` shipped — not just the four DTOs' field names — and
  AC-9's `ScrapingExportStatusResponseDto.periodo`→`.period`, which the export-download screen
  already consumes today.
- Every export type in `admin/scraping-exports` needs a real or fixture-backed way to verify
  output correctness post-rename (AC-4) — confirm what test/fixture infrastructure already
  exists there before design commits to a specific verification method.

## Risks

| Risk                                                                                                                                                                                                                                                                                                                                                                                                         | Impact | Mitigation                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grades-rc-export.sql.ts`'s raw SQL (~580 lines, dozens of column references across ~15 CTEs) is not type-checked — a missed rename fails silently until the query runs.                                                                                                                                                                                                                                     | High   | AC-4 requires verifying every export type's actual output post-rename, not just a successful build; design should specify exactly how (real staging data vs. a fixture dataset).                                                                                                                         |
| This is a genuine breaking wire-format change to four DTOs the frontend already consumes.                                                                                                                                                                                                                                                                                                                    | High   | Sequential cross-repo mode (same as prior changes here) — backend ships and reaches `staging` before the frontend PR merges; no dual-support window is attempted, per the Non-goals decision against a compatibility shim.                                                                               |
| Renaming columns but not tables (Non-goals) leaves `raw_horario`/`raw_matricula`/etc. as Spanish-named tables holding English-named columns — a visible inconsistency for as long as the table-rename follow-up doesn't happen.                                                                                                                                                                              | Medium | Documented explicitly here rather than silently decided; see Open questions.                                                                                                                                                                                                                             |
| AC-6's phase-literal rename now needs a data migration (`UPDATE` on any in-flight run's `phase`), not a plain edit — because `scrape-progress-and-performance` already merged and its migration already ran, unlike this proposal's original assumption. Missing that and editing the applied migration in place would silently no-op on any database that already ran it.                                   | Medium | Corrected in Dependencies and design.md § AC-6 before implementation started; Task 1.1/AC-6 in tasks.md are two separate, correctly-ordered migrations.                                                                                                                                                  |
| A missed rename site in `scraping-exports` (the largest, previously-underestimated consumer) silently breaks an export in a way only visible in the generated file's content, not in logs or a thrown error.                                                                                                                                                                                                 | Medium | Same as the first risk — AC-4's output-correctness check is the actual test for this, not the build passing.                                                                                                                                                                                             |
| `triggeredByName` (AC-8) resolves `organization.users` (main datasource) against a `triggeredBy` value read from `scrape_run`/`planner_scrape_run` (raw datasource) — the two are separate physical Postgres instances, so this is new cross-connection application code, not a SQL join, and has no existing test coverage to extend.                                                                       | Low    | Design specifies the exact lookup (batched by-id, in `listRuns` only) and its unit tests explicitly, including the not-found/malformed/null fallback paths.                                                                                                                                              |
| AC-9's `ScrapingExportRunRepository.upsertByKey`'s `conflictPaths: ['exportType', 'periodo', 'lang']` must be renamed in lockstep with the entity property — TypeORM resolves `conflictPaths` by property name, so a mismatch between the renamed entity and a stale `conflictPaths` array would silently break the upsert's `ON CONFLICT` clause (wrong/no-op conflict target) rather than fail to compile. | Medium | Single-commit rename covering entity, `@Unique(...)`, and `conflictPaths` together; existing repository tests re-run to confirm the upsert path is still exercised.                                                                                                                                      |
| AC-9 was missed in this proposal's original inventory — found only after the first implementation pass shipped and was audited, meaning this proposal's own completeness (per AC-3's spirit: "no Spanish identifier remains") was itself incomplete once.                                                                                                                                                    | Low    | Corrected in the same PR rather than deferred; no evidence of a similar miss elsewhere in `admin/scraping-exports` beyond what AC-9 now covers (checked via a fresh grep across the whole module for `\bperiodo\b`, `\bnivel\b`, `\bdepartamentos?\b`, `\bescuela\b`, `\bcursos\b` before writing AC-9). |

## Open questions

None blocking design — the one deliberately-left-open scoping question (whether the raw table
names themselves should also be renamed as a follow-up) is recorded in Non-goals/Risks rather
than here, since it does not prevent writing testable ACs for the column-only scope agreed
with the requester.
