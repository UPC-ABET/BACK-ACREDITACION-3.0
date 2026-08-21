# ABET Backend — CONTEXT

> **Orientation, not rules.** What this system is, how it is laid out, what the words mean.
> Read this to find your way around; read [POLICIES.md](./POLICIES.md) for the constraints
> you must not violate, and [adr/](./adr/) for why particular decisions were made.
>
> When this file and the code disagree, **the code is right and this file is stale** — fix
> it in the same pull request that made it stale.

## What this system is

The backend for UPC's ABET accreditation platform. It records the evidence a programme
needs in order to be accredited: what was taught, how students performed against defined
outcomes, what the resulting findings were, and what improvement actions followed.

Most of its data originates elsewhere — the university's Banner and uPlanner systems — and
is brought in by a separate scraping pipeline. This service owns the accreditation domain
built on top of it.

## Tech Stack

- **Runtime:** Node.js 24+ with NestJS 11
- **Database:** PostgreSQL with TypeORM 0.3
- **Auth:** JWT (passport-jwt) + Microsoft Entra ID (MSAL)
- **Mail:** SMTP via nodemailer (`MailService`) — all email goes through this single service
- **Validation:** class-validator + class-transformer on DTOs, custom validation classes for business rules
- **Environment:** Zod-validated env schema (`src/commons/configs/env.config.ts`)
- **Files/export:** ExcelJS for spreadsheets, archiver for bundles. AWS S3 credentials are
  configured (`@aws-sdk/client-s3` is a dependency) but not yet wired to any code path — see
  the External Integrations table below
- **Package manager:** pnpm

## Domain Vocabulary

The words that mean something specific here. Each maps to a module under `src/modules/`.

| Term                          | Means                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **School**                    | The organisational unit an accreditation belongs to. The top-level scope for nearly every query.                                       |
| **Faculty / Campus**          | Organisational structure above and beside a school.                                                                                    |
| **Programme** (`programs`)    | A degree programme being accredited.                                                                                                   |
| **Modality**                  | Delivery mode of a programme. Part of the global scope alongside school and academic period.                                           |
| **Academic period**           | A term. The time axis of the whole system; almost nothing is meaningful without one.                                                   |
| **Study plan**                | The set of courses a programme requires, versioned by the periods it applies to.                                                       |
| **Course / Course section**   | A subject, and a specific taught instance of it in a period.                                                                           |
| **Outcome**                   | A learning outcome a programme commits to. The unit accreditation is assessed against.                                                 |
| **Course-outcome mapping**    | Which course contributes evidence for which outcome.                                                                                   |
| **Performance level**         | The scale a student's achievement of an outcome is graded on.                                                                          |
| **Commission / Accreditor**   | The body assessing the programme, and the accrediting standard it applies.                                                             |
| **Rubric**                    | The instrument used to score work: questions, criteria, and scores.                                                                    |
| **Project**                   | A piece of assessed student work, with evaluators, groups and students attached.                                                       |
| **Evidence**                  | Collected artefacts proving outcome attainment — evaluations, instruments, surveys, grades.                                            |
| **IFC**                       | _Informe Final de Curso_ — the end-of-course report a professor submits, reviewed and approved or returned with observations.          |
| **Finding** (`hallazgo`)      | A problem identified through an IFC or evaluation.                                                                                     |
| **Improvement plan / action** | The corrective work raised in response to findings, tracked to completion.                                                             |
| **ARD**                       | An accreditation report artefact under `evidence/ards`.                                                                                |
| **GRA**                       | A report surface referenced in the codebase and release notes.                                                                         |
| **Type / Type group**         | The generic lookup mechanism (`core/types`, `core/type-groups`) used instead of enums, addressed by `TYPE_CODES` / `TYPE_GROUP_CODES`. |
| **Parameter**                 | Runtime-configurable settings held in `core/parameters` rather than in code.                                                           |

> Terms marked as report surfaces (**ARD**, **GRA**) are named accurately but their precise
> business definition is not yet written down. Fill these in rather than guessing.

## Project Structure

