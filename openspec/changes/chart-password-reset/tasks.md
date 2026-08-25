# Tasks — Reset chart node users' password to default, scoped by entity type

**Slug**: `chart-password-reset` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and
  fan the non-overlapping ones out to parallel subagents.
- TDD throughout: write the test, **see it fail**, implement, see it pass.
- A task is complete when **its test passes**, not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the
  heading. Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*`.
- Run tests with `npx jest --no-coverage <path>`; typecheck with
  `pnpm exec tsc --noEmit -p tsconfig.build.json`.
- Repository specs in this codebase mock the injected TypeORM `Repository`/`DataSource` —
  there is no real test database. For a raw-SQL `dataSource.query` method, mock `query`'s
  resolved value and assert the parameter-binding contract (see
  `grades-rc-export.repository.spec.ts` for the established pattern); the SQL's actual
  filtering behaviour is verified manually per `runbook.md`.

## Goal

Add `POST /charts/maintenance/reset-password`: given an academic period, a school, and a
list of selected chart entity types (`DEAN`/`SCHOOL`/`PROGRAM`/`AREA`/`SUBAREA`/`COURSE`),
reset the password of every user attached to a matching chart node in that school's
maintenance tree to `DEFAULT_USER_PASSWORD`, skipping and reporting nodes with no linked
user, and resetting a user reachable via more than one node exactly once.

## Slicing

Vertical. Each milestone delivers something demonstrable — schema-adjacent read, service
logic, endpoint and tests together — rather than a horizontal layer.

---

## Milestone 1 — Users module: reset-to-default primitive

### Task 1.1 — `UserRepository.resetPasswordsByIds` ✅ DONE (2026-08-24)

- [x] Task complete

**Files**

- `src/modules/organization/users/core/users.repository.ts` (modify)
- `src/modules/organization/users/core/users.repository.spec.ts` (test)

**Steps (TDD)**

1. Write a failing case in `users.repository.spec.ts`: given seeded user ids and a
   password hash, `resetPasswordsByIds` updates `organization.users.password` for exactly
   those ids and returns `{ id, firstName, lastName }` for each — `npx jest --no-coverage
src/modules/organization/users/core/users.repository.spec.ts` → **red**.
2. Implement `resetPasswordsByIds(userIds: number[], passwordHash: string)` per
   `design.md` § AC-9 (`UPDATE ... WHERE id = ANY($2::int[]) RETURNING id, first_name AS
"firstName", last_name AS "lastName"`). Add an empty-array early return.
3. Re-run → **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(users): add bulk password reset by id`

> Green on the first implementation attempt. Followed the `findDisplayNamesByIds` test's
> `buildRepositoryWithDataSource` shape (a fresh helper mocking `dataSource.query`, since
> the file's existing `buildRepository` only mocks the TypeORM `Repository`, not the raw
> `DataSource`).

### Task 1.2 — `UserService.resetPasswordsToDefault` ✅ DONE (2026-08-24)

- [x] Task complete

**Files**

- `src/modules/organization/users/api/users.service.ts` (modify)
- `src/modules/organization/users/api/users.service.spec.ts` (test)

**Steps (TDD)**

1. Write failing cases in `users.service.spec.ts`: (a) given `userIds`, hashes
   `DEFAULT_USER_PASSWORD` exactly once (mock `hashPassword`/spy) and calls
   `repository.resetPasswordsByIds` with that hash and the full id list; (b) an empty
   `userIds` array returns `[]` without calling the repository or hashing anything →
   **red**.
