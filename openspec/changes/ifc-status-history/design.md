# Design — IFC status history endpoint

**Slug**: `ifc-status-history`
**Proposal**: `./proposal.md`

## Read first

- `docs/POLICIES.md` § Database Access (Repository Boundary), § i18n Key Convention,
  § Validation Pattern, § Auth & Guards, § Scope Headers, § Swagger/Routes Pattern
- `docs/CONTEXT.md` § Database (the `ifc` schema), § Business Rules
- `src/modules/evidence/ifcs/model/ifcs.entity.ts`, `.../ifc-view.service.ts`,
  `.../ifc-state-machine.service.ts`, `.../ifcs.service.ts`, `.../ifcs.controller.ts` — the
  module this change extends
- `src/modules/evidence/ifcs/api/ifcs.sql.ts` — `HEADER_SQL` (the `chain_up` CTE and
  `latest_status` LATERAL join this design reuses the shape of) and
  `TRANSITION_CONTEXT_SQL` (the query this design reuses outright)
- `src/modules/evidence/ifcs/core/ifcs.validation.ts` — `IfcValidation.assertHasHigherLevel`,
  the exact chain-authorization check already used by `approve`/`reject`, reused here
- `src/modules/ifc/statuses/model/statuses.entity.ts` — `ifc.statuses`, the table this
  endpoint reads (no schema change)
- `openspec/specs/` — empty; no prior art to reconcile against

No prior ADR touches this area (only `ADR-001`, about scraper credentials).

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Datastore, broker or cache choice             | No                                                                                       |
| Auth or payments provider                     | No                                                                                       |
| Public API contract change or breaking change | No — purely additive: one new GET endpoint, no existing route/DTO/response shape changes |
| New module boundary or cross-repo split       | No — stays inside the existing `evidence/ifcs` module                                    |
| Language, runtime or framework                | No                                                                                       |
| Contradicting an existing ADR                 | No                                                                                       |

**Conclusion**: no ADR required.

## Approach

### AC-1 — full history, most recent first, staff name + comment

A new repository query, `STATUS_HISTORY_SQL`, joins `ifc.statuses` → `core.types`
(status name/color) → `organization.staff` → `organization.users` (staff display name),
filtered by `ifc_id`, ordered `s.created_at DESC` — the same tiebreak `HEADER_SQL` already
uses to pick the "latest" row, just without the `LIMIT 1`. `comment` is read straight off
the JSONB column, exactly like `HEADER_SQL`'s `statusComment` — no transformation, since its
keys are language codes (`es`/`en`), not domain field names.

The row shape is deliberately identical to the existing `IfcStatusInfoDto` (`code`, `name`,
`color`, `at`, `comment`, `by`) already used for the single "current status" shown on the
IFC view header — so the response reuses that DTO as a list instead of introducing a new
shape for what is structurally the same object repeated.

### AC-2 — forbidden for requesters not above the course coordinator

