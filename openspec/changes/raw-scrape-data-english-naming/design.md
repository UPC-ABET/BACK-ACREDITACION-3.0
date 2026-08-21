# Design — Rename Spanish Raw-Scrape Identifiers to English

**Slug**: `raw-scrape-data-english-naming`
**Proposal**: `./proposal.md`

## Read first

- `docs/POLICIES.md` § Language Rules, § Naming Conventions, § Migrations, § Repository
  boundary, § Module Declaration Pattern — the rules this change exists to satisfy.
- `docs/CONTEXT.md` § Database ("Two datasources"), § Business Rules (the retention and
  `phase` bullets — both are written using the Spanish identifiers this change renames, and
  go stale the moment the rename lands; see Docs to update).
- `docs/adr/ADR-002-persisted-pollable-scraping-export-generation.md` — background on
  `scraping_export_runs` and the export-generation pipeline `finalizeRun()` calls into;
  not itself touched, but explains why `triggerExportGeneration` exists in both scraper
  services.
- `openapi.json` (committed, root of repo) — read against the live code for `RunScrapeDto`,
  `RunSummaryResponseDto`, `RunPlannerScrapeDto`, `PlannerRunSummaryResponseDto`: confirmed
  byte-for-byte match with the current DTOs (`node -e` dump of `components.schemas`, see
  below) — no drift to account for going into the rename.
- `src/modules/admin/banner/raw/`, `src/modules/admin/banner/scraper/`,
  `src/modules/admin/planner/raw/`, `src/modules/admin/planner/scraper/`,
  `src/modules/admin/scraping-exports/core/{scraping-exports.repository.ts,
grades-rc-export.sql.ts}` — the code being modified for the rename (AC-1–AC-7).
- `src/modules/organization/users/{model/users.entity.ts, core/users.repository.ts,
api/users.service.ts, users.module.ts}` — the module this change's new AC-8 reads from.
- `src/database/migrations-raw/1787270797549-add-phase-to-scrape-runs.ts` — the migration
  that created `CK_scrape_run_phase`/`CK_planner_scrape_run_phase` with the Spanish values
  AC-6 renames. **Confirmed already applied**: `git log develop --
src/database/migrations-raw/1787270797549-add-phase-to-scrape-runs.ts` returns commit
  `8f429715` (PR #121, `scrape-progress-and-performance`), and that change's folder is
  archived at `openspec/specs/scrape-progress-and-performance/`, not `openspec/changes/` —
  this proposal's original text assumed it was still unmerged, which was wrong by the time
  design started. AC-6 therefore needs its own new forward-only migration, not an in-place
  edit — see AC-6 below.

## Verifying "what we send" (this change's own request)

Read, not called: hitting `POST /banner/scrape` or `POST /planner/scrape` on
`https://accreditation.tcupc.pe` would trigger a real scrape against Banner/Planner (writes
to the raw datasource, real outbound calls to both external systems) — not a safe or
reversible way to "verify," and the endpoint requires an authenticated session this design
pass doesn't have. Verification instead compared the **committed** `openapi.json` schemas
against the current controller/service/DTO code:

- `RunScrapeDto` / `RunPlannerScrapeDto` (the POST body): the code sends exactly what the
  schema documents — `nivel`/`departamentos` (Banner), `nivel`/`cursos` (Planner), both
  optional, both defaulting server-side to "every active department" / "every active course"
  when omitted (`ScraperService.run`/`PlannerScraperService.run`). Nothing is withheld; there
  is no field the service reads from `dto` that isn't declared on the DTO.
- `RunSummaryResponseDto` / `PlannerRunSummaryResponseDto` (the GET list response): every
  field the schema documents is populated from a real column on `ScrapeRunEntity`/
  `PlannerScrapeRunEntity` in `listRuns()` — no gaps, no undocumented extra fields. This is
  also where `triggeredBy`'s actual shape (`"user:12"`, a raw internal reference with no
  display name) was confirmed, which is what AC-8 exists to fix.