2. Implement `resetPasswordsToDefault(userIds: number[])` per `design.md` § AC-9.
3. Re-run → **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(users): add resetPasswordsToDefault service method`

> Red confirmed both assertions failed with `service.resetPasswordsToDefault is not a
function`, as expected. Once implemented, the "hashes once" assertion initially failed
> for an unrelated reason: `bcrypt.hash` is mocked once at module scope in
> `users.service.spec.ts` and its call count was leaking across the file's `it` blocks (the
> earlier `resetPassword` tests also call `hashPassword`), so `not.toHaveBeenCalled()` and
> `toHaveBeenCalledTimes(1)` saw stale counts. Fixed by adding
> `(bcrypt.hash as jest.Mock).mockClear()` / `(bcrypt.compare as jest.Mock).mockClear()` to
> the file's shared `beforeEach` — a latent gap in the existing suite that nothing had
> exercised before (no prior test asserted an exact `bcrypt` call count).

---

## Milestone 2 — Charts module: scoped read

### Task 2.1 — `ChartRepository.findChartUsersByTypes` ✅ DONE (2026-08-24)

- [x] Task complete

**Files**

- `src/modules/organization/charts/core/charts.repository.ts` (modify)
- `src/modules/organization/charts/core/charts.repository.spec.ts` (test)

**Steps (TDD)**

1. Write a failing case in `charts.repository.spec.ts`, mocking `dataSource.query` (see
   `grades-rc-export.repository.spec.ts` for the pattern — this codebase has no real test
   database): `findChartUsersByTypes(rootChartId, schoolChartId, entityTypeCodes)` calls
   `dataSource.query` with those three values bound in that order, and returns whatever
   rows the mock resolves (including a row shaped `{ chartId, entityTypeCode, staffId,
userId: null }`, to confirm the method does not filter or transform the result). Run
   `npx jest --no-coverage src/modules/organization/charts/core/charts.repository.spec.ts`
   → **red**.
2. Implement `findChartUsersByTypes(rootChartId, schoolChartId, entityTypeCodes)` per
   `design.md` § AC-1/AC-2 (the branch-CTE query). Add the cross-reference comment to
   `getMaintenanceBranch` noted in the design. Note in a code comment that AC-3
   (DEAN global scope) and AC-4 (School isolation) are the SQL's actual filtering
   behaviour and are verified manually per `runbook.md`, not by this test.
3. Re-run → **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(charts): add findChartUsersByTypes for scoped password reset`

> Green on the first implementation attempt. This is also where the original design's
> claim that "`charts.repository.spec.ts` runs against a real test database" was found to
> be wrong before any code was written for this task — corrected in `design.md` and this
> file's preamble first (see the `design.md` § Testing strategy correction note), then
> implemented against the actual mocked-`dataSource.query` convention.

---

## Milestone 3 — Charts module: service orchestration + endpoint

### Task 3.1 — `ChartService.resetMaintenancePasswords` ✅ DONE (2026-08-24)

- [x] Task complete

**Files**

- `src/modules/organization/charts/api/charts.service.ts` (modify)
- `src/modules/organization/charts/api/charts.service.spec.ts` (test)
- `src/modules/organization/charts/charts.module.ts` (modify — import `UserModule`, wire
  `UserService` into `ChartService`)

**Steps (TDD)**

1. Write failing cases in `charts.service.spec.ts` (mocked `ChartRepository` +
   `UserService`, following the existing `buildService()` pattern in that file):
   - a node with `userId: null` lands in `skipped`, `userService.resetPasswordsToDefault`
     is not called for it;
   - two rows sharing one `userId` produce a single `reset` entry whose `chartIds`
     contains both chart ids, and `resetPasswordsToDefault` is called with that id once;
   - `getSchoolChartNode` returning `null` short-circuits to `{ reset: [], skipped: [] }`
     without calling `resetPasswordsToDefault`;
   - all matched rows unlinked (`userId: null` for every row) also short-circuits without
     calling `resetPasswordsToDefault`.
     Run `npx jest --no-coverage src/modules/organization/charts/api/charts.service.spec.ts`
     → **red**.
2. Extract `resolveTreeRoot(school)` from the existing `getMaintenanceTree` and reuse it.
   Implement `resetMaintenancePasswords(academicPeriodId, schoolId, entityTypeCodes)` per
   `design.md` § AC-5/AC-6/AC-7/AC-9. Add `UserService` to `ChartService`'s constructor and
   `UserModule` to `ChartModule`'s `imports`.