Reuses `IfcValidation.assertHasHigherLevel` unchanged — the same recursive `chain_up` CTE
over `organization.charts` that already gates `approve`/`reject`, walking from the course's
chart node up through `root_chart_id`; the requester's staff id must appear at `depth > 1`
(strictly above the course node, so the coordinator themselves does not qualify). This
avoids a third copy of that CTE (already duplicated once between `assertHasHigherLevel` and
`HEADER_SQL`'s informational `requesterHasHigherLevel` — see the Risks in `proposal.md`).

`assertHasHigherLevel` needs a `{ query(sql, params?) }` runner. Today it only ever runs
inside a transaction (`approve`/`reject` pass the transaction's `EntityManager`). This
endpoint is read-only and needs no transaction, so `IfcRepository` gets one new public
method, `queryRunner(manager?: EntityManager)`, that just exposes its existing private
`runner()` helper (already used internally by `findTransitionContextRows`/`insertStatus`) —
no new SQL, no new abstraction, just a public door to what the repository already has.

`assertHasHigherLevel`'s `op` parameter is typed `APPROVE | REJECT`; it is widened to
`APPROVE | REJECT | STATUS_HISTORY` (a new `IFC_OPS.STATUS_HISTORY` constant), since `op` is
only used to pick the i18n result key (`ifcsValidationStrings.result[`${op}Failed`]`) — a new
`statusHistoryFailed` key is added, reusing the existing `error.notFound` /
`error.higherLevelRequired` detail keys.

The chain context (`courseChartId`, `requesterStaffId`) is loaded the same way
`IfcStateMachineService.loadTransitionContext` already does, via
`IfcRepository.findTransitionContextRows(ifcId, schoolId, userId)` — reused unchanged.

### AC-3 — 404 for an IFC outside the caller's school or that doesn't exist

`findTransitionContextRows`'s `TRANSITION_CONTEXT_SQL` already returns zero rows both when
the IFC id doesn't exist and when it exists but its course chart isn't reachable from the
caller's `schoolId` (its `WHERE i.id = $1 AND EXISTS (school_check)` clause). The new
service checks `rows.length === 0` and throws the same `HttpException(404)` shape
`IfcStateMachineService.lockIfc`/`loadTransitionContext` already throw for the identical
condition — no new not-found semantics invented.

### AC-4 — administrator bypass

The controller resolves `isAdmin(user)` (already imported in `ifcs.controller.ts`, used by
`schools()`) and passes it through to the service. When `true`, the service skips the
`assertHasHigherLevel` call entirely and goes straight to reading the history. This bypass
is intentionally local to this one new service method — `approve`/`reject` are unchanged and
still have no admin bypass, per the proposal's non-goals.

## Backend

- **Module**: `src/modules/evidence/ifcs/` (existing module, no new one)
- **Entities / migrations**: none — `ifc.statuses` already carries every field needed
- **Repository** (`core/ifcs.repository.ts`):
  - New `findStatusHistoryRows(ifcId: number): Promise<IfcStatusHistoryRow[]>` running the
    new `STATUS_HISTORY_SQL` (added to `api/ifcs.sql.ts`)
  - New public `queryRunner(manager?: EntityManager): Pick<DataSource, 'query'>` — thin
    wrapper around the existing private `runner()`
  - Reused: `findTransitionContextRows`
- **Validation** (`core/ifcs.validation.ts`): `assertHasHigherLevel`'s `op` union widened to
  include `IFC_OPS.STATUS_HISTORY`; no behavioural change to the function itself
- **Constants** (`api/ifcs.constants.ts`): `IFC_OPS.STATUS_HISTORY = 'statusHistory'`
- **i18n keys** (`config/strings/ifcs.validation.ts`): `result.statusHistoryFailed =
'error.ifc.statusHistoryFailed'` (new); reuses `error.notFound`, `error.higherLevelRequired`
- **New service** (`api/ifc-status-history.service.ts`): `IfcStatusHistoryService`, one
  method `getHistory(ifcId, userId, schoolId, isAdminUser): Promise<{ statuses:
IfcStatusInfoDto[] }>` — orchestrates the three steps in the Approach section above.
  Follows the existing per-concern split (`IfcViewService`, `IfcStateMachineService`,
  `IfcContentService`, `IfcReportService`) rather than growing `IfcService` directly.
- **Façade** (`api/ifcs.service.ts`): `IfcService` gains `getStatusHistory(...)`, delegating
  to `IfcStatusHistoryService`, matching how every other sub-service is exposed
- **Module wiring** (`ifcs.module.ts`): `IfcStatusHistoryService` added to `providers`
- **Endpoint** (`api/ifcs.controller.ts`):
  - `GET /ifcs/:id/status-history`
  - `@ApiSchoolHeader()` + `@SchoolId()` (school scope, same as `getView`/`submit`/etc.)
  - `@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: PERMISSION_ACTIONS.GET })`
    — the coarse gate; the org-chart chain check inside the service is the fine-grained one,
    same layering as every other IFC transition endpoint
  - `@CurrentUser() user: RequestUser`, passing `user.userId` and `isAdmin(user)` to the
    service
- **Routes** (`config/ifcs.routes.ts`): new `statusHistory` operation,
  `GET /:id/status-history`
- **Swagger** (`api/docs/ifcs.swagger.ts`): `SwaggerIfcStatusHistory`, `responseType:
IfcStatusHistoryResponseDto`
- **DTOs** (`model/ifcs.dtos.ts`): `IfcStatusHistoryResponseDto { statuses:
IfcStatusInfoDto[] }` — reuses the existing `IfcStatusInfoDto`, no new per-entry shape
- **OpenAPI**: `pnpm openapi:export`, committed in this PR (policy requirement for any new
  route)

## Testing strategy

| AC  | Covered by                                                                                                                                                                                      | Kind                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | `ifcs.service.spec.ts` — new `IfcService.getStatusHistory` describe block: asserts ordering, field mapping (`code`/`name`/`color`/`at`/`comment`/`by`), and `comment: null` when a row has none | unit (fake `DataSource`, same harness as the rest of the file) |
| 2   | same block — requester with no chain-check row / requester equal to the coordinator (`depth` not `> 1`) → `403 forbidden`                                                                       | unit                                                           |
| 3   | same block — `findTransitionContextRows` returns `[]` → `404`                                                                                                                                   | unit                                                           |
| 4   | same block — `isAdminUser: true` with a chain-check that would otherwise fail still succeeds, and asserts the chain query is never issued                                                       | unit                                                           |

This module has no controller-level spec file for any of its existing endpoints (`getView`,
`submit`, `approve`, `reject`, ... are all exercised through `IfcService` in
`ifcs.service.spec.ts`, constructing the real sub-services against a faked `DataSource`) —
this change follows that same convention rather than introducing a new one.

The recursive `chain_up` CTE itself is not exercised against a real Postgres org chart by
any unit test in this repo (the fake `DataSource` returns programmed rows, not real SQL
results) — see `runbook.md` for the manual check that closes that gap.

## Risks

| Risk                                                                                                               | Mitigation                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A fourth hand-rolled copy of the `chain_up` walk drifts from `assertHasHigherLevel` if the org-chart model changes | Reused `assertHasHigherLevel` directly via the new `queryRunner()` accessor instead of duplicating the CTE                                                                                            |
| Widening `assertHasHigherLevel`'s `op` union could silently change behaviour for `approve`/`reject`                | The function body is untouched; only the type union grows, and `op` is used exclusively to pick an i18n key — existing `approve`/`reject` tests continue to assert their own `xFailed` keys unchanged |
| `queryRunner()` on `IfcRepository` slightly widens the repository's public surface                                 | Kept intentionally thin — it's the existing private `runner()` made reachable, not new SQL or a new concept                                                                                           |

## Docs to update in this PR

- [ ] `openapi.json` — regenerate via `pnpm openapi:export` (new route + new DTOs)
- No `docs/CONTEXT.md` change — no new schema, module, domain term, or business rule beyond
  what `assertHasHigherLevel` already documents implicitly via its existing use in
  `approve`/`reject`