```
src/
├── commons/           # Base classes, decorators, configs, DTOs
│   ├── base.controller.ts
│   ├── base.service.ts
│   ├── base.repository.ts
│   ├── ibase.repository.ts
│   ├── base.entity.ts
│   ├── base.validation.ts
│   ├── base.decorator.ts     # Swagger decorator factories
│   ├── response.dtos.ts      # ResponseDto
│   ├── swagger.strings.ts
│   └── configs/
│       ├── db.configs.ts      # Custom column decorators
│       ├── env.config.ts      # Zod env schema
│       └── validation.config.ts
├── database/
│   ├── typeorm.config.ts      # CLI migration config
│   ├── migrations/            # TypeORM migrations
│   └── scripts/seeds/         # Seed data
├── libs/                      # Shared utilities
│   ├── encrypt.service.ts     # AES-256-GCM encryption
│   ├── secure.functions.ts    # Cookie helpers, bcrypt, constants
│   └── global.functions.ts    # parseSuccessResponse
├── modules/                   # Feature modules (see Module Layout)
│   ├── academic/
│   ├── accreditation/
│   ├── admin/                 # Admin-only modules, grouped by domain (e.g. admin/ifc/notification-configs)
│   ├── auth/
│   ├── core/
│   ├── evaluation/
│   ├── evidence/
│   ├── ifc/
│   ├── improvement/
│   ├── mail/
│   ├── organization/
│   └── survey/
├── shared/
│   ├── filters/               # AllExceptionsFilter
│   ├── strings/               # sharedStrings
│   └── types/                 # I18nText, toI18n, i18nText, i18nTrim
├── tools/                     # CLI tooling (OpenAPI export, generators)
├── main.ts
├── app.module.ts
├── app.controller.ts
└── app.service.ts
```

## Module Layout

Every feature module follows this exact structure:

```
<module>/
├── api/
│   ├── <module>.controller.ts
│   ├── <module>.service.ts
│   └── docs/
│       └── <module>.swagger.ts
├── model/
│   ├── <module>.entity.ts
│   └── <module>.dtos.ts
├── core/
│   ├── <module>.repository.ts
│   ├── <module>.validation.ts
│   └── <module>.validation.spec.ts
├── config/
│   ├── <module>.routes.ts
│   └── strings/
│       └── <module>.validation.ts    # i18n key constants
└── <module>.module.ts
```

**Exceptions:** `auth` (no entity, orchestrates via other modules), `mail` (utility module, no
controller/model), and `admin/scraping/credentials` (no controller — it is infrastructure consumed
by the provider modules, whose own endpoints expose it; a generic endpoint here would be a second
way to write the same row with different validation).

**Admin modules:** Functionality that is an administrator responsibility (configuration, settings, templates, notification rules) lives under `modules/admin/<domain>/<module>` — e.g. `admin/ifc/notification-configs`. Each admin module still follows the standard layout above; only its location signals admin ownership. This grouping does not change the database: entities keep their original `@Entity({ schema, name })` (e.g. notification configs remain in the `ifc` schema), and raw SQL keeps referencing the original schema-qualified table.

## Base Classes (Generics)

All base classes use TypeScript generics. **Never use `any` in base class signatures.**

```typescript
// Interface
interface IBaseRepository<E extends BaseEntity = BaseEntity> { ... }

// Repository — concrete repos must specify their entity type
abstract class BaseRepository<E extends BaseEntity = BaseEntity>
  implements IBaseRepository<E> {
  protected readonly repository: Repository<E>;
}

// Service — R is inferred from the concrete repository
class BaseService<R extends BaseRepository<any> = BaseRepository> {
  constructor(protected readonly baseRepository: R) {}
}

// Controller
class BaseController<S extends BaseService<any> = BaseService> {
  constructor(private readonly baseService: S) {}
}
```

**Concrete repository example:**

```typescript
export class CourseRepository extends BaseRepository<CourseEntity> {
	constructor(
		@InjectRepository(CourseEntity) repository: Repository<CourseEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}
}
```

## Database

PostgreSQL, organised into schemas that mirror the module tree:

| Schema          | Holds                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `academic`      | periods, programmes, courses, sections, study plans, students, professors, grades                                                                                                                                                                                                                                                                     |
| `core`          | types, type groups, parameters, email templates, notification logs, scraper credentials (password encrypted — see [ADR-001](./adr/ADR-001-external-system-credentials-encrypted-in-database.md)), persisted scraping export generation state (`scraping_export_runs` — see [ADR-002](./adr/ADR-002-persisted-pollable-scraping-export-generation.md)) |
| `evaluation`    | projects, rubrics, questions, criteria, scores, evaluators                                                                                                                                                                                                                                                                                            |
| `evidence`      | IFCs, ARDs, evaluations, instruments, surveys, outcome grades                                                                                                                                                                                                                                                                                         |
| `organization`  | schools, faculties, campuses, charts, staff, users                                                                                                                                                                                                                                                                                                    |
| `improvement`   | findings, actions, plans and their links                                                                                                                                                                                                                                                                                                              |
| `accreditation` | outcomes, commissions, accreditors, conversions                                                                                                                                                                                                                                                                                                       |
| `survey`        | notification messages                                                                                                                                                                                                                                                                                                                                 |
| `ifc`           | IFC findings and statuses                                                                                                                                                                                                                                                                                                                             |
| `audit`         | upload/rollback undo stacks (`fn_upload_*`, `fn_rollback_*`)                                                                                                                                                                                                                                                                                          |

Configuration:

- `synchronize: false` — schema changes only ever arrive via migrations.
- `autoLoadEntities: true` — entities register through `TypeOrmModule.forFeature()` per module.
- Migration CLI config: `src/database/typeorm.config.ts` (globs entities, since it runs outside NestJS).

**Two datasources.** The main one holds the application domain above. A second, _raw_
datasource (`src/database/typeorm.raw.config.ts`, with its own `migration:raw:*` scripts)
mirrors the external Banner / uPlanner scraping database. Entities under `admin/*/raw/`
belong to it and map external shapes verbatim. The `raw` and `planner-raw` TypeORM connection
names are two registrations of this **same** physical Postgres instance, not two databases —
which is why `src/database/migrations-raw/` holds a single migration history covering both
Banner's and Planner's raw tables.

**The production `sys_acc_back` container is capped at 640MB (`mem_limit: 640m`), and this is
the binding constraint on scraper concurrency, not CPU.** The box is a small 2 vCPU / 1.9GB
EC2 instance; raising any scraper's in-flight request concurrency increases the HTTP response
buffers and JSON parsing held in memory at once inside that ceiling. Any change to Banner's or
Planner's `p-limit` concurrency constants must be validated against this cap on staging before
being adopted — see `openspec/changes/scrape-progress-and-performance/design.md` and
`runbook.md` for the measurement procedure this was first documented against.

**`RAW_DB_URL` gates whole modules, not just that connection.** `app.module.ts` registers
`BannerModule`, `PlannerModule` and `ScrapingExportsModule` only when it is set, so a deployment
without it serves none of those endpoints. `openapi.json` is exported with a placeholder value
(`src/tools/export-openapi.env.ts`) so the committed spec always describes them — otherwise a
routine regeneration silently drops 16 paths, every one under `/banner/*`, `/planner/*` or
`/scraping/*`.

**The Planner session state is per-process, so this service must not be scaled to more than one
replica** until it moves into Postgres. The single-flight login and both cooldowns live in one
container's memory; a second replica would duplicate logins against u-planner, answer
`GET /planner/session/status` differently depending on which instance served the request, and
multiply the credential-verification throttle's allowance by the replica count. Pointing every
replica at one session file does not fix it: the file coordinates the session, nothing coordinates
the throttles, and the login they guard is the expensive part.

The grades RC export is a **second, independent** reason for the same constraint. It admits one
export at a time through an in-process flag in `ScrapingExportsController`, because each run pins a
pooled connection for the minutes it takes and runs the cross-scrape merge against a Postgres shared
with the application database. Each replica would get its own flag, so N replicas allow N concurrent
exports. Worth knowing when the Planner session state does move into Postgres: that removes the
reason above, not this one.