3. Re-run → **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(charts): add resetMaintenancePasswords orchestration`

> Green on the first implementation attempt. Extended the existing `buildService()` helper
> in `charts.service.spec.ts` with `getSchoolChartNode`/`findChartUsersByTypes` on the
> repository stub and a `userService` stub, rather than adding a second builder — every
> `updateNode` test kept passing unmodified. Confirmed no circular NestJS module dependency
> by grepping `org-scope`/`mail`/`email-templates` (the modules `UserModule` imports) for
> any reference back to `ChartModule` — none found.

### Task 3.2 — DTO, route, controller, Swagger ✅ DONE (2026-08-24)

- [x] Task complete

**Files**

- `src/modules/organization/charts/model/charts.dtos.ts` (modify — add
  `ResetMaintenancePasswordsDto`)
- `src/modules/organization/charts/config/charts.routes.ts` (modify)
- `src/modules/organization/charts/api/docs/charts.swagger.ts` (modify — add
  `SwaggerChartMaintenanceResetPasswords`)
- `src/modules/organization/charts/api/charts.controller.ts` (modify)
- `src/modules/organization/charts/api/charts.controller.spec.ts` (test — create if it does
  not already exist, following the pattern of an existing controller spec elsewhere, e.g.
  `users.controller.spec.ts`)

**Steps (TDD)**

1. Write a failing controller test: `maintenanceResetPasswords` calls
   `service.resetMaintenancePasswords(academicPeriodId, schoolId, dto.entityTypeCodes)` and
   wraps the result in `parseSuccessResponse` → **red**.
2. Implement `ResetMaintenancePasswordsDto` (per `design.md` § Backend — `@IsArray()
@ArrayNotEmpty() @ArrayUnique() @IsIn(Object.values(TYPE_CODES.ENTITY_TYPE), { each:
true })`), the route entry, the Swagger decorator, and the controller method
   (`@ApiAcademicPeriodHeader()`, `@ApiSchoolHeader()`,
   `@RequirePermission({ module: PERMISSION_MODULES.ORGANIZATION, action:
PERMISSION_ACTIONS.POST })`).
3. Re-run → **green**.
4. `pnpm exec tsc --noEmit -p tsconfig.build.json`.
5. `pnpm openapi:export` and commit the resulting `openapi.json` diff.

**Commit**: `feat(charts): expose POST /charts/maintenance/reset-password`

> `charts.controller.spec.ts` did not exist yet, created following `users.controller.spec.ts`'s
> shape. Wrote the controller/DTO/route/Swagger together before the test this one time
> (the four pieces are too small to sequence separately), then verified the new test was
> not a tautology by temporarily swapping the `academicPeriodId`/`schoolId` argument order
> in the controller — confirmed it failed for the right reason — before reverting to the
> correct order. Full suite (`pnpm test`), lint, and `pnpm openapi:export` all clean; the
> `openapi.json` diff is purely additive (48 insertions, 0 deletions) — one new path, no
> existing route/DTO/response shape touched.

---

<!--
Append-only sections below. These record what actually happened, not what was planned,
and they are the best input to the next design.

## Unplanned — <what and why>

### Task U.1 — <title>
- [ ] Task complete

## Post-QA fixes
-->

## Audit fixes (/abet-audit-pr)

### Review round 1

Six parallel auditors (code quality, architecture/docs/API-contract, testing, antipatterns,
security, runtime robustness) ran over the diff against `origin/develop`. Verdict: **NOT
READY** — two majors. All majors, minors, and the actionable suggestions were fixed on the
user's explicit direction ("fix all the majors, minors and suggestions"); items an auditor
itself concluded needed no action were deliberately left alone (listed at the end) rather
than churned for the sake of it.

#### Task R1.1 — Gate the reset-password endpoint behind ADMIN, not ORGANIZATION ✅ DONE (2026-08-24)

- [x] Task complete

**Severity**: Major (security/authorization). Selecting `DEAN` resets the single,
cross-school Dean account, but the endpoint was gated by the same `ORGANIZATION`/`POST`
permission as ordinary single-school chart CRUD — letting anyone who manages one school's
chart maintenance force-reset the cross-school Dean's password to the known default and
log in as Dean. `proposal.md`'s own Risks table had already flagged that this permission
"must" not just reuse the generic chart CRUD permission; the design ended up doing exactly
that. Resolved per the user's explicit choice: gate the whole endpoint behind `ADMIN`
(the same permission `chart-heads` already uses), rather than excluding `DEAN` or
splitting the permission per selected type.

**Files**

- `src/modules/organization/charts/api/charts.controller.ts` (modify)

**Fix**: `@RequirePermission({ module: PERMISSION_MODULES.ADMIN, action: PERMISSION_ACTIONS.POST })`
on `maintenanceResetPasswords`, with a comment explaining why this route alone departs from
the controller's other `ORGANIZATION`-gated endpoints.

**Commit**: `fix(charts): gate password reset behind ADMIN permission`

> No test change — decorator permission values aren't unit-tested anywhere in this
> codebase (confirmed by the testing auditor); `PermissionsGuard` coverage is centralized
> and unaffected by which module/action string is passed.

#### Task R1.2 — Fix `entityTypeCodes` Swagger array item type; add a typed response DTO ✅ DONE (2026-08-24)

- [x] Task complete

**Severity**: Major (API contract). `ResetMaintenancePasswordsDto.entityTypeCodes` was
declared `@ApiProperty({ isArray: true, ... })` with no `type`, producing
`"items": { "type": "array" }` in the committed `openapi.json` instead of
`{ "type": "string" }` — verified directly in the file before fixing. Bundled with a
related minor (antipatterns auditor): `resetMaintenancePasswords`'s inline object-literal
return type had no named type and no `@ApiResponse`, unlike the newer, better-established
convention elsewhere in this codebase (`responseType` on `HttpMethodWithSwagger`, e.g.
`IfcFindingDetailResponseDto`) — fixed together since both are the same underlying gap
(an endpoint whose real shape isn't reflected in the spec).

**Files**

- `src/modules/organization/charts/model/charts.dtos.ts` (modify — `type: [String]` on
  `entityTypeCodes`; new `ResetMaintenancePasswordsResetUserDto`,
  `ResetMaintenancePasswordsSkippedNodeDto`, `ResetMaintenancePasswordsResponseDto`)
- `src/modules/organization/charts/api/docs/charts.swagger.ts` (modify — `responseType:
ResetMaintenancePasswordsResponseDto`)
- `src/modules/organization/charts/api/charts.service.ts` (modify — `resetMaintenancePasswords`
  now returns `ResetMaintenancePasswordsResponseDto` instead of an inline literal type)
- `openapi.json` (regenerate)

**Commit**: `fix(charts): type the reset-password request array and response shape`

> `pnpm openapi:export` confirmed: `entityTypeCodes.items` is now `{ "type": "string" }`,
> and the new response schema (`reset`/`skipped` arrays of the two new DTOs) is present.
> Diff vs. `origin/develop` is still purely additive (schemas + one path).

#### Task R1.3 — Exclude deactivated users from the reset scope ✅ DONE (2026-08-24)

- [x] Task complete

**Severity**: Minor (security). Neither `findChartUsersByTypes` nor `resetPasswordsByIds`
filtered on `organization.users.is_active` — a chart node whose staff was still linked to
a deactivated user account would have that account's password reset like any active one.

**Files**

- `src/modules/organization/charts/core/charts.repository.ts` (modify — join
  `organization.users` with `AND u.is_active = true`, select `u.id` instead of
  `s.user_id`, so a deactivated link now folds into the same "no active login" case as an
  unset one)
- `src/modules/organization/charts/core/charts.repository.spec.ts` (test)

**Steps (TDD)**: added a test asserting the SQL joins `organization.users` with
`u.is_active = true`; confirmed **red** by temporarily reverting the join condition,
observed the exact expected failure, then restored the fix and confirmed **green**.

**Commit**: `fix(charts): exclude deactivated users from password reset scope`

> Deliberately did not add a matching filter inside `UserRepository.resetPasswordsByIds`
> itself — the chart-repository read is now the single point where "resettable" is
> decided, and `resetPasswordsByIds` has no other caller. Duplicating the same rule in the
> write path would just be a second place to drift out of sync with the first.

#### Task R1.4 — Strengthen `resetMaintenancePasswords` test coverage ✅ DONE (2026-08-24)

- [x] Task complete

**Severity**: Minor (testing), two findings fixed together.

1. The non-null `rootChartId` branch of `resolveTreeRoot` (the AC-3 TS-side plumbing) was
   exercised but never asserted on — only the null-root case pinned
   `findChartUsersByTypes`'s call args, which is degenerate since both branches resolve to
   the same value there.
2. The AC-7 "every matched row unlinked" test was a mechanical duplicate of the AC-5
   single-unlinked-node test — same one-row fixture, no broadened coverage.

**Files**

- `src/modules/organization/charts/api/charts.service.spec.ts` (test)

**Fix**: added `'uses the existing rootChartId as root when the school node has a parent'`
asserting `findChartUsersByTypes` is called with `(1, 7, ...)` — distinguishable from
`schoolId` (7) — when `rootChartId: 1`. Rewrote the redundant AC-7 test to use two
all-`userId: null` rows and assert both land in `skipped` with `reset: []`.

**Commit**: `test(charts): cover resolveTreeRoot's non-null branch and true multi-row AC-7`

