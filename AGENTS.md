# ABET Backend — AGENTS.md

> Canonical rules and conventions for this NestJS + TypeORM backend. Every agent and contributor must follow these exactly.
> This is the single source of truth; the root `CLAUDE.md` simply imports this file.

## Language Rules

- **All code, comments, variable names, error keys, commit messages, and documentation must be in English.**
- The only Spanish allowed is in i18n seed data values (inside `i18n('Spanish', 'English')` calls) and JSONB display strings stored in the database.
- No emoji in code or comments.

## Comments

Code should be self-explanatory by default — favour clear names, small functions, and obvious control flow over prose.

- Write comments **only** for complex, high-reasoning code: non-obvious algorithms, tricky invariants, ordering/concurrency concerns, or a "why" the code cannot express on its own (e.g. the upload/rollback PG functions).
- Do **not** add comments that restate what the code already says, narrate straightforward steps, or label obvious blocks. If a comment is only describing _what_ a readable line does, delete it and let the code speak.
- When a comment is genuinely needed, explain the _why_, not the _what_.
- If you feel a block needs a comment to be understood, first ask whether better naming or a small extracted function would remove the need.

## Naming Conventions

| Layer                                                                  | Casing                                                  | Example                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| TypeScript code (entities, DTOs, services, controllers, vars, methods) | `camelCase` / `PascalCase`                              | `studyPlanCourseId`, `CourseService`                                                  |
| Postgres columns                                                       | `snake_case`                                            | `study_plan_course_id`                                                                |
| JSONB column content (keys stored _inside_ a `jsonb` column)           | `snake_case`                                            | `extra = '{ "upload_undo": [{ "log_id": 1 }] }'`                                      |
| JSON wire format (request/response bodies)                             | `camelCase`                                             | `{ "studyPlanCourseId": 1 }`                                                          |
| URL params and query strings                                           | `camelCase`                                             | `/professor/:professorId?academicPeriodId=...`                                        |
| Constants                                                              | `SCREAMING_SNAKE_CASE`                                  | `TYPE_CODES.EVALUATOR_TYPE.COM`                                                       |
| i18n keys                                                              | `camelCase` segments                                    | `error.project.invalidGradeTypeCode`                                                  |
| File names                                                             | `kebab-case`                                            | `project-config.service.ts`                                                           |
| DB identifiers (table, FK, index, PK, UQ names)                        | `snake_case` with `FK_` / `IDX_` / `PK_` / `UQ_` prefix | `FK_project_students_project_id`, `IDX_users_email`, `PK_projects`, `UQ_courses_code` |

The TS ↔ DB bridge is `SnakeNamingStrategy` from `typeorm-naming-strategies`, wired in **both** `src/app.module.ts` and `src/database/typeorm.config.ts`. Do not hand-write `@Column({ name: '...' })` unless the DB column genuinely does not match `camelToSnake(propertyName)`.

`@JoinColumn({ name: '...', foreignKeyConstraintName: '...' })`, `@Index('IDX_...', [...])`, and `@Entity({ name: '...' })` keep DB-side identifiers in `snake_case`. The array passed to `@Index([...])` contains **TS property names** (camelCase), which the strategy resolves to columns.

**Every database column is `snake_case` — and so are the keys _inside_ `jsonb` columns.** `SnakeNamingStrategy` only bridges top-level column names; it does not reach inside a JSONB blob. So anything you write into a `jsonb` column (e.g. `extra`) must use `snake_case` keys at every depth, exactly like a real column. The camelCase wire shape is restored on read at the API boundary: `BaseService.normalizeJsonbColumns` runs `camelizeKeys` (`src/libs/case.functions.ts`) on JSONB columns, so services and clients still see `camelCase`. Writing camelCase keys into JSONB (including raw-SQL / PG-function writes such as the `audit.fn_upload_*` / `fn_rollback_*` undo stacks) is a violation — store `upload_undo` / `log_id`, never `uploadUndo` / `logId`.

### Raw SQL convention

Inside `dataSource.query(...)`, `createQueryBuilder().getRawMany()` / `getRawOne()`, and any QueryRunner usage:

- Column names _inside_ the SQL string stay `snake_case` (Postgres columns are snake_case).
- JS-side row access must be `camelCase`.
- **Alias columns in the query** with double quotes — Postgres folds unquoted identifiers to lowercase, so quoting is required:

  ```sql
  SELECT study_plan_course_id AS "studyPlanCourseId"
  FROM   academic.study_plan_courses
  ```

  Then access the result as `row.studyPlanCourseId`.

- Do not destructure-rename at the JS boundary. Pick one convention (aliasing) and keep it consistent across the codebase.

## Tech Stack

- **Runtime:** Node.js + NestJS 10
- **Database:** PostgreSQL with TypeORM 0.3
- **Auth:** JWT (passport-jwt) + Microsoft Entra ID (MSAL)
- **Mail:** Postmark (`MailService`) — all email goes through this single service
- **Validation:** class-validator + class-transformer on DTOs, custom validation classes for business rules
- **Environment:** Zod-validated env schema (`src/commons/configs/env.config.ts`)
- **Package manager:** pnpm

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

**Exceptions:** `auth` (no entity, orchestrates via other modules) and `mail` (utility module, no controller/model).

**Admin modules:** Functionality that is an administrator responsibility (configuration, settings, templates, notification rules) lives under `modules/admin/<domain>/<module>` — e.g. `admin/ifc/notification-configs`. Each admin module still follows the standard layout above; only its location signals admin ownership. This grouping does not change the database: entities keep their original `@Entity({ schema, name })` (e.g. notification configs remain in the `ifc` schema), and raw SQL keeps referencing the original schema-qualified table.

## File Naming

All files use **kebab-case** with the following suffixes:

| Suffix                                  | Purpose                                   |
| --------------------------------------- | ----------------------------------------- |
| `.entity.ts`                            | TypeORM entity                            |
| `.dtos.ts`                              | DTOs (CreateXDto, UpdateXDto, FilterXDto) |
| `.repository.ts`                        | Database access layer                     |
| `.service.ts`                           | Business logic                            |
| `.controller.ts`                        | HTTP handlers                             |
| `.module.ts`                            | NestJS module declaration                 |
| `.validation.ts` (in `core/`)           | Validation business rules                 |
| `.validation.ts` (in `config/strings/`) | i18n error key constants                  |
| `.validation.spec.ts`                   | Validation tests                          |
| `.swagger.ts`                           | Swagger decorator factories               |
| `.routes.ts`                            | Route definitions                         |
| `.spec.ts`                              | Test files (co-located with source)       |

**No barrel files** (`index.ts`) — import from the specific file directly.

## Class Naming

| Type       | Pattern            | Example            |
| ---------- | ------------------ | ------------------ |
| Entity     | `<Name>Entity`     | `CourseEntity`     |
| Create DTO | `Create<Name>Dto`  | `CreateCourseDto`  |
| Update DTO | `Update<Name>Dto`  | `UpdateCourseDto`  |
| Filter DTO | `Filter<Name>Dto`  | `FilterCourseDto`  |
| Repository | `<Name>Repository` | `CourseRepository` |
| Service    | `<Name>Service`    | `CourseService`    |
| Controller | `<Name>Controller` | `CourseController` |
| Module     | `<Name>Module`     | `CourseModule`     |
| Validation | `<Name>Validation` | `CourseValidation` |

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

## Entity Rules