No drift found — the rename in this design is against DTOs that already accurately describe
the wire format.

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datastore, broker or cache choice             | No — same two existing Postgres connections (`raw`, main), no new store.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Auth or payments provider                     | No                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Public API contract change or breaking change | Partially — AC-5 renames four DTOs' field names, and AC-6 renames the `phase` field's values (both breaking; AC-6 more so than the proposal originally assumed, now that `scrape-progress-and-performance` has shipped `phase` to production — see AC-6). Not a new decision, though: it is the exact, already-agreed subject of this proposal (Goals/Non-goals settle "no compatibility shim," sequential cross-repo mode), and that decision doesn't change just because AC-6 turned out to affect already-live data instead of pre-merge code. No new ADR — the proposal's Non-goals section is the record of that decision. AC-8's `triggeredByName` is additive, not breaking. |
| New module boundary or cross-repo split       | No — AC-8 imports the already-exported `UserModule`/`UserService` into `ScraperModule`/`PlannerScraperModule` (ordinary same-repo DI composition), not a new module or repo split.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Language, runtime or framework                | No                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Contradicting an existing ADR                 | No                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Conclusion**: no ADR required.

## Approach

### AC-1 — Raw-datasource columns renamed via migration, data preserved

One new migration, created with `pnpm migration:raw:create
src/database/migrations/rename-raw-scrape-spanish-columns` (raw datasource — despite the
`migrations/` path in the command name, `migration:raw:create` and `migration:raw:run` point
at `src/database/typeorm.raw.config.ts`, whose `migrations` glob is
`src/database/migrations-raw/*.ts`; the generated file lands there). Its timestamp is
`Date.now()`-derived, so it necessarily sorts after the already-applied
`1787270797549-add-phase-to-scrape-runs.ts` without any manual ordering, and — since AC-6's
new migration (below) must run after this one, against the renamed columns — create this one
(Task 1.1) before AC-6's, so AC-6's timestamp sorts later still. Pure
`ALTER TABLE ... RENAME COLUMN` statements, one per row below — no
drop/recreate, so existing rows are untouched:

| Table                 | Column rename                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| `scrape_run`          | `nivel`→`level`, `periodo`→`period`, `departamentos`→`departments`                                |
| `raw_horario`         | `nivel`→`level`, `periodo`→`period`, `departamento`→`department`                                  |
| `raw_matricula`       | `nivel`→`level`, `periodo`→`period`, `codigo_alumno`→`student_code`                               |
| `raw_alumno`          | `nivel`→`level`, `codigo_alumno`→`student_code`                                                   |
| `raw_notas`           | `nivel`→`level`, `periodo`→`period`, `codigo_alumno`→`student_code`, `curso_codigo`→`course_code` |
| `planner_scrape_run`  | `periodo`→`period`, `escuela`→`school`                                                            |
| `raw_planner_seccion` | `periodo`→`period`                                                                                |

Four `UNIQUE` constraints reference renamed columns and are renamed alongside them (drop +
re-add under the new name, in the same migration — `RENAME COLUMN` does **not** rename a
constraint that references it, Postgres keeps the old constraint name):

| Constraint      | Old name                                         | New name                                       | New TS property array                    |
| --------------- | ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------- |
| `raw_horario`   | `UQ_raw_horario_run_id_departamento_nrc`         | `UQ_raw_horario_run_id_department_nrc`         | `['runId', 'department', 'nrc']`         |
| `raw_matricula` | `UQ_raw_matricula_run_id_nrc_codigo_alumno`      | `UQ_raw_matricula_run_id_nrc_student_code`     | `['runId', 'nrc', 'studentCode']`        |
| `raw_alumno`    | `UQ_raw_alumno_run_id_codigo_alumno`             | `UQ_raw_alumno_run_id_student_code`            | `['runId', 'studentCode']`               |
| `raw_notas`     | `UQ_raw_notas_run_id_codigo_alumno_curso_codigo` | `UQ_raw_notas_run_id_student_code_course_code` | `['runId', 'studentCode', 'courseCode']` |

`raw_planner_seccion`'s own unique constraint (`UQ_raw_planner_seccion_run_id_section_id`)
doesn't reference `periodo`, so it is untouched.

### AC-2 — Migration `down()` reverses cleanly