#### Task R1.5 — Single-pass partition/grouping; defensive fallback over non-null assertion ✅ DONE (2026-08-24)

- [x] Task complete

**Severity**: Minor/suggestion (code quality, antipatterns), three related findings fixed
together.

1. `resetMaintenancePasswords` iterated `rows` twice (once to filter `skipped`, once to
   build `chartIdsByUser`) and reallocated a new array on every grouped push via spread.
2. `chartIdsByUser.get(user.id)!` relied on an undocumented invariant (every id
   `resetPasswordsToDefault` returns was inserted moments earlier) — true today because
   `resetPasswordsByIds` filters `WHERE id = ANY($2)`, but would throw a raw `TypeError`
   instead of failing predictably if that ever changed.
3. (Suggestion, runtime robustness) The two-round-trip shape (CTE read, then bulk write)
   has no shared transaction, so the response's `chartIds` reflect a pre-write snapshot —
   worth a one-line comment, not a design change (nothing here is a data-integrity risk;
   the bulk `UPDATE` is itself atomic).

**Files**

- `src/modules/organization/charts/api/charts.service.ts` (modify)

**Fix**: rewrote the skip/group logic as one pass over `rows`, pushing into the grouped
array in place; changed `chartIdsByUser.get(user.id)!` to `... ?? []` with a comment
stating the invariant; added a comment above the `resetPasswordsToDefault` call documenting
the read/write staleness window.

