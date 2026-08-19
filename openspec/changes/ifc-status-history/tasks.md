# Tasks — IFC status history endpoint

**Slug**: `ifc-status-history` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and
  fan the non-overlapping ones out to parallel subagents.
- TDD throughout: write the test, **see it fail**, implement, see it pass.
- A task is complete when **its test passes**, not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the
  heading. Never one without the other — the completeness gate reads the boxes.
- Run tests with `npx jest --no-coverage <path>`. Typecheck with
  `pnpm exec tsc --noEmit -p tsconfig.build.json`.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*`.

## Goal

Add `GET /ifcs/:id/status-history`: the full sequence of status changes recorded for an
IFC — status, the staff member who set it, its comment (if any), and when — newest first,
readable only by a staff member positioned above the course's coordinator in the org chart,
or an administrator.

## Slicing

Milestone 1 delivers the whole endpoint end to end (no schema change, so there is nothing to
usefully split into a second milestone).

---

## Milestone 1 — status history endpoint

### Task 1.1 — Repository: status history rows + public query runner ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/evidence/ifcs/api/ifcs.sql.ts` (modify — add `STATUS_HISTORY_SQL`)
- `src/modules/evidence/ifcs/core/ifcs.repository.ts` (modify — add
  `IfcStatusHistoryRow`, `findStatusHistoryRows`, `queryRunner`)
- `src/modules/evidence/ifcs/api/ifcs.service.spec.ts` (test)

**Steps (TDD)**

