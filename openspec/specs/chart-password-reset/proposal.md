# Reset chart node users' password to default, scoped by entity type

**Slug**: `chart-password-reset`
**Branch**: `feat/chart-password-reset`
**Repos affected**: backend
**Created**: 2026-08-24

## Problem

On the organization chart maintenance screen, an admin who needs to reset a user's login
password today has no bulk path: the only reset mechanism is the self-service, token-based
`requestPasswordReset` / `resetPassword` flow, which requires the affected user to have
access to their own email. When an admin needs to reset several org-chart heads at once
(e.g. after a period rollover, or when several staff report being locked out), they have no
way to do it from the maintenance screen itself, and no bulk password action exists anywhere
in the codebase.

## What already exists

- **Org chart module** — `src/modules/organization/charts/`. `ChartEntity`
  (`model/charts.entity.ts`) has `staffId` (FK to `organization.staff`, one per node, not
  nullable), `entityTypeId` (FK to `core.types`, group `TG903`/`ENTITY_TYPE`), `entityCode`,
  and `rootChartId` (adjacency-list parent pointer — hierarchy is Dean → School → Program →
  Area/Subarea → Course).
- **Entity type codes** — `src/modules/core/types/constants/type-codes.ts:44-51`,
  `TYPE_CODES.ENTITY_TYPE.{DEAN,SCHOOL,PROGRAM,AREA,SUBAREA,COURSE}`, group
  `TYPE_GROUP_CODES.ENTITY_TYPE = 'TG903'`.
- **The maintenance tree** — `ChartService.getMaintenanceTree()`
  (`api/charts.service.ts:51-56`) resolves the School header node via
  `ChartRepository.getSchoolChartNode(academicPeriodId, schoolId)`, then walks the whole
  Dean → School → Program → Area → Subarea → Course subtree via `getMaintenanceBranch`. This
  is exactly the scope the reset action needs: the tree already returned to the maintenance
  screen for one `(academicPeriodId, schoolId)` pair contains one Dean node (shared root),
  one School node, and all Programs/Areas/Subareas/Courses under that school.
- **Chart node → user resolution** — no direct chart→user link. Chain is
  `ChartEntity.staffId → organization.staff.id → organization.staff.userId → organization.users.id`
  (`StaffEntity`, `src/modules/organization/staff/model/staff.entity.ts`). `staff.userId` is
  nullable — a staff member can exist on a chart node without ever being linked to a login
  account.
- **Default password** — `DEFAULT_USER_PASSWORD` (`src/commons/configs/env.config.ts:42`,
  Zod-validated, min 8 chars), currently consumed only at user creation:
  `UserService.create()` (`api/users.service.ts:186-196`) does
  `hashPassword(this.configService.getOrThrow('DEFAULT_USER_PASSWORD'))`. This is the value
  this feature resets a password _to_.
- **Password hashing** — `hashPassword()`, `src/libs/secure.functions.ts:5-9` (bcrypt, 12
  rounds).
- **`READ_ONLY_ENTITY_TYPES`** (`core/charts.validation.ts:12`) = `[DEAN, SCHOOL, PROGRAM]` —
  these three cannot be created/updated/deleted through generic chart CRUD or the
  maintenance UI, only through `chart-heads`. This reset action does not write to
  `charts` at all (it only reads chart nodes to resolve users and writes to
  `organization.users`), so it does not trip that guard, but design should still gate it
  behind a permission consistent with who is allowed to manage chart heads/maintenance.
- **No existing bulk endpoint on charts.** Every write in `ChartController`
  (`config/charts.routes.ts`) operates on a single node id. The closest existing "select
  many, act once" convention in the codebase is `IfcPdfBulkDto`
  (`src/modules/evidence/ifcs/model/ifcs.dtos.ts:97-104`) — a validated `number[]` body,
  capped with `@ArrayMaxSize`.

## Goals

- From the org chart maintenance screen's context (one `academicPeriodId` +
  one `schoolId`, i.e. the same scope `GET .../maintenance/tree` already uses), let an admin
  select one or more entity types (`DEAN`, `SCHOOL`, `PROGRAM`, `AREA`, `SUBAREA`, `COURSE`)
  and reset the password of every user attached (via chart node → staff → user) to a chart
  node of a selected type within that school's maintenance tree, to the value of
  `DEFAULT_USER_PASSWORD`.
- `DEAN` is a single shared root per academic period, not one per school. When `DEAN` is
  among the selected types, the one Dean user for that academic period is reset regardless
  of which school's screen triggered the action (confirmed with requester).
- `SCHOOL` resets only the School node's user for the school the action was triggered from.
  `PROGRAM`/`AREA`/`SUBAREA`/`COURSE` reset only the users of nodes of that type within that
  school's subtree — never another school's.
- A chart node whose staff has no linked user (`staff.userId IS NULL`) is skipped, not
  treated as an error; the response reports which nodes/staff were skipped so nothing fails
  silently.
- If the same user is reachable through more than one in-scope chart node, their password is
  reset exactly once.

## Non-goals

- No frontend work. This change is the backend endpoint only; the checkbox/button UI on the
  maintenance screen is tracked separately.
- No audit/log record of who triggered a reset or which users were affected, beyond normal
  application request logging (confirmed with requester as out of scope for this change).
- No forced-password-change-on-next-login flag, no session/JWT invalidation of the affected
  users, and no email notification to reset users — none of these mechanisms exist today on
  `UserEntity`/`UserService`, and adding any of them is out of scope here.
- No change to `DEFAULT_USER_PASSWORD` itself (still one global value for the whole system,
  as it already is at user-creation time) and no per-role/per-node distinct default
  passwords.