**Commit**: bundled into `fix(charts): type the reset-password request array and response
shape` (task R1.2) — both touched `charts.service.ts`'s `resetMaintenancePasswords`, and
the file was staged once rather than split into two commits over the same function.

> All 94 tests across the charts/users modules pass unchanged by this task — this was a
> pure refactor of already-covered logic, not new behavior.

### Findings deliberately left unchanged (no action, not silently skipped)

Each of these was flagged by an auditor who themselves concluded no code change was
warranted; changing them anyway would contradict the auditor's own reasoning or reintroduce
inconsistency the auditor specifically warned against:

- **CTE duplication** between `findChartUsersByTypes` and `getMaintenanceBranch` (runtime
  robustness auditor) — already documented and cross-referenced by design; the two queries'
  shapes differ enough that extracting a shared fragment was already considered and
  rejected in `design.md`.
- **Hand-rolled `groupBy`-style loop** (antipatterns auditor) — consistent with at least two
  other local, private implementations elsewhere in this codebase; not new duplication
  against a single shared utility.
- **Spanish Swagger route summary** for `maintenanceResetPasswords` (antipatterns auditor)
  — every other summary in `charts.routes.ts` is already Spanish; changing one entry alone
  would be a new inconsistency, not a fix. Auditor's own words: "if the team ever
  normalizes... do it file-wide."
- **Idempotency of a retried/double-submitted request** (runtime robustness auditor) —
  explicitly confirmed safe as-is (re-resetting to the same default password is a no-op in
  effect).
