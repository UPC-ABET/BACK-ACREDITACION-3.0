# Design — Reset chart node users' password to default, scoped by entity type

**Slug**: `chart-password-reset`
**Proposal**: `./proposal.md`

## Read first

Where this design started, in the order it was read.

- `./proposal.md` — the ticket. DEAN's global-per-period scope, unlinked-user
  skip-and-report, no audit trail, and backend-only are settled; do not reopen them.
- `docs/POLICIES.md` § Database Access (Repository Boundary), § Validation Pattern,
  § i18n Key Convention, § Auth & Guards, § Scope Headers, § Module Declaration Pattern,
  § Testing.
- `docs/CONTEXT.md` § Database, § Domain Vocabulary, § Business Rules (the chart entity
  uniqueness rule and the Program-ancestor rule — this change reads the same tree, writes
  none of it).
- `docs/adr/` — all four existing ADRs are scraping/export/credentials-for-external-systems
  related; none touch charts or application-user credentials.
- `openspec/specs/unique-chart-entity-per-period/` — prior art for a chart-adjacent change
  in this exact module: its design.md's structure (Read first → ADR gate → per-AC approach)
  is followed here, and its `ChartRepository`/`ChartHeadsRepository` code is what this
  design reuses.
- `src/modules/organization/charts/model/charts.entity.ts` — `ChartEntity`: `staffId`
  (not nullable), `entityTypeId`/`entityCode` (nullable), `rootChartId` (adjacency list).