1. In `ifcs.service.spec.ts`'s fake repository builder, add `findStatusHistoryRows` and
   `queryRunner` fakes that delegate to the harness's fake `DataSource`, matching how the
   other fake repository methods in that file already delegate. This alone doesn't add an
   assertion yet — it's scaffolding for Task 1.3's tests, which will fail to compile without
   it. Confirm the file still typechecks: `pnpm exec tsc --noEmit -p tsconfig.build.json` →
   expect **red** (methods referenced don't exist on `IfcRepository` yet).
2. Add `STATUS_HISTORY_SQL` to `ifcs.sql.ts`: select `t.code AS "statusCode"`, `t.name AS
"statusName"`, `(t.extra->>'color') AS "statusColor"`, `s.register_at AS "registerAt"`,
   `s.comment`, `u.first_name || ' ' || u.last_name AS "staffName"` from `ifc.statuses s`
   joined to `core.types t` (`s.status_type_id = t.id`), left joined to
   `organization.staff st` / `organization.users u`, `WHERE s.ifc_id = $1 ORDER BY
s.created_at DESC` — mirror `HEADER_SQL`'s `latest_status` LATERAL join and alias style
   exactly (double-quoted camelCase aliases per `docs/POLICIES.md` § Raw SQL convention).
3. Add `IfcStatusHistoryRow` interface and `findStatusHistoryRows(ifcId: number):
Promise<IfcStatusHistoryRow[]>` to `IfcRepository`, calling `this.dataSource.query(
STATUS_HISTORY_SQL, [ifcId])`.
4. Add `queryRunner(manager?: EntityManager): Pick<DataSource, 'query'>` to `IfcRepository`,
   returning `this.runner(manager)` (the existing private helper — do not change its
   visibility, just expose it through this new public method).
5. Re-run `pnpm exec tsc --noEmit -p tsconfig.build.json` → expect **green**.

**Commit**: `feat(ifcs): add status history query and public query runner to IfcRepository`

> Green on the first attempt. `queryRunner()` just wraps the existing private `runner()`
> helper, and the fake-repository harness in `ifcs.service.spec.ts` is loosely typed
> (`as unknown as IfcRepository`), so the two scaffolding fakes typechecked without
> friction. No new assertions added here — Task 1.3 will actually exercise them.

### Task 1.2 — Validation: widen assertHasHigherLevel for the read path ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/evidence/ifcs/api/ifcs.constants.ts` (modify — add `IFC_OPS.STATUS_HISTORY`)
- `src/modules/evidence/ifcs/config/strings/ifcs.validation.ts` (modify — add
  `result.statusHistoryFailed`)
- `src/modules/evidence/ifcs/core/ifcs.validation.ts` (modify — widen `assertHasHigherLevel`'s
  `op` union)
- `src/modules/evidence/ifcs/core/ifcs.validation.spec.ts` (test)

**Steps (TDD)**

1. In `ifcs.validation.spec.ts`, add a case calling `assertHasHigherLevel(runner, ctx,
IFC_OPS.STATUS_HISTORY)` (both the throwing and passing paths) — this will fail to
   compile/typecheck since `IFC_OPS.STATUS_HISTORY` doesn't exist yet:
   `npx jest --no-coverage src/modules/evidence/ifcs/core/ifcs.validation.spec.ts` → expect
   **red**.
2. Add `STATUS_HISTORY: 'statusHistory'` to `IFC_OPS` in `ifcs.constants.ts`.
3. Add `statusHistoryFailed: 'error.ifc.statusHistoryFailed'` under `result` in
   `config/strings/ifcs.validation.ts`.
4. Widen `assertHasHigherLevel`'s third parameter type from `typeof IFC_OPS.APPROVE | typeof
IFC_OPS.REJECT` to also include `typeof IFC_OPS.STATUS_HISTORY`. No change to the
   function body.
5. Re-run the same test file → expect **green**. Re-run the full validation spec to confirm
   no regression on the existing `approve`/`reject` cases.

**Commit**: `feat(ifcs): add statusHistory op to the higher-level chain check`

> Green on the first attempt. `op` is only ever used to key into `ifcsValidationStrings.result`,
> so widening the union was a pure type-level change — the two new spec cases mirror the
> existing APPROVE-op pass/fail cases with `STATUS_HISTORY` swapped in, and all 31 cases in
> the file (including the pre-existing approve/reject ones) stayed green.

### Task 1.3 — Service: IfcStatusHistoryService + IfcService.getStatusHistory ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/evidence/ifcs/api/ifc-status-history.service.ts` (create)
- `src/modules/evidence/ifcs/api/ifcs.service.ts` (modify — add `getStatusHistory`)
- `src/modules/evidence/ifcs/ifcs.module.ts` (modify — register `IfcStatusHistoryService`)
- `src/modules/evidence/ifcs/api/ifcs.service.spec.ts` (test)

**Steps (TDD)**

1. In `ifcs.service.spec.ts`, add a `describe('IfcService.getStatusHistory', ...)` block
   with cases for: happy path (multiple rows, correct order and field mapping, one row with
   `comment: null`); `404` when `findTransitionContextRows` returns `[]`; `403` when the
   requester is not admin and the chain check yields no row (cover both "requester is the
   coordinator themselves" and "requester outside the chain entirely"); admin bypass
   succeeds even when the chain check would fail, and the chain-check query is not called
   in that case. Run: `npx jest --no-coverage src/modules/evidence/ifcs/api/ifcs.service.spec.ts`
   → expect **red** (`getStatusHistory` doesn't exist).
2. Create `ifc-status-history.service.ts` with `IfcStatusHistoryService`, constructor takes
   `IfcRepository`, method `getHistory(ifcId: number, userId: number, schoolId: number,
isAdminUser: boolean)`:
   - Load `findTransitionContextRows(ifcId, schoolId, userId)`; throw the same
     `HttpException(HttpStatus.NOT_FOUND, { message: ifcsValidationStrings.result
.statusHistoryFailed, errors: [ifcsValidationStrings.error.notFound] })` shape
     `IfcStateMachineService` already uses when rows are empty.
   - Build the `IfcTransitionContext` from the first row.
   - When `!isAdminUser`, call `IfcValidation.assertHasHigherLevel(this.repository
.queryRunner(), ctx, IFC_OPS.STATUS_HISTORY)`.
   - Load `findStatusHistoryRows(ifcId)` and map each row to `{ code: statusCode, name:
statusName, color: statusColor ?? null, at: registerAt, comment: comment ?? null, by:
staffName ?? null }`.
   - Return `{ statuses: [...] }`.
3. Add `getStatusHistory(id, userId, schoolId, isAdmin)` to `IfcService`, delegating to the
   new service (constructor-injected alongside `stateMachine`/`content`/`view`/`report`).
4. Register `IfcStatusHistoryService` in `ifcs.module.ts`'s `providers`.
5. Re-run `npx jest --no-coverage src/modules/evidence/ifcs/api/ifcs.service.spec.ts` →
   expect **green**.
6. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(ifcs): add IfcStatusHistoryService and wire it into IfcService`

> Green on the first attempt. `assertHasHigherLevel`'s chain-check query goes through the
> same `queryRunner() → dataSource.query` path as `findTransitionContextRows`/
> `findStatusHistoryRows`, so the fake harness needed no new plumbing beyond Task 1.1's
> scaffolding — just sequencing `mockResolvedValueOnce` calls in the right order per test
> (context row, then optionally the chain query, then history rows). 51/51 tests pass
> (5 new), `tsc --noEmit` clean.

### Task 1.4 — Endpoint, routes, Swagger, DTOs, OpenAPI export ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/evidence/ifcs/config/ifcs.routes.ts` (modify — add `statusHistory` operation)
- `src/modules/evidence/ifcs/model/ifcs.dtos.ts` (modify — add
  `IfcStatusHistoryResponseDto`)
- `src/modules/evidence/ifcs/api/docs/ifcs.swagger.ts` (modify — add
  `SwaggerIfcStatusHistory`)
- `src/modules/evidence/ifcs/api/ifcs.controller.ts` (modify — add `statusHistory` handler)
- `openapi.json` (modify — regenerated, not hand-edited)

**Steps (TDD)**

1. Add the `statusHistory` operation to `ifcsRoutes.ifcs.operation`: `GET
/:id/status-history`.
2. Add `IfcStatusHistoryResponseDto { statuses: IfcStatusInfoDto[] }` to `ifcs.dtos.ts`
   (reuses the existing `IfcStatusInfoDto`).
3. Add `SwaggerIfcStatusHistory` to `ifcs.swagger.ts`: `param: { name: 'id', type: 'number'
}`, `responseType: IfcStatusHistoryResponseDto`.
4. Add the controller handler: `@SwaggerIfcStatusHistory()`, `@ApiSchoolHeader()`,
   `@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET
})`, params `@Param('id', ParseIntPipe) id`, `@SchoolId() schoolId`, `@CurrentUser() user:
RequestUser`; calls `this.service.getStatusHistory(id, user.userId, schoolId,
isAdmin(user))`, returns `parseSuccessResponse(result)`.
5. Boot the app locally (or via existing e2e harness if one runs in CI) and hit `GET
/docs-json` to confirm the route and DTO appear correctly, or just typecheck + run the
   full ifcs test suite: `npx jest --no-coverage src/modules/evidence/ifcs` → expect
   **green** (no test asserts the controller wiring directly, per the module's existing
   convention of testing through `IfcService`, but this must not regress anything).
6. `pnpm openapi:export` and commit the resulting `openapi.json` diff — confirm it contains
   only the new path/schemas, no unrelated drift.
7. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(ifcs): add GET /ifcs/:id/status-history endpoint`

> Green on the first attempt. `pnpm openapi:export` produced a clean 46-line diff — one new
> path (`/ifcs/{id}/status-history`) and one new schema (`IfcStatusHistoryResponseDto`), no
> unrelated drift. Full `src/modules/evidence/ifcs` + `src/modules/ifc` suite: 6 suites,
> 114 tests, all green. `tsc --noEmit` and `pnpm lint` both clean.

---

## Audit fixes (/abet-audit-pr)

### Review round 1 (2026-08-18)

Six parallel auditors (code quality, architecture/docs/contract, testing, antipatterns,
security, runtime robustness) reviewed `origin/develop...HEAD`. No blockers. Testing (C),
security (E) and runtime robustness (F) came back clean (E and C each noted only
suggestion-level items, folded into the tasks below where applicable). Two majors,
independently raised by 2–3 auditors each, need fixing before `/abet-create-pr`:

### Task R1.1 — Route status-history's context load through IfcStateMachineService.loadTransitionContext ✅ DONE (2026-08-18)

- [x] Task complete

Raised independently by Auditor A (code quality) and Auditor D (antipatterns), echoed by
Auditor E (security) as a duplication note.

**Why**: `IfcStatusHistoryService.getHistory` re-implements
`IfcStateMachineService.loadTransitionContext`'s job inline — fetch
`findTransitionContextRows`, throw 404 when empty, hand-build the `IfcTransitionContext`
with the same null-coercions — instead of reusing it, even though `IfcContentService`
already reuses it for the same purpose (`ifc-content.service.ts:111`) and its `op`
parameter was already widened in this same change to accept `IFC_OPS.STATUS_HISTORY`.
Concretely, this isn't just style: `loadTransitionContext` also calls
`IfcValidation.assertRequesterIsStaff`, which `getHistory` skips — so a requester with no
`organization.staff` row (a real, reachable case: any authenticated user without a staff
record) gets rejected with `error.ifc.higherLevelRequired` today instead of the correct,
more specific `error.ifc.staffRequired` every other IFC transition op reports for that
exact condition. Both are 403s, so authorization itself is not broken, but the wrong
detail key reaches the frontend and diverges from this module's established convention.

**Files**

- `src/modules/evidence/ifcs/api/ifc-status-history.service.ts` (modify)
- `src/modules/evidence/ifcs/api/ifcs.service.spec.ts` (test)

**Steps (TDD)**

1. Add a test case: requester has no staff record (`requesterStaffId: null` from
   `findTransitionContextRows`), not admin → expect `errors: ['error.ifc.staffRequired']`
   (not `higherLevelRequired`). Run it against the current implementation → expect **red**
   (today it throws `higherLevelRequired` instead).
2. Inject `IfcStateMachineService` into `IfcStatusHistoryService`'s constructor. Replace
   the manual `findTransitionContextRows` call + 404 throw + `IfcTransitionContext`
   construction with `const ctx = await this.stateMachine.loadTransitionContext(ifcId,
userId, schoolId, IFC_OPS.STATUS_HISTORY)` (this already throws the same 404 shape and
   calls `assertRequesterIsStaff`). Keep the `if (!isAdminUser) await
IfcValidation.assertHasHigherLevel(...)` call as-is (or per Task R1.2, adjust its
   runner source).
3. Register the new constructor dependency wherever `IfcStatusHistoryService` is
   constructed: `ifcs.module.ts` already provides `IfcStateMachineService`, so Nest DI
   needs no change there; update the fake-repository test harness in
   `ifcs.service.spec.ts`'s `buildServices` to pass the real `stateMachine` instance
   already built there into `new IfcStatusHistoryService(repository, stateMachine)`.
4. Re-run the new test → expect **green**. Re-run the full
   `IfcService.getStatusHistory` describe block → expect **green**, no regressions.
5. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `fix(ifcs): reuse loadTransitionContext in IfcStatusHistoryService`

> Green on the first attempt. Split the old combined "no course chart / staff record at
> all" test into two precise cases, since the two null fields now fail at different points
> for different reasons: `requesterStaffId: null` now throws `staffRequired` from inside
> `loadTransitionContext` (1 query — fails before the transaction is even opened);
> `courseChartId: null` with a real `requesterStaffId` still throws `higherLevelRequired`
> from `assertHasHigherLevel`'s own null-check, also without issuing its chain-walk query
> (still 1 query). Confirmed the behavioral nuance for admins: `assertRequesterIsStaff` now
> runs unconditionally (same as every other IFC transition op), so an admin with zero
> `organization.staff` row gets `403 staffRequired` — the AC-4 bypass still fully covers
> chain membership/depth, just not "having no staff record whatsoever," which no other IFC
> operation exempts either. Recorded in `design.md`'s new "Audit round 1 revisions" section.

### Task R1.2 — Stop exposing a raw query handle from IfcRepository ✅ DONE (2026-08-18)

- [x] Task complete

Raised by Auditor D as major (repository-boundary policy: "services must not call
`.query(...)`" — `queryRunner()` is a general, permanent, unscoped escape hatch, unlike
the existing carve-out where validation classes only ever receive a runner from inside
`repository.transaction(...)`), and independently by Auditor A (minor — the name
`queryRunner` also collides with TypeORM's own `QueryRunner` concept, which is a
transaction/connection-scoped object; this one is neither) and Auditor B (minor — the
repository is `exports: [IfcService, IfcRepository]`, so this widens what any consumer of
`IfcModule` can do with `IfcRepository`, even though today's only call site is narrow).

**Why**: The purpose (letting `IfcValidation.assertHasHigherLevel` run outside a
transaction) is legitimate, but a public method that hands out `{ query(sql, params) }`
is a bigger, more permanent capability than the one call site needs, and it's the kind of
thing the repository boundary exists to prevent from spreading.

**Files**

- `src/modules/evidence/ifcs/core/ifcs.repository.ts` (modify — remove `queryRunner`)
- `src/modules/evidence/ifcs/api/ifc-status-history.service.ts` (modify)
- `src/modules/evidence/ifcs/api/ifcs.service.spec.ts` (test)

**Steps (TDD)**

1. Update the fake-repository harness in `ifcs.service.spec.ts`: remove the
   `queryRunner` fake; the existing `transaction: (work) => ds.transaction(work as any)`
   fake (already present for the state-machine tests) is reused instead. Re-run the
   `IfcService.getStatusHistory` tests → expect **red** if `queryRunner` is still
   referenced in the implementation (it will be, until step 2).
2. In `IfcRepository`, delete the public `queryRunner(manager?)` method added in Task
   1.1 (leave the private `runner()` it wrapped untouched — other methods still use it
   internally).
3. In `IfcStatusHistoryService.getHistory`, wrap the higher-level check in a transaction,
   matching how `approve`/`reject` already obtain their runner: `await
this.repository.transaction(async (em) => { await IfcValidation.assertHasHigherLevel(em,
ctx, IFC_OPS.STATUS_HISTORY); })` — called only when `!isAdminUser`, same as before.
   (A transaction for a pure read is a minor overhead accepted here specifically to avoid
   widening the repository's public surface; note this trade-off in a one-line comment if
   the pattern looks surprising next to the rest of the read-only method.)
4. Re-run the full `IfcService.getStatusHistory` describe block plus
   `IfcService status transitions` (to confirm no collateral change to `approve`/`reject`,
   which use the same `transaction` fake) → expect **green**.
5. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `fix(ifcs): drop IfcRepository.queryRunner, use a transaction for the higher-level check instead`

> Green on the first attempt. `IfcService status transitions` (submit/approve/reject, the
> existing consumers of `repository.transaction`) re-run alongside `getStatusHistory` to
> confirm no collateral change — unaffected, since the transaction fake was already shared
> infrastructure, not something this task modified. `queryRunner()` is gone from
> `IfcRepository`; the only way to reach `assertHasHigherLevel`'s SQL now is via a runner
> obtained from `repository.transaction(...)`, same as every other caller in this module.

### Minor / suggestion follow-ups

- ✅ **Auditor C** — no single-entry (length-1) status history fixture case: added
  (`ifcs.service.spec.ts`, "returns a single-entry history unchanged").
- ✅ **Auditor C** — admin-bypass test title overstated what it proves in isolation:
  renamed to "admin bypasses the chain check entirely (no chain query executed) ...".
- ✅ **Auditor A** — 404 branch hardcoded `ifcsValidationStrings.result.statusHistoryFailed`
  instead of deriving it generically via `op`: resolved as a side effect of Task R1.1 —
  `loadTransitionContext` now owns that derivation, `getHistory` no longer references the
  key directly at all.
- **Skipped, with reason** — Auditor E's suggestion of query-level defense-in-depth for
  school scope (re-checking `schoolId` inside `STATUS_HISTORY_SQL` itself, not just in
  `TRANSITION_CONTEXT_SQL` beforehand). Not implemented: Auditor F independently traced
  the exact call order and confirmed `findStatusHistoryRows(ifcId)` (unscoped) is only
  ever reached after `findTransitionContextRows`'s school check has already passed — for
  every caller, admin included, with no code path that skips it. Adding a second,
  independent school check inside `STATUS_HISTORY_SQL` would mean a fourth copy of the
  chart-ancestry-to-school walk in this file (`HEADER_SQL`, `TRANSITION_CONTEXT_SQL`,
  `CHART_RESOLUTION_SQL` already each have one), which is exactly the duplication risk
  `proposal.md`'s own Risks table warned against — redundant defense with no reachable
  gap to defend, at the cost of a fourth divergence point to keep in sync.

<!--
Append-only sections below. These record what actually happened, not what was planned,
and they are the best input to the next design.

## Unplanned — <what and why>

### Task U.1 — <title>
- [ ] Task complete

## Post-QA fixes
-->