- **No persisted audit trail of who triggered a reset** (security auditor, restating
  `proposal.md`'s own confirmed non-goal) — a product decision already made with the
  requester before implementation, not a defect this round surfaced.
- **Repository-spec convention** (mocking `dataSource.query` rather than a real DB) —
  testing auditor confirmed this is the established, correct convention for this codebase;
  no change needed.

### Review round 2

A full 6-agent re-audit ran on the current HEAD (feature + round-1 fixes together) before
opening the PR, per `/abet-create-pr`'s precondition that the audit must have run on the
commit being shipped. **Both round-1 majors were independently re-verified as genuinely
closed** — the security auditor traced the actual `PermissionsGuard` matching logic (exact
string match, no module hierarchy/implication) to confirm an `ORGANIZATION`-only caller is
rejected, and traced the read→skip→write chain end to end to confirm a deactivated user's
password is never touched. No regressions found in any of the six domains.

This round surfaced one real drift and a handful of quick quality fixes, plus one product
question that needs the requester's call rather than a code change.

#### Task R2.1 — Correct stale design docs after the round-1 permission change ✅ DONE (2026-08-25)

- [x] Task complete

**Severity**: Major (documentation currency, architecture auditor). `design.md`'s AC-8 and
its Risks table still argued for `ORGANIZATION`/`POST` and explicitly recorded rejecting
`ADMIN` — the opposite of what round 1 actually shipped. `proposal.md`'s traceability table
for AC-8 was equally stale.

**Files**

- `openspec/changes/chart-password-reset/design.md` (modify — superseded-note on AC-8,
  corrected "Guards / scope" bullet, corrected Risks table row)
- `openspec/changes/chart-password-reset/proposal.md` (modify — corrected AC-8
  traceability row)

**Fix**: added a dated (2026-08-25) superseded note on AC-8 pointing to this file's R1.1
entry as the source of truth, rather than rewriting the original reasoning as if `ADMIN`
had been the design's first call — the original reasoning is kept for the record, marked
clearly as no longer current.

**Commit**: `docs(openspec): correct chart-password-reset docs after permission change`

#### Task R2.2 — Strengthen the deactivated-user regression test ✅ DONE (2026-08-25)

- [x] Task complete

**Severity**: Minor (testing auditor). The round-1 test asserting the `is_active` join
condition matched starting at `organization.users`, not `LEFT JOIN organization.users` —
so a regression from `LEFT JOIN` to `INNER JOIN` (which would silently drop a
deactivated-user's chart node from the result instead of surfacing it as `skipped`,
changing observable API behavior) would not have been caught.

**Files**

- `src/modules/organization/charts/core/charts.repository.spec.ts` (test)

**Fix**: broadened the regex to require `LEFT\s+JOIN` immediately before
`organization\.users`, with a comment explaining why the join type is part of the pinned
contract, not just the `ON` condition.

**Commit**: `test(charts): pin LEFT JOIN in the deactivated-user regression test`

#### Task R2.3 — De-duplicate the default-password-hash logic ✅ DONE (2026-08-25)

- [x] Task complete

**Severity**: Suggestion (code quality + antipatterns auditors, same underlying finding
from two angles). `hashPassword(configService.getOrThrow('DEFAULT_USER_PASSWORD'))` was
duplicated verbatim between `UserService.create()` (pre-existing) and the new
`resetPasswordsToDefault()`; separately, the `{ id, firstName, lastName }` return shape was
repeated inline across `UserRepository.resetPasswordsByIds` and `UserService`'s method
signature.

**Files**

- `src/modules/organization/users/core/users.repository.ts` (modify — export
  `ResetPasswordUserSummary` interface, used as `resetPasswordsByIds`'s return type)
- `src/modules/organization/users/api/users.service.ts` (modify — private
  `getDefaultPasswordHash()`, called from both `create()` and `resetPasswordsToDefault()`;
  `resetPasswordsToDefault` now returns `ResetPasswordUserSummary[]`)

**Commit**: `refactor(users): extract shared default-password-hash helper and result type`

> All 94 tests across the charts/users modules pass unchanged — a pure refactor, same
> runtime behavior.

### Findings not fixed — needs the requester's decision, not a code change

- **`ADMIN` is an all-or-nothing tier in this codebase's seed data** (architecture auditor,
  major severity as a product-fit concern, not a defect in round 1's fix). Round 1 closed
  the DEAN privilege-escalation hole by gating the _entire_ reset endpoint behind `ADMIN`.
  The re-audit found that in this codebase, `ADMIN` is a single coarse module — the seed
  data grants the `ADMIN` role every module permission at once, with no finer-grained,
  composable "reset passwords for my school's chart" action. Practically: a school-level
  coordinator can no longer self-serve even a single course-level password reset without
  also being granted IAM/role management, every bulk-upload capability, and period
  configuration — capabilities well outside what the original feature request asked for.
  This is not a security defect (the fix correctly closes the escalation path) — it is a
  question of whether the fix over-corrected against the feature's original audience.
  Raised with the requester directly rather than silently re-opened or silently accepted.