Mechanical inverse of AC-1 in the same file: rename each column back to its Spanish name,
drop the new-named constraint and re-add the old-named one. No data movement either
direction, so nothing to lose. Verified by running `migration:raw:run` then
`migration:raw:revert` against a local/staging copy of the raw DB before this ships (see
`runbook.md`).

### AC-3 — Banner/Planner raw + scraper TS identifiers are English

Mechanical rename, entity-by-entity and file-by-file, following the table in AC-1 plus the
non-column identifiers it implies:

- **Entities** (`raw/model/*.entity.ts`): property renames per AC-1's table; `@Unique(...)`
  arrays updated to the new TS property names (not the new column names — the array is
  TS-property-space, per `docs/POLICIES.md` § Entity Rules).
- **Insert interfaces and repository methods** (`raw/core/*.repository.ts`): every
  `Insert` interface field and `findByPeriodo(periodo: string)` →
  `findByPeriod(period: string)` on `ScrapeRunRepository`/`PlannerScrapeRunRepository`
  (and their `deleteOtherRunsForPeriodo(periodo, ...)` params) rename to match.
- **Scraper services** (`scraper/api/{scraper,planner-scraper}.service.ts`): every local
  variable, parameter, and the `Enrollment`/`NotaPair`/`EvalPair`-adjacent `RunSummary`/
  `PlannerRunSummary` interface fields rename. `courseCodeOf()`'s derivation logic
  (`materia.codigo + numeroCurso`) is untouched — those are JSONB `payload` field accesses
  into Banner's own external shape, explicitly out of scope (Non-goals).
- **DTOs** (`scraper/model/{scraper,planner-scraper}.dtos.ts`): `RunScrapeDto.nivel` →
  `.level`, `.departamentos` → `.departments`; `RunPlannerScrapeDto.nivel` → `.level`,
  `.cursos` → `.courses`; `RunSummaryResponseDto`/`PlannerRunSummaryResponseDto` fields
  rename to match (see AC-5).
- **Controllers** (`scraper/api/*.controller.ts`): no Spanish identifiers today beyond what
  the DTOs already carry — nothing to change here beyond what the DTO rename cascades into
  (parameter destructuring, if any).

`nrc` and every `payload.<field>` access are exempt per Non-goals — confirmed present in
`scrapeHorario`/`scrapeMatricula` (`section.nrc`, `section.materia.codigo`,
`section.numeroCurso`, `item.listaAlumnos`, `alumno.codigoAlumno`) and left untouched.

### AC-4 — `scraping-exports` raw SQL updated, all export types verified correct

Two files, both confirmed by grep against the renamed-column set:

- `core/scraping-exports.repository.ts` — the `RUN_FOR_PERIOD` CTE (`periodo = $1`) and the
  `raw_alumno.codigo_alumno`/`raw_matricula.codigo_alumno`/`nrc` joins across `getStaff`,
  `getStudentSections`, and the other export-row methods.
- `core/grades-rc-export.sql.ts` — `MATERIALIZE_GRADES_RC_SQL`'s two `RUN_FOR_PERIOD`-style
  CTEs and the `raw_notas`/`raw_matricula`/`raw_alumno`/`raw_planner_*` column references
  throughout (`codigo_alumno`, `curso_codigo`, `periodo`). `grades-rc-export.repository.ts`
  itself has zero Spanish column references — it only consumes the SQL constant, nothing to
  change there.

**Verification method** (the risk this AC exists for: none of this SQL is type-checked, so a
missed reference fails silently at query time, not at build time):

1. Existing unit tests in `scraping-exports.repository.spec.ts` and
   `grades-rc-export.repository.spec.ts` mock `dataSource.query` and assert on SQL
   _structure_ (e.g. `MATERIALIZE_GRADES_RC_SQL.split('banner_grades AS')`,
   `expect(sql).toContain("status = 'completed'")`) — these get mechanically updated to the
   new column names, which catches a missed string literal but **not** a wrong result set,
   since the query never actually runs against Postgres in these tests.