- `src/modules/organization/charts/core/charts.repository.ts` — `getSchoolChartNode`,
  `getMaintenanceBranch` (the exact recursive-CTE scoping this change's new query mirrors).
- `src/modules/organization/charts/api/charts.service.ts` — `getMaintenanceTree`: how
  `rootChartId = school.rootChartId ?? school.id` is derived; this change reuses that.
- `src/modules/organization/charts/api/charts.controller.ts`, `config/charts.routes.ts`,
  `api/docs/charts.swagger.ts` — the existing `/maintenance/*` routes this adds a sibling to.
- `src/modules/organization/staff/model/staff.entity.ts` — `StaffEntity.userId`, nullable.
- `src/modules/organization/users/api/users.service.ts` — `UserService.create()`'s
  `hashPassword(configService.getOrThrow('DEFAULT_USER_PASSWORD'))`, the exact default-
  password mechanism this change reuses (not reimplements).
- `src/modules/organization/users/core/users.repository.ts` — existing bulk-by-id patterns
  (`findDisplayNamesByIds`) and raw-SQL style for the new sibling method.
- `src/modules/organization/users/users.module.ts` — confirms `UserService`/`UserRepository`
  are already exported for cross-module consumption, and that `UserModule` does not import
  `ChartModule` (checked by grep — no circular import risk).
- `src/modules/admin/organization/chart-heads/core/chart-heads.repository.ts` — precedent
  for a chart-adjacent repository reaching into `organization.staff`/`organization.users`
  directly with raw SQL; considered and **not** followed (see Approach, AC-1).
- `src/shared/constants/permission-modules.ts` — `PERMISSION_MODULES`/`PERMISSION_ACTIONS`.

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Datastore, broker or cache choice             | No                                                                                                                                                                                         |
| Auth or payments provider                     | No                                                                                                                                                                                         |
| Public API contract change or breaking change | No — new, additive endpoint; no existing route, DTO or response shape changes                                                                                                              |
| New module boundary or cross-repo split       | No — `ChartModule` importing `UserModule` uses the existing export-Service-and-Repository convention (§ Module Declaration Pattern), already exercised elsewhere; no new module is created |
| Language, runtime or framework                | No                                                                                                                                                                                         |
| Contradicting an existing ADR                 | No — none of the four existing ADRs touch charts or application-user credentials                                                                                                           |

**Conclusion**: no ADR required.

## Approach

### AC-1 / AC-2 — Selected-type nodes in the school's tree get reset; unselected types don't

The scoping query is a near-duplicate of `getMaintenanceBranch`'s recursive CTE
(`charts.repository.ts:130-171`) — same anchor (`rootChartId`), same rule for only
descending into the triggering school's branch (`b.depth > 0 OR c.id = schoolChartId`) —
because the reset action's scope must be **exactly** what the maintenance screen already
shows for that school, not a re-derived approximation of it. A new, narrower method is
added rather than reusing `getMaintenanceBranch` itself, because that method builds a
nested tree for rendering (with `title`, resolved entity names, etc.) and this action only
needs a flat list of `(chartId, entityTypeCode, staffId, userId)` filtered to the selected
types — reusing it would mean building the tree and then flattening it back down.

```typescript
// ChartRepository
async findChartUsersByTypes(
  rootChartId: number,
  schoolChartId: number,
  entityTypeCodes: string[],
): Promise<Array<{ chartId: number; entityTypeCode: string; staffId: number; userId: number | null }>>
```

```sql
WITH RECURSIVE branch AS (
  SELECT c.id, c.root_chart_id, 0 AS depth
  FROM organization.charts c
  WHERE c.id = $1 AND c.is_active = true
  UNION ALL
  SELECT c.id, c.root_chart_id, b.depth + 1
  FROM organization.charts c
  INNER JOIN branch b ON c.root_chart_id = b.id
  WHERE c.is_active = true AND (b.depth > 0 OR c.id = $2)
)
SELECT
  c.id       AS "chartId",
  et.code    AS "entityTypeCode",
  c.staff_id AS "staffId",
  s.user_id  AS "userId"
FROM branch b
INNER JOIN organization.charts c ON c.id = b.id
INNER JOIN organization.staff  s ON s.id = c.staff_id
LEFT JOIN core.types           et ON et.id = c.entity_type_id
WHERE et.code = ANY($3::text[])
ORDER BY c.id
```

A node with `entityTypeId IS NULL` (an untagged node, per `CONTEXT.md`) never matches any
code in `$3`, so it is excluded with no special-casing needed — the same reasoning
`ChartValidation`'s null-exemption already relies on for `entityCode`.

**This duplicates the branch CTE literal from `getMaintenanceBranch` rather than sharing
it.** Both must be kept in sync if the tree-scoping rule ever changes (e.g. what "only this
school's branch" means) — flagged with a comment cross-referencing the two methods, the
same way `ChartRepository.translateDuplicateNode` and `ChartHeadsRepository`'s copy of it
are already cross-referenced in this codebase. Extracting a shared SQL fragment was
considered and rejected: the two queries' `SELECT`/`JOIN` clauses differ enough (nested
tree with resolved names vs. a flat filtered projection) that sharing only the `WITH`
clause as a string constant adds string-composition complexity for a five-line CTE that is
easy to eyeball for drift.

`ChartService.getMaintenanceTree`'s `rootChartId = school.rootChartId ?? school.id`
(`charts.service.ts:54`) is extracted into a private `resolveTreeRoot(school)` helper reused
by both `getMaintenanceTree` and the new `resetMaintenancePasswords`, so the two methods
cannot compute the root differently.

### AC-3 — DEAN reset is global-per-period, independent of the triggering school

No special case needed. `DEAN` sits at `rootChartId`'s node itself (depth 0 in the branch
CTE, always included), and every School under one academic period shares the same Dean
chart node (`school.rootChartId` points at it). Requesting the reset from School A or
School B for the same `academicPeriodId` resolves the identical `rootChartId`, so
`findChartUsersByTypes` returns the same Dean row from either school's screen. Resetting
that user twice (once per school, in two separate calls) is idempotent — the second call
just re-hashes the same default password.

For an academic period whose School header itself has no Dean above it
(`school.rootChartId === null`, so `resolveTreeRoot` returns `school.id`), the branch has
no Dean node at all — selecting `DEAN` then matches zero rows, which is AC-7, not an error.

### AC-4 — SCHOOL reset is scoped to the triggering school only

Structural, not a filter to write: the branch CTE's second arm only descends past depth 0
into the id passed as `schoolChartId`, so a sibling school's subtree — including its own
`SCHOOL`-type node — is never part of the `branch` CTE rows in the first place. There is
nothing to exclude because it was never included.

### AC-5 — A node with no linked user is skipped and reported, not an error

