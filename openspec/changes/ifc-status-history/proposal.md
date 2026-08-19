# IFC status history endpoint

**Slug**: `ifc-status-history`
**Branch**: `feat/ifc-status-history`
**Repos affected**: backend
**Created**: 2026-08-18

## Problem

Reviewers above the course level (school/programme/area leadership, or an administrator)
have no single endpoint to see how an IFC's status has evolved: what it was set to at each
step, who set it, and what comment (e.g. an observation/rejection reason) was left. Today
that trail only exists as rows in `ifc.statuses`, joined ad hoc inside the IFC view header
query, which surfaces only the _latest_ status — not the full sequence a "show history"
button on an IFC needs.

## What already exists

- `ifc.statuses` (`src/modules/ifc/statuses/model/statuses.entity.ts`) — one row per status
  change on an IFC: `ifcId`, `statusTypeId` (→ `core.types`, group `IFC_STATUS`), `staffId`
  (→ `organization.staff` → `organization.users` for the display name), `comment`
  (`I18nText`, nullable), `registerAt`. This table already has a full CRUD module
  (`StatusController`/`StatusService`/`StatusRepository`) gated by
  `PERMISSION_MODULES.IFCS`, but nothing there is scoped to "all statuses for one IFC,
  with the staff name resolved and readable by the course's superiors only."
- `IfcRepository.findViewHeaderRows` (`src/modules/evidence/ifcs/core/ifcs.repository.ts`,
  `HEADER_SQL` in `.../api/ifcs.sql.ts`) already does the two things this change needs,
  but only for the _single latest_ status and as one field among many in the full IFC view:
  - A `LEFT JOIN LATERAL` on `ifc.statuses` resolving `statusCode`/`statusName`,
    `statusAt`, `statusComment`, and `statusByName` (`u_by.first_name || ' ' ||
u_by.last_name`).
  - A `chain_up` recursive CTE over `organization.charts` that walks from the IFC's course
    chart node up through `root_chart_id`, used to compute `requesterHasHigherLevel`
    (`depth > 1`, i.e. strictly above the course node) — informational only there, not
    enforced.
- `IfcValidation.assertHasHigherLevel` (`src/modules/evidence/ifcs/core/ifcs.validation.ts`)
  is the enforcement version of that same chain walk, already used to gate `approve`/
  `reject` in `IfcStateMachineService`: it throws `ForbiddenError` unless the requester's
  staff record sits above the course chart node in the `root_chart_id` chain. It has no
  admin bypass today — `approve`/`reject` don't check `isAdmin`.
- `isAdmin(user)` (`src/modules/auth/model/authorization.functions.ts`) is the standard way
  to let administrators bypass a chain/ownership check elsewhere in the codebase.
- `IfcController` (`src/modules/evidence/ifcs/api/ifcs.controller.ts`) is the existing home
  for IFC sub-resource GETs keyed by `:id` (`getView`, `pdf`, ...), each behind
  `@RequirePermission({ module: PERMISSION_MODULES.IFCS, action: GET })` plus
  `@ApiSchoolHeader()`.

## Goals

- A GET endpoint, keyed by IFC id, returning the IFC's full status change history: for each
  change, the status (code/name), the name of the staff member who made the change, its
  comment (if any), and when it happened — ordered most recent first.
- Access restricted to: a staff member positioned above the course's coordinator in the
  course's org chart chain (the same chain `assertHasHigherLevel` already walks for
  approve/reject), or an administrator (`isAdmin(user)`). Anyone else gets `403`.
- A non-existent or out-of-school IFC id returns `404`, matching `getView`'s behaviour.

## Non-goals

- No change to `ifc.statuses` writes, to the existing generic `StatusController` CRUD, or to
  the approve/reject flow.
- No admin bypass added to `IfcValidation.assertHasHigherLevel` itself / to
  approve/reject — this change only needs the bypass for the new read endpoint, so it is
  scoped there (e.g. checked once in the new service method) rather than changing shared
  transition behaviour.
- No pagination — an IFC's status history is bounded by how many times it has been
  submitted/observed/approved in one academic period, which is small.

## Acceptance criteria

1. **AC-1** — Given an IFC with N status changes recorded in `ifc.statuses`, when a staff
   member above the course coordinator in the org chart (or an administrator) calls the
   endpoint with that IFC's id, then the response contains all N entries, each with the
   status code/name, the name of the staff who made that change, its comment (`null` when
   none was recorded), and the change timestamp, ordered most recent first.
2. **AC-2** — Given the same IFC, when a staff member who is the course's coordinator
   themselves, or below/outside that chain, calls the endpoint, then the response is `403`
   and no status data is returned.
3. **AC-3** — Given an IFC id that does not exist (or does not resolve to a course chart
   node in the caller's school), when any user calls the endpoint, then the response is
   `404`.
4. **AC-4** — Given an administrator calls the endpoint for any IFC in their scope, then the
   request succeeds regardless of their position (or absence) in that course's org chart
   chain.

### Traceability

| AC  | Criterion                                                         | Satisfied by                                                                                                                         |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Full status history, most recent first, with staff name + comment | `IfcRepository.findStatusHistoryRows` (`STATUS_HISTORY_SQL`) + `IfcStatusHistoryService.getHistory` (`GET /ifcs/:id/status-history`) |
| 2   | Forbidden for requesters not above the course coordinator         | `IfcValidation.assertHasHigherLevel` (widened with `IFC_OPS.STATUS_HISTORY`), invoked from `IfcStatusHistoryService.getHistory`      |
| 3   | 404 for an IFC that doesn't exist / isn't in the caller's school  | `IfcRepository.findTransitionContextRows` (reused), empty-rows check in `IfcStatusHistoryService.getHistory`                         |
| 4   | Administrator bypass                                              | `isAdmin(user)` passed from `IfcController.statusHistory` into `IfcStatusHistoryService.getHistory`, skipping the chain check        |

## Dependencies

None beyond existing tables/modules listed above — no migration, no new external system.

## Risks

| Risk                                                                                                                                       | Impact                                                                        | Mitigation                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Reimplementing the `chain_up` walk a third time (view header, `assertHasHigherLevel`, this endpoint) drifts if the org-chart model changes | Authorization silently diverges between approve/reject and this read endpoint | Design should reuse `assertHasHigherLevel`'s existing chain query (or extract it) rather than hand-rolling a fourth copy |
| `comment` is stored as `I18nText` JSONB — the response must not leak raw JSONB casing                                                      | Violates `docs/POLICIES.md` JSONB camelCase boundary rule                     | `BaseService.normalizeJsonbColumns` / existing `I18nText` handling already covers this; no new pattern needed            |

## Open questions

None.