- Every entity extends `BaseEntity` (provides `id`, `extra`, `is_active`, `created_at`, `updated_at`).
- **Never use raw `@Column()`** — always use custom decorators from `db.configs.ts`.
- Use `@JoinColumn({ name: '...', foreignKeyConstraintName: 'FK_<table>_<column>' })` for every FK.
- Use `@Index('IDX_<table>_<column(s)>', ['column'])` for indexes.
- Use `@Unique('UQ_<table>_<column(s)>', ['propertyA', 'propertyB'])` for unique constraints — readable names, never hash. The array contains **TS property names** (camelCase); the strategy resolves them to columns.
- For per-table PK names, pass `{ primaryKeyConstraintName: 'PK_<table>' }` to `@PrimaryGeneratedColumn(...)` on the entity (overrides `BaseEntity.id`). Without an override, TypeORM auto-generates a hash-style name.
- Computed/generated columns use `@Column({ type: '...', insert: false, update: false })`.
- **Exception — RAW-mirror entities under `admin/*/raw/model/`** (e.g. `admin/banner/raw/`, `admin/planner/raw/`) are exempt from the `extends BaseEntity` and "never raw `@Column()`" rules. They are intentional 1:1 mirrors of an external scraping RAW database on a **separate connection**, so `BaseEntity`'s `id`/`extra`/`is_active`/`created_at`/`updated_at` semantics and the custom domain decorators don't apply; they map external shapes verbatim (raw `@Column({ type: ... })`, `char(64)` content hashes, raw `jsonb` payloads). Naming conventions (`PK_`/`FK_`/`UQ_`/`IDX_`) still apply.

### Custom Column Decorators

All from `src/commons/configs/db.configs.ts`:

| Decorator              | Type                          | Default           |
| ---------------------- | ----------------------------- | ----------------- |
| `@EmailColumn()`       | VARCHAR(254)                  | null              |
| `@NameColumn()`        | VARCHAR(255)                  | ''                |
| `@CodeColumn()`        | VARCHAR(50), UNIQUE           | required          |
| `@PasswordColumn()`    | VARCHAR(255), `select: false` | required          |
| `@PhoneColumn()`       | VARCHAR(20)                   | '-'               |
| `@TextShortColumn()`   | VARCHAR(100)                  | ''                |
| `@TextMediumColumn()`  | VARCHAR(1000)                 | ''                |
| `@TextLargeColumn()`   | VARCHAR(5000)                 | ''                |
| `@TextFullColumn()`    | TEXT                          | ''                |
| `@IntegerFKIDColumn()` | INT                           | required          |
| `@IntegerColumn()`     | INT                           | 0                 |
| `@DecimalColumn()`     | NUMERIC(12,6)                 | 0.0               |
| `@BooleanColumn()`     | BOOLEAN                       | true              |
| `@DateColumn()`        | TIMESTAMPTZ                   | CURRENT_TIMESTAMP |
| `@JsonColumn()`        | JSONB                         | '{}'              |

All decorators accept `BaseOptions`:

```typescript
type BaseOptions = Partial<ColumnOptions> & {
	unique?: boolean;
	indexed?: boolean; // creates a non-unique index
	indexName?: string; // custom index name (default: IDX_<Entity>_<Column>)
	withDefault?: boolean;
};
```

## Database Access (Repository Boundary)

