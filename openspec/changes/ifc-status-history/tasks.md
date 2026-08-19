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

<!--
Append-only sections below. These record what actually happened, not what was planned,
and they are the best input to the next design.

## Unplanned — <what and why>

### Task U.1 — <title>
- [ ] Task complete

## Post-QA fixes

## Audit fixes (/abet-audit-pr)

### Review round 1
-->