2. That gap is why AC-4 explicitly asks for output-content verification, not just tests
   passing: **staging**, run every export type (Docentes, Secciones, Alumnos Matriculados,
   Alumnos-Secciones, Grades RC) against the same completed scrape run once before the
   rename lands and once after, and diff the generated files. No fixture-DB/testcontainers
   harness exists in this repo to do this in CI (confirmed — grep for `testcontainers`/
   `TEST_DB_URL` found nothing), so this step is manual and belongs in `runbook.md`, not in
   `pnpm test`.

### AC-5 — Public DTOs are English-only, `openapi.json` regenerated

Covered by the DTO renames under AC-3, plus AC-8's additive `triggeredByName` field. Once
both land, `pnpm openapi:export` regenerates the committed spec in the same PR — no
hand-editing `openapi.json`.

### AC-6 — `ScraperPhase`/`PlannerScraperPhase` values are English

**Correction from the original proposal**: `1787270797549-add-phase-to-scrape-runs.ts`
(`scrape-progress-and-performance`) is **already applied** —
`git log develop -- src/database/migrations-raw/1787270797549-add-phase-to-scrape-runs.ts`
returns commit `8f429715` (PR #121), and that change is archived at
`openspec/specs/scrape-progress-and-performance/`. Editing an applied migration in place is
exactly what `docs/POLICIES.md` § Migrations forbids ("never edit ... any already-applied
migration in place" — it doesn't run again on a database that already has its row in the
`migrations` table, so an in-place edit would silently no-op there). This needs its own new,
forward-only migration instead, created after Task 1.1's column-rename migration (it targets
the same two tables post-rename) via
`pnpm migration:raw:create src/database/migrations/rename-scrape-phase-literals`.

`phase` is cleared to `null` on every terminal run by `finish()` (per `docs/CONTEXT.md` §
Business Rules), so only a currently-`running` row can hold a non-null value at migration
time — normally none, since scrapes are short admin-triggered operations, but the migration
must still handle that case correctly rather than assume the column is always empty. `up()`:
drop each CHECK constraint, `UPDATE` any non-null `phase` from its Spanish value to the
matching English one, add the new CHECK constraint. `down()`: the exact inverse (drop new
constraint, `UPDATE` back to Spanish, add old constraint back).

| Old value         | New value             |
| ----------------- | --------------------- |
| `'horario'`       | `'schedule'`          |
| `'matricula'`     | `'enrollment'`        |
| `'alumnosYNotas'` | `'studentsAndGrades'` |
| `'secciones'`     | `'sections'`          |
| `'evaluaciones'`  | `'evaluations'`       |
| `'notas'`         | `'grades'`            |