`findChartUsersByTypes` returns `userId: null` for such a node (the `LEFT JOIN`
`organization.staff` → `organization.users` chain never fails; `staff.user_id` itself is
what's null). `ChartService.resetMaintenancePasswords` partitions the flat row list in
plain TypeScript — no repository round-trip, no validation class:

```typescript
const rows = await this.repository.findChartUsersByTypes(rootChartId, school.id, entityTypeCodes);
const skipped = rows.filter((r) => r.userId === null);
const linked = rows.filter((r): r is typeof r & { userId: number } => r.userId !== null);
```

`skipped` rows are returned as-is (`chartId`, `staffId`, `entityTypeCode`) — enough for an
admin to look the staff member up and decide whether to link them a login first.

### AC-6 — A user reachable via multiple in-scope nodes is reset once

`linked` rows are grouped by `userId` before any write:

```typescript
const chartIdsByUser = new Map<number, number[]>();
for (const row of linked) {
	chartIdsByUser.set(row.userId, [...(chartIdsByUser.get(row.userId) ?? []), row.chartId]);
}
```

`Array.from(chartIdsByUser.keys())` — one entry per distinct user — is what actually gets
passed to the password reset call, so a user behind two nodes is written to exactly once
regardless of how many rows referenced them.

### AC-7 — Zero matching linked users returns success with an empty result

`getSchoolChartNode` returning `null` (no chart configured yet for this school/period —
the same condition `getMaintenanceTree` already handles by returning `null`) and
`chartIdsByUser` being empty after grouping are both short-circuited to
`{ reset: [], skipped }` without calling into `UserService` at all — no error is invented
for either case, mirroring how `getMaintenanceTree` already treats a missing school chart
as "nothing to show," not a 404.

### AC-8 — Unauthorized caller is rejected via permission guard

> **Superseded 2026-08-25 — see `tasks.md` § Audit fixes, Task R1.1.** The reasoning below
> (`ORGANIZATION`/`POST`) was the original design call and is kept here for the record, but
> `/abet-audit-pr` found it let a caller scoped to one school force-reset the cross-school
> Dean's password, since Dean is a shared root (§ AC-3 above). The requester's explicit fix
> was to gate the **entire** endpoint behind `PERMISSION_MODULES.ADMIN` instead — the
> opposite of the "considered and rejected" conclusion below. `tasks.md` R1.1 is the current
> source of truth for the permission this endpoint actually requires; do not re-derive it
> from this paragraph.

`@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action: PERMISSION_ACTIONS.POST })`
— the same module/action already guarding `maintenanceCreate` (`charts.controller.ts:95`).
**Decision, not a default carried over unexamined**: this reset action is reachable only
from the same organization-chart-maintenance screen the other `/maintenance/*` endpoints
serve, to the same admin audience already trusted to create/update/delete chart nodes and
reassign the staff behind them. `PERMISSION_MODULES.ADMIN` (used by `chart-heads`, a
different, separately-gated pre-configuration screen for the read-only DEAN/SCHOOL/PROGRAM
trio) was considered and rejected: inventing a narrower permission for one action on a
screen whose other four actions already require `ORGANIZATION`/`POST` et al. would let an
admin edit a node's staff assignment but not reset that same staff's password, a
distinction the proposal never asked for and the UI has no way to represent. If a future
requirement wants the reset gated more tightly than chart maintenance itself, that is a new
permission action's proposal, not a guess made here.

### AC-9 — Response reports reset + skipped, never the password value

The default password is hashed exactly once per call (`hashPassword` is expensive by
design — bcrypt, 12 rounds — and every reset in one call is the same value, so hashing it
once and reusing the hash for every affected row is both correct and avoids N redundant
bcrypt rounds):

```typescript
// UserService
async resetPasswordsToDefault(
  userIds: number[],
): Promise<Array<{ id: number; firstName: string; lastName: string }>> {
  if (userIds.length === 0) return [];
  const passwordHash = await hashPassword(this.configService.getOrThrow<string>('DEFAULT_USER_PASSWORD'));
  return await this.repository.resetPasswordsByIds(userIds, passwordHash);
}
```

```typescript
// UserRepository
async resetPasswordsByIds(
  userIds: number[],
  passwordHash: string,
): Promise<Array<{ id: number; firstName: string; lastName: string }>> {
  return await this.dataSource.query(
    `UPDATE organization.users
     SET password = $1, updated_at = NOW()
     WHERE id = ANY($2::int[])
     RETURNING id, first_name AS "firstName", last_name AS "lastName"`,
    [passwordHash, userIds],
  );
}
```

The `UPDATE ... RETURNING` gives `ChartService` the display names to enrich the response
without a second round trip, and — because this concept ("the default password", its env
var, its hashing) is a `users` module business rule, not a `charts` one — it stays inside
`UserService`/`UserRepository` rather than being re-implemented in `charts`. This is why
`ChartService.resetMaintenancePasswords` depends on `UserService` (exported by
`UserModule`, per § Module Declaration Pattern) rather than either reaching into
`UserRepository` directly (would duplicate the hashing/env-var logic that already lives in
`UserService.create()`) or having `ChartRepository` run raw SQL against
`organization.users` itself (the `chart-heads` precedent for that does structural
staff↔user _linking_, not the password/credential concern this change owns).

`ChartService` then merges the two: password-hash/name-fetch by `UserService`, chart-id
grouping by itself:

```typescript
const updated = await this.userService.resetPasswordsToDefault([...chartIdsByUser.keys()]);
const reset = updated.map((u) => ({
	userId: u.id,
	firstName: u.firstName,
	lastName: u.lastName,
	chartIds: chartIdsByUser.get(u.id)!,
}));
return { reset, skipped };
```

Neither the plaintext default password nor its hash ever leaves `UserService`/
`UserRepository`; the response the controller sends back carries only ids, names and chart
ids.

## Backend

- **Module**: `src/modules/organization/charts/` (new endpoint), plus one new method each
  on `src/modules/organization/users/api/users.service.ts` and
  `src/modules/organization/users/core/users.repository.ts`.
- **Entities / migrations**: none. No schema change — the query reads existing columns,
  the write is a plain `UPDATE organization.users SET password = ...`.
- **Endpoint**: `POST /charts/maintenance/reset-password`.
  - Headers: `X-Academic-Period-Id` (`@AcademicPeriodId()`), `X-School-Id` (`@SchoolId()`)
    — both required, exactly like `GET /charts/maintenance/tree`.
  - Body: `ResetMaintenancePasswordsDto { entityTypeCodes: string[] }`, validated with
    `@IsArray() @ArrayNotEmpty() @ArrayUnique() @IsIn(Object.values(TYPE_CODES.ENTITY_TYPE), { each: true })`
    — the same `TG903-Txxx` codes the tree endpoint already returns as
    `entityType.code`, so the frontend sends back exactly what it already has, no new
    vocabulary.
  - Response: `{ reset: Array<{ userId, firstName, lastName, chartIds: number[] }>, skipped: Array<{ chartId, staffId, entityTypeCode }> }`.
- **Guards / scope**: `@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })` — changed from the original `ORGANIZATION`/`POST` call per the audit fix (see the superseded note under AC-8 and `tasks.md` R1.1). `@ApiAcademicPeriodHeader()` / `@ApiSchoolHeader()` for Swagger.
- **i18n keys**: none new. No new error path is introduced — a missing/not-yet-configured
  school chart and an empty selected-type match are both success responses (AC-7), and DTO
  shape violations already fall through to the global `error.validation` key.
- **Validation**: DTO-level only (`class-validator`, above). No new `ChartValidation`
  method — there is no business rule to reject here beyond "the request shape is valid";
  adding a validation class for a check that cannot fail would be dead code.
- **Routes / Swagger**: `chartsRoutes.charts.operation.maintenanceResetPasswords` in
  `config/charts.routes.ts`; `SwaggerChartMaintenanceResetPasswords` in
  `api/docs/charts.swagger.ts`, following the existing `maintenanceCreate` pattern.
- **Module wiring**: `ChartModule` imports `UserModule` and `ChartService`'s constructor
  gains `private readonly userService: UserService`. Checked for cycles: `UserModule`
  imports `TypeOrmModule`, `OrgScopeModule`, `MailModule`, `EmailTemplateModule` only — none
  of which import `ChartModule` — so this does not create a circular module dependency.

## Testing strategy

| AC  | Covered by                                                                                                                                                                                                                                                                                                      | Kind                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | `charts.service.spec.ts` — selected types resolve to the right rows; `charts.repository.spec.ts` — `dataSource.query` is mocked, asserts `findChartUsersByTypes` binds `(rootChartId, schoolChartId, entityTypeCodes)` in that order and returns whatever rows resolve                                          | unit                 |
| 2   | `charts.service.spec.ts` — a subset selection leaves other in-scope rows out of the grouped result                                                                                                                                                                                                              | unit                 |
| 3   | Real DEAN row returned identically regardless of which school's `schoolChartId` is passed                                                                                                                                                                                                                       | **manual** → runbook |
| 4   | A second school's `SCHOOL`/`PROGRAM` nodes never appear in the result set                                                                                                                                                                                                                                       | **manual** → runbook |
| 5   | `charts.service.spec.ts` — a row with `userId: null` lands in `skipped`, not `reset`, no throw                                                                                                                                                                                                                  | unit                 |
| 6   | `charts.service.spec.ts` — two rows with the same `userId` produce one `reset` entry with both `chartIds`                                                                                                                                                                                                       | unit                 |
| 7   | `charts.service.spec.ts` — `getSchoolChartNode` returns `null` → `{ reset: [], skipped: [] }`; and — all matched rows unlinked → same, without calling `userService.resetPasswordsToDefault`                                                                                                                    | unit                 |
| 8   | Permission guard is exercised the same way as every other `@RequirePermission` endpoint — no new test, existing `PermissionsGuard` coverage applies                                                                                                                                                             | (existing)           |
| 9   | `users.service.spec.ts` — `resetPasswordsToDefault` hashes once and calls the repository with that hash and the full id list; response never carries `password`/`passwordHash`; `users.repository.spec.ts` — `resetPasswordsByIds` mocks `dataSource.query`, asserts params bound and empty-array short-circuit | unit                 |
| —   | End-to-end: reset a real seeded user, then log in with `DEFAULT_USER_PASSWORD`                                                                                                                                                                                                                                  | **manual** → runbook |

**Correction from the original design pass**: this codebase does not run repository specs
against a real test database — `charts.repository.spec.ts` and `users.repository.spec.ts`
both mock the injected TypeORM `Repository`/`DataSource`, never a live Postgres connection.
The established convention for a raw-SQL read method (confirmed against
`grades-rc-export.repository.spec.ts`, which states this outright: "The merge itself...
is SQL, so it is NOT exercised here — `query` is mocked... What is testable here is the
contract... everything must reach the raw query as parameters") is to mock
`dataSource.query`'s resolved value and assert the parameter-binding contract, not the
SQL's semantic correctness. AC-3 and AC-4 (the DEAN global-scope and School-isolation
behaviour) are therefore **not** unit-testable in this codebase without a real database and
move to the runbook's manual steps 1/4, which already cover exactly this. AC-1/AC-2 keep a
unit test at the repository layer because the parameter contract (which types were
requested, in what order) is itself worth asserting, even though the filtering behaviour
those parameters produce is verified manually.

## Risks

| Risk                                                                                                                                                                                    | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicated branch-CTE literal (this change's query vs. `getMaintenanceBranch`) drifts over time                                                                                         | Cross-referencing comment in both methods, matching the existing `translateDuplicateNode` duplication precedent in this same module                                                                                                                                                                                                                                                                                                                                                 |
| One shared global default password put on several live accounts in one call                                                                                                             | Accepted by requester in `proposal.md` — identical to what `UserService.create()` already does at signup, no new mechanism                                                                                                                                                                                                                                                                                                                                                          |
| No audit trail of who reset which users                                                                                                                                                 | Explicitly out of scope per `proposal.md`; response payload (ids + names) is the only record, and is not persisted                                                                                                                                                                                                                                                                                                                                                                  |
| ~~`PERMISSION_MODULES.ORGANIZATION`/`POST` is the same gate as ordinary chart-node CRUD~~ — superseded: `/abet-audit-pr` found this let a caller reset the cross-school Dean's password | Changed to `PERMISSION_MODULES.ADMIN` for the whole endpoint (`tasks.md` R1.1). Trades a real privilege-escalation hole for a new one: `ADMIN` is this codebase's coarse, all-or-nothing superuser tier (seed data grants it every module permission at once), so a school coordinator can no longer self-serve even a single course-level password reset without also gaining IAM/upload/period-config access. Not re-litigated in this round — flagged for the requester to weigh |
| Manual end-to-end verification (real login with the default password) has no automated coverage                                                                                         | Captured as the one runbook step; everything else is unit/repository-tested                                                                                                                                                                                                                                                                                                                                                                                                         |

## Docs to update in this PR

- [ ] `openapi.json` — regenerate via `pnpm openapi:export` (new route + DTO).
- [ ] No change to `docs/CONTEXT.md` — this does not introduce a new business rule beyond
      what § Business Rules already documents about chart uniqueness/hierarchy; it only
      reads that structure.
- [ ] No change to `docs/POLICIES.md` (read-only to skills) or `docs/adr/` (no ADR
      required, per the gate above).