The survey background-job registries are a **third, independent** reason. `PppSurveyService`,
`GraNotificationService` and `LcfcNotificationService` each hold a `JobRegistry`
(`survey/shared/core/job-registry.ts`) — an in-process `Map<jobId, status>` for their long-running
bulk-upload / bulk-send jobs, populated by a fire-and-forget async task and polled by the frontend
every second via `GET .../upload-status/:jobId` (or `.../send-status/:jobId`). With more than one
replica, that `GET` 404s whenever it lands on an instance other than the one running the job — the
client sees the progress bar freeze and then a "job not found" error roughly half the time,
depending on the load balancer. The registry's concurrency caps are per-process for the same
reason, so N replicas would allow N times the intended number of concurrent jobs. Nothing here
lives in Postgres or a shared cache; moving any one of the three reasons above into shared storage
does not fix the other two.

The migration rules are mandatory and live in
[POLICIES.md § Migrations](./POLICIES.md#migrations).

## Cookie Constants

Defined in `src/libs/secure.functions.ts`:

| Cookie                  | httpOnly | secure         | sameSite | Purpose                     |
| ----------------------- | -------- | -------------- | -------- | --------------------------- |
| `access_token`          | true     | true           | lax      | JWT token                   |
| `school`                | false    | true           | lax      | `{ id, code }` for frontend |
| `microsoft_oauth_state` | true     | NODE_ENV-based | lax      | CSRF state for OAuth        |

TTL for access/school cookies: `JWT_EXPIRES_IN_SECONDS * 1000` (1 hour).

## Environment Variables

All env vars must be declared in `src/commons/configs/env.config.ts` with Zod validation. Required vars fail at bootstrap; optional vars use `.optional()`.

Key groups:

- **App:** `NODE_ENV`, `LOG_LEVEL`, `APP_PORT`, `APP_FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`
- **Database:** `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, `DB_POOL_*`
- **Auth:** `JWT_SECRET`, `APP_SECRET`, `COOKIE_SECRET`
- **Microsoft OAuth:** `ID_DIRECTORY_TENANT`, `ID_APPLICATION_CLIENT`, `MICROSOFT_SECRET`, `MICROSOFT_BASE_URL`, `URL_REDIRECT`
- **Mail:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`
- **Survey:** `SURVEY_BASE_URL`
- **Other:** `PUPPETEER_EXECUTABLE_PATH`

Scraper credentials are **not** environment configuration. Banner's and uPlanner's operator
credentials live encrypted in `core.scraper_credentials` and are set through the API, so they can
be rotated by the people who own the accounts without a deploy — see
[ADR-001](./adr/ADR-001-external-system-credentials-encrypted-in-database.md). The Planner
endpoint URLs (`PLANNER_LOGIN_API_URL`, `PLANNER_VALIDATE_URL`, `PLANNER_API_BASE`) and the
session file path (`PLANNER_TOKEN_STORE_PATH`) remain environment variables.

Use `configService.get<T>('KEY')` to read. Use `configService.getOrThrow<T>('KEY')` when the var is guaranteed to exist (avoids `!` assertions).

`NODE_ENV` is one of `development | staging | production`. Swagger is served at `/docs` (and
`/docs-json`) whenever it is **not** `production`.

## Shared Types

```typescript
// src/shared/types/i18n.ts
export type I18nText = Record<string, string>;  // { es: '...', en: '...' }

export const toI18n = (text: I18nText | string): I18nText => { ... };
export const i18nText = (val: I18nText | string | null | undefined): I18nText | null => { ... };
export const i18nTrim = (val: I18nText | null | undefined): string | null => { ... };
```

Use these shared helpers — never redeclare them locally.

## External Integrations

| System                 | Role                                                                                                                                                                                                                                                                                      | Reached via                                                                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Banner**             | University system of record for enrolment, schedules and grades                                                                                                                                                                                                                           | Scraped into the raw datasource                                                                                                                                                                                                                          |
| **uPlanner**           | Source of planning and grade data                                                                                                                                                                                                                                                         | Scraped into the raw datasource. Authenticated through u-planner's own HTTP API (a credential POST, then a token exchange) using credentials stored in `core.scraper_credentials` — **not** by driving a browser. Banner still needs one, because of 2FA |
| **Microsoft Entra ID** | Institutional sign-in                                                                                                                                                                                                                                                                     | MSAL (`@azure/msal-node`)                                                                                                                                                                                                                                |
| **AWS S3**             | Configured (env vars, `@aws-sdk/client-s3` dependency) but not yet used by any code path — no client/service wrapper exists. Generated scraping exports use `core.scraping_export_runs.file_bytes` instead; see [ADR-002](./adr/ADR-002-persisted-pollable-scraping-export-generation.md) | `@aws-sdk/client-s3` (installed, unused)                                                                                                                                                                                                                 |
| **SMTP**               | All outbound email                                                                                                                                                                                                                                                                        | `MailService` only                                                                                                                                                                                                                                       |

## Related repositories

| Repository                        | Role                                                              |
| --------------------------------- | ----------------------------------------------------------------- |
| `UPC-ABET/FRONT-ACREDITACION-3.0` | The Next.js frontend. Consumes this API.                          |
| `UPC-ABET/abet-plugins`           | The workflow below, packaged for Claude Code, Codex and opencode. |

`abet-plugins` is also a dev dependency here: the husky hooks call its shared policy
checks, so the same rules apply whichever agent a developer uses. The hooks skip silently
when it is not installed.

This repository publishes **`openapi.json`** at its root, generated by `pnpm openapi:export`
and committed. It is the frontend's source of truth for the API contract; the frontend reads
it remotely at a pinned branch and never from a local checkout.

## Spec-driven workflow

Changes of any size run through `openspec/`:

```
openspec/
├── changes/    in flight — one directory per change, named by kebab-case slug
└── specs/      archived record, moved here after the change merges
```

The branch carries the slug (`feat/<slug>`), so tooling infers the change from the branch
name. Multi-step work gets a change folder; a one-shot defect does not.

The full convention — artifacts, the cross-repo model, sequencing — is documented in the
`abet-common` plugin's `reference/conventions.md`.

## Security Decisions (Accepted Risks)

These are acknowledged and intentionally not fixed:

- DB TLS verification disabled (`rejectUnauthorized: false`)
- No rate limiting (mitigate at WAF/reverse proxy)
- No account lockout
- No Helmet/CSP headers
- No CSRF protection (cookie + bearer dual-mode auth)
- No JWT invalidation on password change
- `DB_TYPE as any` cast (TypeORM discriminated union limitation)

> Each of these is a decision with a cost, which is what an ADR exists to record. They are
> listed here as current reality; promoting them to `docs/adr/` with their reasoning is
> worthwhile when someone has the context to write the _why_.

One related decision **has** been written up, and should be read before touching scraping
credentials or `APP_SECRET`:
[ADR-001 — Store external-system credentials in our database, encrypted under `APP_SECRET`](./adr/ADR-001-external-system-credentials-encrypted-in-database.md).
Its consequence worth knowing here: rotating or losing `APP_SECRET` makes every stored scraper
credential undecryptable, and there is no key-rotation mechanism.

## Business Rules

Non-obvious rules that the code enforces but does not explain. **This section is
deliberately short and incomplete** — entries belong here only when someone who knows the
_why_ writes them down. Do not populate it by guessing from the code.

- **Scope is global, not per-screen.** School, modality and academic period come from
  request headers and apply to essentially every query. See
  [POLICIES.md § Scope Headers](./POLICIES.md#scope-headers-school--modality--academic-period).
- **Types are data, not enums.** Domain classifications live in `core/types` /
  `core/type-groups` and are referenced through `TYPE_CODES` / `TYPE_GROUP_CODES`, so new
  classifications are seed data rather than a code change.
- **Roles are additive.** A user's permissions are the union of all their roles' permissions,
  merged per module. There is no "active role".
- **An entity holds at most one active org chart node per academic period.** The key is
  `(academic period, entity type, entity)` and it is **global across schools** — two schools
  cannot both hold a node for the same course or programme in one period. Only entity-coded
  types participate (School, Programme, Course); Area, Subarea and untagged nodes carry no
  entity code and may repeat freely. The rule exists because `charts.entity_code` is joined
  directly by IFC status resolution and notification routing, several of them without an
  entity-type filter, so a duplicate node makes "who is responsible for this course" return
  two competing answers rather than failing. Enforced in `ChartValidation`, in
  `audit.fn_upload_charts`, and by the partial unique index
  `UQ_charts_academic_period_entity_type_entity_code`.
- **An Area, Subarea or Course chart node must resolve, directly or through its ancestry, to a
  Program node — and a Program node can only ever be created through the `chart-heads`
  pre-configuration step**, never through the Excel upload, the maintenance UI, or generic
  CRUD (Program joined `DEAN`/`SCHOOL` in `READ_ONLY_ENTITY_TYPES` for exactly this reason).
  The Excel upload's `parentCode` column resolves either to another row's own code in the same
  file, or to a pre-configured program's business code (`academic.programs.code`) — a blank
  `parentCode` is rejected outright. This is what lets IFC routing and evidence reporting
  attribute a course to a career reliably, the same reason the entity-uniqueness rule above
  exists: without it, a course could sit directly under a School with no career in between, and
  nothing would ever surface that as wrong. Enforced in `ChartValidation`
  (`hasProgramAncestor`) and in `audit.fn_upload_charts`.
- **A completed Banner or Planner scrape run deletes every other raw-data run for the same
  `periodo`; a run that itself finishes partial/failed/expired deletes only its own rows.**
  Raw scrape data (`raw_horario`/`raw_matricula`/`raw_alumno`/`raw_notas` on the `raw`
  connection; `raw_planner_seccion`/`raw_planner_evaluacion`/`raw_planner_nota` on
  `planner-raw`) is otherwise insert-only, tagged by a `runId` FK to `scrape_run` /
  `planner_scrape_run` with `onDelete: 'CASCADE'` — nothing ever removed a superseded run
  before this, so every re-scrape of the same period grew the raw datasource forever, even
  though only the newest completed run per period is ever read. Retention is keyed on
  `periodo` alone, not `departamentos`/`escuela` — Banner's own `findByPeriodo` ignores
  `departamentos`, and Planner's `escuela` column is never actually populated. Enforced in
  `ScraperService.execute()` / `PlannerScraperService.execute()`, right after each run's
  `finish()` call. See [ADR-002](./adr/ADR-002-persisted-pollable-scraping-export-generation.md).
- **A scrape run exposes its in-flight `phase` alongside the terminal `status`, and `phase` is
  single-valued and monotonic even when the underlying work is pipelined.** Banner writes
  `phase` (`horario` → `matricula` → `alumnosYNotas`) at each of its three strictly sequential
  stage boundaries. Planner writes `phase` (`secciones` → `evaluaciones` → `notas`) the first
  time each phase's work begins — which, because `PlannerScraperService.execute()` pipelines
  the three stages (each section's `evaluaciones` fetch starts as soon as that section is
  known, not after every course's `secciones` call finishes; each pair's `notas` fetch starts
  as soon as that pair is known), can happen while an earlier phase is still processing other
  items. `phase` always reports the furthest phase reached, not a set of concurrently-active
  phases — a deliberate simplification so the field stays a single label a frontend can render,
  regardless of whether the underlying scraper happens to be sequential or pipelined. Once a
  run reaches a terminal `status` (`completed`/`partial`/`failed`/`expired`), `finish()` clears
  `phase` back to `null` — `phase` only ever means "currently in flight"; a terminal run is read
  from `status` alone, the same way `finishedAt` is null only while a run is still running.
  Planner's
  pipelined concurrency profile (up to three phase limiters simultaneously active instead of
  strictly one-at-a-time) is not yet staging-validated against the memory ceiling above — see
  `openspec/changes/scrape-progress-and-performance/runbook.md`. See also
  `openspec/changes/scrape-progress-and-performance/design.md` § AC-1/AC-2/AC-6.

<!-- Add rules as they are established. Each entry: the rule, and why it exists. -->