Alongside the migration, the `ScraperPhase`/`PlannerScraperPhase` TS union types in
`raw/model/{scrape-run,planner-scrape-run}.entity.ts` rename to match, and every call site
that writes or compares a phase literal (`ScrapeRunRepository.updatePhase`/
`PlannerScrapeRunRepository.updatePhase` call sites in both scraper services,
`SCRAPER_PHASE_VALUES`/the Planner equivalent in the DTO files, and
`ScrapeRunStatusResponseDto`'s `enum`) updates to match. `'notas'` as a _phase_ value
(`PlannerScraperPhase`) renames to `'grades'`; `'notas'` as the _step_ key inside
`stats.errors[].step` (a free-text diagnostic string, not a typed enum) is untouched — it
isn't listed in Goals and isn't part of any wire contract.

This makes the `phase` field's renamed values a **live breaking wire-format change** — unlike
the original assumption (a plain pre-merge edit nobody outside this branch would ever see),
`scrape-progress-and-performance` has already shipped, so any frontend code branching on
`phase === 'horario'`-style literals today will see the new values. It joins AC-5's DTO field
renames under the same already-agreed Non-goals decision (sequential cross-repo mode, no
compatibility shim) rather than needing a new one.

### AC-7 — Full affected-module test suite green after rename

No new test scenarios from the rename itself (AC-1–AC-6 are pure identifier renames with
unchanged behavior) — existing `.spec.ts` files across `admin/banner/**`, `admin/planner/**`,
`admin/scraping-exports/**` get the same mechanical rename applied to their mocks/fixtures/
assertions (e.g. `scraper.service.spec.ts`'s `triggeredBy: 'user:1'` fixture object gains
`level`/`period`/`departments` instead of `nivel`/`periodo`/`departamentos`). AC-7 is the
check that this was in fact mechanical: if any test needs an assertion change beyond
renaming an identifier, that is a signal the rename touched behavior and needs a second
look before merging.

### AC-8 — `triggeredBy` resolved to a display name, `'-'` fallback when unresolvable

**Where triggeredBy comes from**: `ScraperController.run`/`PlannerScraperController.run`
already pass `` `user:${user.userId}` `` (from `@CurrentUser()`) into
`ScraperService.run`/`PlannerScraperService.run`, which persists it verbatim on
`scrape_run.triggered_by`/`planner_scrape_run.triggered_by` (nullable `text`). Nothing about
that write path changes.

**Why this can't be a SQL join**: `organization.users` lives on the main datasource;
`scrape_run`/`planner_scrape_run` live on the `raw`/`planner-raw` datasource — two separate
physical Postgres instances (`RAW_DB_URL` vs. `DB_HOST`/`DB_NAME`, per
`src/database/typeorm.raw.config.ts` vs. `typeorm.config.ts`). Resolution has to be two
queries and an in-memory join, the same shape `ScrapingExportsRepository` already uses for
`resolveAcademicPeriodCode`/`findAcademicPeriodIdByCode` (raw-side `periodo` string resolved
against the main-side `academic.academic_periods` table) — precedent for this exact
cross-connection pattern already exists in this codebase, just not for users.

**Design**:

- `UserRepository` (`src/modules/organization/users/core/users.repository.ts`) gains:

  ```typescript
  async findDisplayNamesByIds(userIds: number[]): Promise<Map<number, string>> {
    if (userIds.length === 0) return new Map();
    const users = await this.findByCondition({
      where: { id: In(userIds) },
      select: ['id', 'firstName', 'lastName'],
    });
    return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  }
  ```

  Uses the inherited `findByCondition` (TypeORM, not raw SQL) — no new raw-SQL surface, and
  stays inside the repository boundary (this is a repository method; the calling service
  never touches `DataSource`/`EntityManager` directly).

- `UserModule` currently exports only `UserService`/`UserAuthorizationService` — add
  `UserRepository` to `exports` (`docs/POLICIES.md` § Module Declaration Pattern already
  says repositories should be exported for cross-module consumption; this module just hadn't
  needed to yet).

- `ScraperModule`/`PlannerScraperModule` import `UserModule`; `ScraperService`/
  `PlannerScraperService` take `UserRepository` as a new constructor dependency (both
  services already inject repositories directly — e.g. `ScrapeRunRepository`,
  `DepartmentSourceRepository` — so this matches the existing style in these two files rather
  than introducing a new layering).

- Both services' `listRuns()` gain the same shape of logic (kept as a private method in each
  file rather than factored into a shared util — both files already duplicate small helpers
  this way, e.g. `toStringOrNull`/`hashPayload`/`asArray`/`createLimiter`, so this follows
  the existing convention rather than introducing the first shared cross-file helper):

  ```typescript
  const runs = await this.scrapeRunRepository.findByPeriod(period);
  const userIds = [...new Set(runs.map((r) => parseUserId(r.triggeredBy)).filter((id): id is number => id !== null))];
  const namesById = userIds.length > 0
    ? await this.userRepository.findDisplayNamesByIds(userIds)
    : new Map<number, string>();
  return runs.map((run) => ({
    ...,
    triggeredBy: run.triggeredBy,
    triggeredByName: (() => {
      const id = parseUserId(run.triggeredBy);
      return id !== null ? (namesById.get(id) ?? '-') : '-';
    })(),
  }));
  ```

  with a small module-scope helper:

  ```typescript
  function parseUserId(triggeredBy: string | null): number | null {
  	if (!triggeredBy) return null;
  	const match = /^user:(\d+)$/.exec(triggeredBy);
  	return match ? Number(match[1]) : null;
  }
  ```

  One batched lookup per `listRuns()` call (not one query per run) — the same
  dedupe-then-batch shape `ScrapingExportsRepository` already uses elsewhere in this module
  tree.