- **All database access lives in the repository (`core/<module>.repository.ts`), never in the service.** A service must not import or inject `DataSource`/`EntityManager`, must not call `.query(...)`, and must not build query builders. Any read, write, raw SQL, or PostgreSQL-function call belongs in a repository method that the service calls.
- This applies to raw SQL too: if a query genuinely needs raw SQL (per the [Raw SQL convention](#raw-sql-convention)), it goes in a repository method — not inline in the service.
- The service orchestrates (validation, mapping entities → response DTOs, i18n, business rules); the repository is the only layer that touches the DB.
- **Legacy note:** several existing services still violate this (raw SQL/`DataSource` in the service). They are being migrated incrementally — when you touch such a service, move its DB access into the repository as part of the change.

## Database & Migrations

- **`synchronize: false`** — always use migrations, never auto-sync.
- **`autoLoadEntities: true`** — entities are registered via `TypeOrmModule.forFeature()` in each module.
- Migration CLI config: `src/database/typeorm.config.ts` (uses glob for entities since it runs outside NestJS).
- **ALWAYS create the migration file with the CLI so the timestamp is correct — never hand-write the filename or pick a timestamp by hand.** Before writing any migration, run:

  ```bash
  pnpm migration:create src/database/migrations/<kebab-case-name>
  ```

  This stamps the file with the current epoch (`Date.now()`), which guarantees it sorts **after** every existing migration. Hand-picked/round-number timestamps drift out of order and can run before their dependencies (e.g. a table created before its schema exists), which breaks a fresh database. Then fill in `up()`/`down()` by hand (see the production rule below). The file name stays kebab-case; the generated class keeps its timestamp suffix.

- `pnpm migration:generate src/database/migrations/<Name>` autogenerates SQL by diffing entities against a **live** DB connection. It also stamps a correct timestamp, but prefer hand-written `up()`/`down()` per the production rule below.
- **The database is now in production. ALWAYS add a new, forward-only migration for every schema change (new column, table, index, constraint, type, etc.) — never edit the initial `1700000000000-initial-migration.ts` or any already-applied migration in place.** Editing an applied migration will not run against the production DB (its row already exists in the `migrations` table) and will desync environments. Every new migration must implement both `up()` and a correct `down()`.
- Naming: indexes `IDX_<table>_<columns>`, FKs `FK_<table>_<column>`, unique constraints `UQ_<table>_<columns>`, primary keys `PK_<table>` — **always uppercase prefix, always human-readable** (never the auto-generated hash form like `PK_4689ce4c54254910a1e7ab56b1c`).
- Seeds use the `i18n(es, en)` helper for JSONB display strings: `'${i18n('Spanish', 'English')}'::jsonb`.
- Seeds use `hashPassword()` from `src/libs/secure.functions.ts` for demo passwords.

## i18n Key Convention

All user-facing strings returned by the API are i18n keys, **never raw text**.

### Pattern

```
error.<module>.<key>     # e.g., error.course.nameExists
success.<type>           # e.g., success.ok, success.created
```

### Where Keys Are Defined

Each module has `config/strings/<module>.validation.ts`:

```typescript
export const coursesValidationStrings = {
	error: {
		nameExists: 'error.course.nameExists',
		notFound: 'error.course.notFound',
	},
	result: {
		createFailed: 'error.course.createFailed',
		updateFailed: 'error.course.updateFailed',
		deleteFailed: 'error.course.deleteFailed',
	},
};
```

### Global Keys (from AllExceptionsFilter)

| Key                    | HTTP Status | When                                           |
| ---------------------- | ----------- | ---------------------------------------------- |
| `success.ok`           | 200         | Successful response                            |
| `success.created`      | 201         | Resource created                               |
| `error.validation`     | 400         | class-validator failures (details in `data[]`) |
| `error.badRequest`     | 400         | Non-i18n 400 exception                         |
| `error.unauthorized`   | 401         | Non-i18n 401 exception                         |
| `error.forbidden`      | 403         | Non-i18n 403 exception                         |
| `error.notFound`       | 404         | Generic not found (BaseRepository)             |
| `error.conflict`       | 409         | Non-i18n 409 exception                         |
| `error.internalServer` | 500         | Unhandled exception                            |

### Rule

The global exception filter (`AllExceptionsFilter`) maps domain errors (`src/commons/domain-error.ts`) to HTTP via their `kind`, and also handles NestJS `HttpException`s. For both, it checks the message/key against `/^(error|success|warning)\./`. If it matches, the key passes through. If not, it's replaced with a status-based default and the original message is logged server-side at `warn` level.

**Never throw exceptions with raw text messages.** Always use i18n keys from validation strings.

## Validation Pattern

### Business Rule Validation (in `core/<module>.validation.ts`)

Validation classes belong to the domain layer and **must not couple to HTTP**. Throw the domain
errors from `src/commons/domain-error.ts` (`BadRequestError`, `NotFoundError`, `ConflictError`,
`ForbiddenError`, `UnauthorizedError`) — never `HttpException`/`HttpStatus` or the NestJS sugar
exceptions. `AllExceptionsFilter` maps each error's `kind` to the HTTP status and i18n response.

```typescript
import { BadRequestError } from 'src/commons/domain-error';

export class CourseValidation {
	static async validateCreate(repo: CourseRepository, data: any) {
		const errors: string[] = [];
		const exists = await repo.findOneByCondition({ where: { name: data.name } });
		if (exists) errors.push(coursesValidationStrings.error.nameExists);
		if (errors.length > 0) {
			throw new BadRequestError({ message: coursesValidationStrings.result.createFailed, errors });
		}
	}
}
```

Each domain error accepts either an i18n key string or `{ message, errors }`. Services (the
application layer) may still throw NestJS `HttpException`s for transport-level concerns.

### DTO Validation (in `model/<module>.dtos.ts`)

```typescript
export class CreateCourseDto {
	@IsString()
	@Length(1, 50)
	code: string;

	@IsObject()
	name: I18nText;
}

export class UpdateCourseDto {
	@IsOptional() // Every field in Update DTOs must be @IsOptional()
	@IsString()
	code?: string;
}
```

### Service calls validation before CRUD:

```typescript
async create(dto: CreateCourseDto, manager?: EntityManager) {
  await CourseValidation.validateCreate(this.repository, dto);
  return await super.create(dto, manager);
}
```

## Auth & Guards

Three decorators control access:

| Decorator                                | JWT Required | Permission Check |
| ---------------------------------------- | ------------ | ---------------- |
| `@Public()`                              | No           | No               |
| `@SkipPermissions()`                     | Yes          | No               |
| `@RequirePermission({ module, action })` | Yes          | Yes              |

Default (no decorator): JWT required + permissions required. If endpoint has no `@RequirePermission`, `PermissionsGuard` throws `error.auth.noPermissionsConfigured`.

**Authorization belongs in `@RequirePermission`, not in controller bodies.** Do not hand-roll inline role/admin checks (e.g. reading `req.user.user.isAdmin` and throwing). Access control is centralized in the guard layer so it can be managed consistently across the codebase.

**JWT payload** (set by `JwtStrategy.validate()`):

```typescript
req.user = {
  userId: number,
  roles: [{ id, code, name }],
  permissions: [{ id, code, module, route, permissions: string[] }],
  school_id: number,
};
```

A user holds one or more `roles`, and `permissions` is the **union** of every role's
permissions (merged per module). There is no "active role" — access is the combination of all
assigned roles.

JWT is extracted from `Authorization: Bearer <token>` header OR `access_token` httpOnly cookie.

### Reading the authenticated user

Read the request user with the typed `@CurrentUser()` param decorator — **never** inject `@Req()`/`@Request()` to read `req.user`, and never type the user as `any`:

```typescript
import { CurrentUser } from 'src/modules/auth/protocols/jwt/decorators/current-user.decorator';
import type { RequestUser } from 'src/modules/auth/model/authorization.types';

async getMyAccess(@CurrentUser() user: RequestUser) {
  return parseSuccessResponse(await this.service.getMyAccess(user.userId));
}
```

`RequestUser` (`{ userId, roles, permissions }`) is the single shape for the request user. A service that needs the user accepts `RequestUser` (or just the `userId`/roles it needs) — never an inline or `any` payload. The **only** place allowed to touch the raw `request.user` is a guard (param decorators don't work there), and it must still type it as `Request & { user?: RequestUser }`.

**Admin / role checks:** never compare a role code against a string literal (`role.code === 'ADMIN'`). Use `isAdmin(user)` (true when **any** of the user's `roles` is admin) or `isAdminRole(role)` for a single role, both from `src/modules/auth/model/authorization.functions.ts`, which compare against `ROLE_CODES` in `src/shared/constants/role-codes.ts`. Access control (who may call an endpoint) still belongs in `@RequirePermission`; `isAdmin*` is only for data-scoping or UI-hint decisions, not for gating endpoints.

## Scope Headers (School / Modality / Academic Period)

The frontend always sends the active **school**, **modality**, and **academic period** as request
headers. These three values are the global scope of the app — **always read them from the header,
never from the request body, query string, or route params**, unless a task explicitly says to take
a given one from the query (e.g. a comparison screen that spans periods).

Read them only through the dedicated param decorators (each pairs a value decorator with a Swagger
header decorator — apply both):

| Scope           | Header                 | Param decorator       | Swagger decorator            |
| --------------- | ---------------------- | --------------------- | ---------------------------- |
| School          | `X-School-Id`          | `@SchoolId()`         | `@ApiSchoolHeader()`         |
| Modality        | `X-Modality-Type-Id`   | `@ModalityTypeId()`   | `@ApiModalityTypeHeader()`   |
| Academic period | `X-Academic-Period-Id` | `@AcademicPeriodId()` | `@ApiAcademicPeriodHeader()` |

All live in `src/modules/auth/protocols/jwt/decorators/`. Pass `{ optional: true }` to the value
decorator (and `false` to the Swagger one) when the scope is genuinely optional; otherwise a missing
header throws a `400`. Do **not** add `schoolId` / `modalityTypeId` / `academicPeriodId` fields to a
Filter/Create/Update DTO to carry scope — the controller injects them from the header and passes them
to the service explicitly.

## Cookie Constants

Defined in `src/libs/secure.functions.ts`:

| Cookie                  | httpOnly | secure         | sameSite | Purpose                     |
| ----------------------- | -------- | -------------- | -------- | --------------------------- |
| `access_token`          | true     | true           | lax      | JWT token                   |
| `school`                | false    | true           | lax      | `{ id, code }` for frontend |
| `microsoft_oauth_state` | true     | NODE_ENV-based | lax      | CSRF state for OAuth        |

TTL for access/school cookies: `JWT_EXPIRES_IN_SECONDS * 1000` (1 hour).

## Response Format

Every API response follows `ResponseDto`:

```json
{
  "code": 200,
  "message": "success.ok",
  "data": { ... }
}
```

Errors:

```json
{
	"code": 400,
	"message": "error.course.createFailed",
	"data": ["error.course.nameExists"]
}
```

Validation errors:

```json
{
	"code": 400,
	"message": "error.validation",
	"data": ["name must be a string", "code should not be empty"]
}
```

## Swagger / Routes Pattern

Routes defined in `config/<module>.routes.ts`:

```typescript
export const coursesRoutes = {
	route: 'courses',
	tag: 'Courses',
	operation: {
		create: { method: 'POST', route: '/create', summary: 'Create course' },
		update: { method: 'PUT', route: '/update/:id', summary: 'Update course' },
		delete: { method: 'DELETE', route: '/delete/:id', summary: 'Delete course' },
		getAll: { method: 'GET', route: '/get-all', summary: 'List courses' },
		getById: { method: 'GET', route: '/get-by-id/:id', summary: 'Get course' },
		getByFilters: { method: 'POST', route: '/get-by-filters', summary: 'Filter courses' },
	},
};
```

Swagger decorators in `api/docs/<module>.swagger.ts`:

```typescript
export const SwaggerCourseCreate = () =>
	HttpMethodWithSwagger({ ...cfg.operation.create, body: CreateCourseDto });
```

Controllers apply swagger decorators and delegate to `super`:

```typescript
@SwaggerCourseCreate()
@RequirePermission({ module: 'COURSES', action: 'POST' })
async create(@Body() dto: CreateCourseDto) {
  return await super.create(dto);
}
```

## Module Declaration Pattern

```typescript
@Module({
	imports: [TypeOrmModule.forFeature([CourseEntity])],
	controllers: [CourseController],
	providers: [CourseService, CourseRepository],
	exports: [CourseService, CourseRepository],
})
export class CourseModule {}
```

Always export Service + Repository for cross-module consumption.

## Mail

All email goes through `MailService` (`src/modules/mail/mail.service.ts`) which uses Postmark:

```typescript
await this.mailService.sendRawEmail({
	to: 'user@example.com',
	cc: ['cc@example.com'],
	subject: 'Subject',
	html: '<p>Body</p>',
});
```

## Testing

- Test files use `.spec.ts` suffix, co-located with source files.
- Every `core/<module>.validation.ts` must have a `core/<module>.validation.spec.ts`.
- Mock pattern for validation tests:

```typescript
import { DomainError } from 'src/commons/domain-error';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
};

describe('CourseValidation', () => {
	beforeEach(() => jest.clearAllMocks());

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				CourseValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(DomainError);
		});
	});
});
```

- Run tests: `pnpm test` or `npx jest --no-coverage`
- Run specific: `npx jest --no-coverage src/path/to/file.spec.ts`

## Environment Variables

All env vars must be declared in `src/commons/configs/env.config.ts` with Zod validation. Required vars fail at bootstrap; optional vars use `.optional()`.

Key groups:

- **App:** `NODE_ENV`, `LOG_LEVEL`, `APP_PORT`, `APP_FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`
- **Database:** `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`, `DB_POOL_*`
- **Auth:** `JWT_SECRET`, `APP_SECRET`, `COOKIE_SECRET`
- **Microsoft OAuth:** `ID_DIRECTORY_TENANT`, `ID_APPLICATION_CLIENT`, `MICROSOFT_SECRET`, `MICROSOFT_BASE_URL`, `URL_REDIRECT`
- **Mail:** `POSTMARK_API_KEY`, `POSTMARK_FROM_EMAIL`, `POSTMARK_MESSAGE_STREAM`
- **Survey:** `SURVEY_BASE_URL`, `SMTP_*` (legacy, being migrated)
- **Other:** `PUPPETEER_EXECUTABLE_PATH`

Use `configService.get<T>('KEY')` to read. Use `configService.getOrThrow<T>('KEY')` when the var is guaranteed to exist (avoids `!` assertions).

## Shared Types

```typescript
// src/shared/types/i18n.ts
export type I18nText = Record<string, string>;  // { es: '...', en: '...' }

export const toI18n = (text: I18nText | string): I18nText => { ... };
export const i18nText = (val: I18nText | string | null | undefined): I18nText | null => { ... };
export const i18nTrim = (val: I18nText | null | undefined): string | null => { ... };
```

Use these shared helpers — never redeclare them locally.

## Security Decisions (Accepted Risks)

These are acknowledged and intentionally not fixed:

- DB TLS verification disabled (`rejectUnauthorized: false`)
- No rate limiting (mitigate at WAF/reverse proxy)
- No account lockout
- No Helmet/CSP headers
- No CSRF protection (cookie + bearer dual-mode auth)
- No JWT invalidation on password change
- `DB_TYPE as any` cast (TypeORM discriminated union limitation)

## Don'ts

- **Don't add comments that restate the code — comment only complex/high-reasoning logic and keep code self-explanatory.**
- **Don't create barrel/index.ts files.**
- **Don't use raw `@Column()` — use custom decorators.**
- **Don't throw exceptions with raw text — use i18n keys.**
- **Don't couple domain validation to HTTP — `core/*.validation.ts` throws domain errors from `src/commons/domain-error.ts`, never `HttpException`/`HttpStatus`.**
- **Don't use nodemailer directly — use `MailService`.**
- **Don't use `any` in base class signatures.**
- **Don't use `process.env` directly — use `ConfigService`.**
- **Don't use `synchronize: true` — use migrations.**
- **Don't hand-pick a migration filename or timestamp — run `pnpm migration:create src/database/migrations/<kebab-case-name>` so the timestamp is current and monotonic.**
- **Don't read `req.user` via `@Req()`/`@Request()` or type the user as `any` — use the typed `@CurrentUser()` decorator with `RequestUser` (guards are the only exception).**
- **Don't compare role codes against string literals (e.g. `role.code === 'ADMIN'`) — use `isAdmin`/`isAdminRole` with `ROLE_CODES`.**
- **Don't write FK/index names with lowercase prefix — use `FK_` and `IDX_`.**
- **Don't skip `@IsOptional()` on Update DTO fields** (unless the field is intentionally required like `id`).
- **Don't add `@nestjs/schedule` — it was removed as unused.**
- **Don't use `snake_case` for TS identifiers, DTO fields, URL params, or JSON wire keys** — TypeScript stays `camelCase`; `SnakeNamingStrategy` bridges to `snake_case` DB columns. Use `snake_case` only for raw SQL column references, `@JoinColumn({ name })`, `@Index('IDX_...')`, and `@Entity({ name })` table names.
- **Don't access raw SQL result rows by `snake_case`** — alias columns as `"camelCaseName"` (double-quoted) in the query and read `row.camelCaseName`.
- **Don't hand-roll inline role/admin checks (e.g. `req.user.user.isAdmin`) — gate access with `@RequirePermission`.**
- **Don't put admin-only modules under their feature domain** — admin responsibilities live under `modules/admin/<domain>/<module>`.