- No change to the read-only-entity-type write guard (`READ_ONLY_ENTITY_TYPES`) — this
  action never writes to `charts`.

## Acceptance criteria

1. **AC-1** — Given an admin on the maintenance screen for a given `academicPeriodId` and
   `schoolId`, when they call the reset endpoint with a non-empty list of selected entity
   types, then every chart node of a selected type within that school's maintenance tree
   (Dean → School → Program → Area → Subarea → Course, as returned by the existing
   maintenance-tree scoping) whose staff has a linked user has that user's password set to
   `hashPassword(DEFAULT_USER_PASSWORD)`.
2. **AC-2** — Given only a subset of entity types is selected (e.g. only `PROGRAM`), when the
   action runs, then only users behind nodes of that type are reset; users behind nodes of
   unselected types in the same tree are left untouched.
3. **AC-3** — Given `DEAN` is among the selected types, when the action runs from any
   school's maintenance screen for a given academic period, then the one Dean user for that
   academic period is reset — the same result regardless of which school triggered it.
4. **AC-4** — Given `SCHOOL` is selected, when the action runs for school A, then only school
   A's School-node user is reset; another school's School-node user is never touched by this
   call.
5. **AC-5** — Given a chart node in scope whose staff has `userId IS NULL`, when the action
   runs, then that node is skipped (no error raised for it), and it is identified in the
   response as skipped.
6. **AC-6** — Given the same user is reachable through more than one in-scope chart node
   (e.g. one person heads two nodes), when the action runs, then their password is reset
   exactly once and they appear once in the response.
7. **AC-7** — Given the selected types resolve to zero chart nodes with a linked user (e.g.
   an empty subtree, or every matching node is unlinked), when the action runs, then the
   endpoint returns success with an empty reset list rather than an error.
8. **AC-8** — Given a caller without the required permission, when they call this endpoint,
   then it is rejected the same way other chart/organization admin endpoints are (permission
   guard, no partial effect).
9. **AC-9** — Given the response is returned, when inspected, then it lists the reset users
   (e.g. userId/staffId/chart node/entity type) and the skipped nodes (AC-5) — and never
   includes the plaintext or hashed default password.

### Traceability

| AC  | Criterion                                                               | Satisfied by                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Selected-type nodes in school's tree get user reset to default password | `ChartRepository.findChartUsersByTypes`, `ChartService.resetMaintenancePasswords`                                                                                                                                     |
| 2   | Unselected-type nodes in the same tree are untouched                    | `ChartRepository.findChartUsersByTypes` (`WHERE et.code = ANY($3)`)                                                                                                                                                   |
| 3   | DEAN reset is global-per-period, independent of triggering school       | `ChartRepository.findChartUsersByTypes` branch CTE anchor (design.md AC-3)                                                                                                                                            |
| 4   | SCHOOL reset is scoped to the triggering school only                    | `ChartRepository.findChartUsersByTypes` branch CTE second arm (design.md AC-4)                                                                                                                                        |
| 5   | Node with no linked user is skipped and reported, not an error          | `ChartService.resetMaintenancePasswords` (skipped partition)                                                                                                                                                          |
| 6   | A user reachable via multiple in-scope nodes is reset once              | `ChartService.resetMaintenancePasswords` (`chartIdsByUser` grouping)                                                                                                                                                  |
| 7   | Zero matching linked users returns success with empty result            | `ChartService.resetMaintenancePasswords`                                                                                                                                                                              |
| 8   | Unauthorized caller is rejected via permission guard                    | `ChartController.maintenanceResetPasswords` — `@RequirePermission({ module: ADMIN, action: POST })`. Originally `ORGANIZATION`; changed by the audit fix in `tasks.md` R1.1 — see `design.md`'s AC-8 superseded note. |
| 9   | Response reports reset + skipped, never the password value              | `UserService.resetPasswordsToDefault`, `UserRepository.resetPasswordsByIds`                                                                                                                                           |

## Dependencies

- `DEFAULT_USER_PASSWORD` env var (`src/commons/configs/env.config.ts`) — already required
  and validated; no new configuration needed.
- `hashPassword()` (`src/libs/secure.functions.ts`).
- Existing chart-tree traversal building blocks in `ChartRepository`
  (`getSchoolChartNode`, `getMaintenanceBranch` or equivalent recursive walk) to resolve
  "every node of type X within school Y's tree."
- `organization.staff` → `organization.users` link (`StaffEntity.userId`).

## Risks

| Risk                                                                                                                            | Impact                                                                  | Mitigation                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| One shared global default password means a single reset call can put several live accounts on the same known credential at once | Larger blast radius than the existing single-user creation-time default | Accepted by requester as consistent with existing creation-time behavior; no new mechanism introduced beyond what `UserService.create()` already does |
| No audit trail of who reset which users                                                                                         | A disputed reset later has no dedicated record to check                 | Explicitly accepted as out of scope for this change (confirmed with requester); revisit if it becomes a real incident                                 |
| This is a more sensitive action than ordinary chart-maintenance CRUD (it changes login credentials, not org structure)          | Wrong permission gate could let non-admins mass-reset passwords         | Design phase must pick a permission consistent with who already manages chart heads/maintenance, not just reuse the generic chart CRUD permission     |
| Existing reset password sessions aren't invalidated (JWT can't be invalidated on password change - documented accepted risk)    | A user whose password is force-reset stays logged in on existing tokens | Already an accepted, documented risk of the platform (`CONTEXT.md` § Security Decisions); not newly introduced by this change                         |

## Open questions

None — DEAN scope, unlinked-user handling, audit-trail scope, and repo scope were all
confirmed with the requester before writing this proposal.