- `RunSummaryResponseDto`/`PlannerRunSummaryResponseDto` gain `triggeredByName: string`
  (never null, `@ApiProperty` not `@ApiPropertyOptional` — it always has a value, `'-'` in
  the worst case), alongside the untouched `triggeredBy`.

`'-'` covers three distinct cases uniformly, all resolved the same way by the caller (no
need to distinguish them on the wire): `triggeredBy` is `null` (pre-this-field legacy rows,
or a future non-interactive trigger), `triggeredBy` doesn't match `user:<digits>` (defensive
— nothing writes any other shape today), and `triggeredBy` names a `userId` no longer in
`organization.users` (deleted account).

### AC-9 — `core.scraping_export_runs.periodo` renamed, `openapi.json` regenerated

Found post-implementation, during the audit: `core.scraping_export_runs` — this feature's
own persisted generation state (see ADR-002), main datasource, not a raw Banner/Planner
table — has a Spanish `periodo` column that the original inventory missed. Same violation
class as everything else in this proposal (our own identifier, not external payload), so it
gets the same treatment: a new main-datasource migration
(`pnpm migration:create src/database/migrations/rename-scraping-export-runs-periodo`),
`ALTER TABLE core.scraping_export_runs RENAME COLUMN periodo TO period`, drop+re-add
`UQ_scraping_export_runs_export_type_periodo_lang` → `UQ_scraping_export_runs_export_type_period_lang`
(same reason as AC-1: `RENAME COLUMN` doesn't rename a constraint that references it),
`down()` the exact inverse.

TypeScript identifiers renamed to match, confirmed by a full-module grep (`\bperiodo\b`,
case-insensitive, across `admin/scraping-exports/**`, excluding `.spec.ts`) before writing
this section — nothing found beyond what's listed here, plus one legitimate JSONB display
string in `scraping-exports.labels.ts` ("Periodo académico", an Excel column header,
Non-goals-exempt same as every other display string in this proposal):

- `ScrapingExportRunEntity.periodo` → `.period`; its `@Unique(...)` array
  `['exportType', 'periodo', 'lang']` → `['exportType', 'period', 'lang']`.
- `ScrapingExportStatusResponse.periodo` (`scraping-exports.types.ts`, plain interface) and
  `ScrapingExportStatusResponseDto.periodo` (`scraping-exports.response.dtos.ts`, the Swagger
  mirror of it) → `.period`. The DTO is wire-facing and already consumed by the frontend's
  export-download screen — this is a real breaking change, folded into the same sequential
  cross-repo delivery as AC-5/AC-6 rather than treated as a separate coordination event.
- `ScrapingExportRunRepository.findByKey`/`.upsertByKey`'s `periodo: string` params → `period`,
  and — critically — `upsertByKey`'s `conflictPaths: ['exportType', 'periodo', 'lang']` →
  `['exportType', 'period', 'lang']` in the same change as the entity property rename.
  TypeORM resolves `conflictPaths` by property name, not column name; a mismatch here would
  compile fine and break the `ON CONFLICT` target silently (see design.md's own precedent for
  this class of risk at AC-1's constraint renames). No raw SQL here, so nothing else to check.
- `ScrapingExportsRepository.resolvePeriodoCode` → `.resolvePeriodCode`; its own
  `findAcademicPeriodIdByCode(periodoCode: string)` parameter (a wrapper around the
  already-English free function of the same name in the same file) → `periodCode`.
- `ScrapingExportGenerationService.resolvePeriodo` → `.resolvePeriod`; its `toStatusResponse`
  and `reconcileIfStale` methods' `row.periodo` reads → `row.period` (these two were
  deliberately left untouched by Task R1.5's `periodo`-locals rename in the same file,
  specifically because they read this now-renamed entity field — AC-9 is what closes that).
- `ScrapingExportsController`'s private `resolvePeriodo` method and its local `periodo`
  variables (4 call sites across `status`/`download`/`regenerate`) → `resolvePeriod`/`period`.

## Backend

- **Modules touched**: `admin/banner/raw`, `admin/banner/scraper`, `admin/planner/raw`,
  `admin/planner/scraper`, `admin/scraping-exports` (SQL, entity/DTO field, and repository/
  service/controller identifiers — no module wiring change), `organization/users` (export
  `UserRepository`; add `findDisplayNamesByIds`).
- **Entities**: property renames only (AC-1/AC-3, AC-9) — no new entities, no new columns;
  the already-shipped `phase` column is untouched by this change beyond its CHECK-constraint
  values (AC-6).
- **Migrations**: three new migrations, in order — two raw-datasource (AC-1/AC-2's column
  rename, then AC-6's phase-literal rename, both `migration:raw:create`; see AC-6 for why
  the latter is a new migration, not an in-place edit to the already-applied
  `1787270797549-add-phase-to-scrape-runs.ts`) and one main-datasource (AC-9's
  `core.scraping_export_runs.periodo` rename, `migration:create`). `triggeredByName` itself
  needs no migration — it's computed at read time, never persisted.
- **Endpoints**: no route or method changes. `POST /banner/scrape`, `GET /banner/scrape`,
  `GET /banner/scrape/:runId`, their Planner equivalents, and `GET .../status`/
  `GET .../download`/`POST .../regenerate` under `admin/scraping-exports` all keep their
  shape; only field names change (renames on `RunScrapeDto`/`RunSummaryResponseDto`/
  `RunPlannerScrapeDto`/`PlannerRunSummaryResponseDto`/`ScrapingExportStatusResponseDto`) or
  add (`triggeredByName`).
- **Guards / scope**: unchanged — both `run`/`list` endpoints keep `@RequirePermission`
  (`PERMISSION_MODULES.SCRAPPING`) and `@ApiAcademicPeriodHeader()`.
- **i18n keys**: none added or changed — this is identifier renaming and a new response
  field, not new user-facing error paths.
- **Validation**: none of the renamed fields' `class-validator` decorators change semantics
  (`@IsOptional`/`@IsString`/`@IsArray` stay attached to the same, renamed, property).

## Cross-repo mode

- **Mode**: sequential, matching the pattern already used by
  `scrape-progress-and-performance` and `scrape-retention-and-cached-exports` (per
  proposal.md § Dependencies). No `contract.md`.
- **Contract**: this backend PR's regenerated `openapi.json`, committed in the same PR.
- **Ordering**: this PR merges and reaches `staging` before the paired frontend PR (which
  updates every `nivel`/`periodo`/`departamentos`/`cursos`/`escuela` reference to
  `level`/`period`/`departments`/`courses`/`school`, every `phase` literal it renders or
  branches on, and adds `triggeredByName` display) merges. No dual-field compatibility
  window — per proposal.md § Non-goals, the raw datasource has no long-lived data a phased
  rollout would need to bridge. Unlike the DTO field renames, the `phase` values are already
  live in production (`scrape-progress-and-performance` shipped ahead of this change), so the
  window between this PR reaching `staging`/`production` and the frontend PR merging is a
  real period where an unpatched frontend would see phase values it doesn't recognize —
  keep that window short.

## Testing strategy

| AC  | Covered by                                                                                                                                                                                                                                                                                                                                                                        | Kind                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | New migration's `up()` runs cleanly against a copy of the raw DB; row counts compared before/after                                                                                                                                                                                                                                                                                | manual (runbook)        |
| 2   | Same migration's `down()` run immediately after `up()`, row counts compared                                                                                                                                                                                                                                                                                                       | manual (runbook)        |
| 3   | Existing entity/repository/service `.spec.ts` files, mechanically renamed                                                                                                                                                                                                                                                                                                         | unit                    |
| 4   | Renamed SQL-string assertions in `scraping-exports.repository.spec.ts`/`grades-rc-export.repository.spec.ts` (structure only) **plus** before/after export diff on staging                                                                                                                                                                                                        | unit + manual (runbook) |
| 5   | `pnpm openapi:export` diff reviewed in the PR; DTO `.spec.ts` (validation pipe tests, if any) renamed                                                                                                                                                                                                                                                                             | build-time check + unit |
| 6   | New `rename-scrape-phase-literals` migration's `up()`/`down()` run against a copy of the raw DB with a manually-seeded non-null `phase` row, confirming the backfill and constraint swap both ways; `ScraperService`/`PlannerScraperService` phase-tracking tests (already assert exact phase values, e.g. "includes phase in each run summary") renamed to new literals          | unit + manual (runbook) |
| 7   | Full `admin/banner/**`, `admin/planner/**`, `admin/scraping-exports/**` suite                                                                                                                                                                                                                                                                                                     | unit                    |
| 8   | New `UserRepository.findDisplayNamesByIds` unit test (found / not-found / empty-input); new `listRuns()` cases for null / malformed / not-found `triggeredBy` in both `scraper.service.spec.ts` and `planner-scraper.service.spec.ts`                                                                                                                                             | unit                    |
| 9   | New migration's `up()`/`down()` run against a copy of the main DB, row count and constraint name compared before/after; existing `scraping-export-run.repository.spec.ts`/`scraping-export-generation.service.spec.ts`/`scraping-exports.controller.spec.ts` mechanically renamed, re-run to confirm the upsert/`conflictPaths` change didn't silently break the ON CONFLICT path | unit + manual (runbook) |

Anything marked manual appears in `runbook.md`.

## Risks

| Risk                                                                                                                                                                                                                                         | Mitigation                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grades-rc-export.sql.ts`'s raw SQL (~580 lines) is not type-checked — a missed rename fails only at query time.                                                                                                                             | AC-4's staging before/after diff (runbook), not just the build/test suite passing.                                                                                                                                                                             |
| Breaking wire-format change to four DTOs _and_ the already-live `phase` field values the frontend consumes today.                                                                                                                            | Sequential cross-repo mode; backend reaches `staging` first; no compatibility shim (per Non-goals). AC-6's rename is a real forward-only migration with a data backfill (see AC-6), not a pre-merge edit, precisely because `phase` is already live.           |
| AC-6's migration touches production data (`UPDATE` on any in-flight run's `phase`) — a wrong `CASE` mapping or a constraint added before the data backfill completes would leave rows that violate the new CHECK constraint.                 | `up()` order is fixed: drop old constraint → backfill data → add new constraint (never add-then-backfill); `down()` mirrors it. Manually verified on staging with a seeded non-null `phase` row (Testing strategy, runbook.md) before this reaches production. |
| `raw_horario`/`raw_matricula`/etc. keep Spanish table names while gaining English columns (Non-goals) — a visible, deliberately-left inconsistency.                                                                                          | Documented in proposal.md § Non-goals/Risks; not this change's problem to solve.                                                                                                                                                                               |
| AC-8's `findDisplayNamesByIds` is a new cross-connection code path with no prior test coverage in this codebase to extend.                                                                                                                   | Explicit unit tests for all three fallback branches (null / malformed / not-found), listed in Testing strategy.                                                                                                                                                |
| AC-9's `conflictPaths: ['exportType', 'periodo', 'lang']` must be renamed together with the entity property — a mismatch breaks `upsertByKey`'s `ON CONFLICT` target silently (compiles fine, wrong runtime behavior), not a compiler error. | Single commit covering entity, `@Unique(...)`, and `conflictPaths` together; existing repository/service tests re-run to confirm the upsert path still exercises correctly.                                                                                    |
| AC-9 was missed in this proposal's original inventory, found only post-implementation during audit — a reminder that "no Spanish identifier remains" (AC-3's spirit) is only as good as the inventory it was checked against.                | Corrected in the same PR; a full-module grep across `admin/scraping-exports/**` before writing AC-9 found nothing else missed beyond what AC-9 now covers.                                                                                                     |

## Docs to update in this PR

- [ ] `docs/CONTEXT.md` § Business Rules — the "completed Banner or Planner scrape run
      deletes every other raw-data run" bullet and the "exposes its in-flight `phase`"
      bullet both use `periodo`/`departamentos`/`escuela` and the Spanish phase literals
      (`horario`/`matricula`/`alumnosYNotas`, `secciones`/`evaluaciones`/`notas`) by name —
      update both to the renamed English identifiers so they describe the post-rename code.
- [ ] `openapi.json` — regenerated via `pnpm openapi:export`, committed in the same PR
      (already a standing rule, called out here because this PR is the reason it changes).
