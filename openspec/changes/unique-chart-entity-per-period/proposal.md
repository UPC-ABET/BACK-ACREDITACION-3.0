# Unique chart entity per academic period

**Slug**: `unique-chart-entity-per-period`
**Branch**: `feat/unique-chart-entity-per-period`
**Repos affected**: backend (one frontend follow-up — see Dependencies)
**Created**: 2026-08-02

## Problem

The org chart lets the same real-world entity be attached to more than one node inside a
single academic period. Nothing stops a coordinator from creating a second node for course
`CS101` in `2026-1`, or an upload from loading one when a node for it already exists.

This is not a cosmetic duplicate. `organization.charts.entity_code` holds the internal id of
the referenced row (`schools.id` / `programs.id` / `courses.id`), and downstream queries join
on it directly — several without even filtering on entity type:

- `src/modules/evidence/ifcs/core/ifcs.repository.ts:630` resolves an IFC's current status via
  `charts c ON c.entity_code = i.course_id AND c.academic_period_id = i.academic_period_id`.
  Two course nodes for one course in one period turn a single-row lookup into a multi-row one.
- `src/modules/ifc/notifications/core/notification-dispatcher.sql.ts` walks `root_chart_id`
  from a course node up to the School node to decide who gets notified. Duplicate nodes mean
  two competing answers to "who is responsible for this course", and the dispatcher takes
  whichever the plan happens to return.
- `src/modules/organization/org-scope/core/org-scope.repository.ts:42` scopes a user's access
  by `entity_code`, so a duplicate widens or splits access silently.

The cost lands on the people running accreditation: IFC notifications go to the wrong
responsible or go twice, IFC status reads become non-deterministic, and the fix is a manual
hunt through a tree that gives no signal that anything is wrong. The system looks entirely
correct while producing the wrong answer, which is the expensive kind of defect.

## What already exists

`organization.charts` (`src/modules/organization/charts/model/charts.entity.ts`) —
`staffId`, `academicPeriodId`, `rootChartId`, `title`, `entityTypeId`, `entityCode`,
`uploadLogId`, on `BaseEntity`. Both `entityTypeId` and `entityCode` are nullable.

There is **no unique index on this table in any migration**. The duplicate rules that do
exist are inconsistent across the three write paths:

| Path                     | Entry point                                                                                                                             | Duplicate check today                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Excel upload             | `audit.fn_upload_charts`, current body in `src/database/migrations/1781649412764-reject-chart-upload-email-mismatch-for-linked-user.ts` | Intra-file duplicate **node code** only (`duplicateCodeInFile`). Nothing on entity type/code; nothing against rows already in the database.                      |
| Org chart maintenance UI | `ChartValidation.validateMaintenanceCreate` / `validateMaintenanceUpdate` (`core/charts.validation.ts`)                                 | **None.** Validates the parent, the staff, the entity type and that the referenced entity exists — never uniqueness.                                             |
| Generic CRUD             | `ChartValidation.validateCreate` / `validateUpdate`                                                                                     | `(staffId, academicPeriodId, entityCode)` → `error.chart.chartExists`. A different key from the one this change introduces, and it ignores entity type entirely. |

Supporting pieces already in place and reusable:

- `entityTypeNeedsCode()` / `ENTITY_TYPES_WITH_CODE` (`core/charts.validation.ts:9-13`) —
  already names School, Program and Course as the entity types that carry a code.
- `ChartRepository.getEntityTypeCode()`, `entityExists()`, `getNodeWithType()`
  (`core/charts.repository.ts`) — type and entity resolution helpers.
- `ChartsUploadRepository.chartsLoadedForSchoolPeriod()` — blocks a _second_ upload for the
  same school and period outright, so the upload path's DB-collision case is a file colliding
  with nodes created by the maintenance UI, or with another school's nodes in the same period.
- `chartsErrorMessages` (`src/modules/uploads/charts/model/charts-template.labels.ts`) — the
  es/en map that turns a PG error code into the text written into the returned Excel. Upload
  errors are localized server-side and never reach the frontend as keys.
- `chartsValidationStrings` (`config/strings/charts.validation.ts`) — i18n keys.
- Prior art for an enforced uniqueness rule with a data-cleanup step:
  `src/database/migrations/1783575251494-enforce-unique-student-course-enrollment.ts`.

## Goals

- One entity is represented by at most one chart node per academic period, enforced on every
  write path — upload, maintenance create, maintenance edit, generic CRUD.
- The invariant holds in the database itself, not only in application code, so a future code
  path or a concurrent write cannot break it.
- A rejected upload names the offending rows in the returned Excel, in the file's language,
  the same way every other upload error already does.
- The rule is stated once and applied identically by all four callers.

## Non-goals

- Changing `entity_code` to store business codes instead of internal ids.
- Adding a `school_id` column to `organization.charts`.
- Uniqueness on any other tuple — staff, title, or parent are not part of this rule.
- Reworking the tree structure, the maintenance tree endpoint, or the upload template layout.
- De-duplicating nodes automatically. Where production data already violates the rule, this
  change surfaces the conflicts; deciding which node survives is a data decision for the team.
- Fixing the downstream joins that omit an entity-type filter (e.g. `ifcs.repository.ts:630`).
  The invariant makes them correct; tightening them is separate work.

## Decisions taken (agreed 2026-08-02)

These were open at the start and are now settled. They are recorded here because each one
changes what "correct" means for the ACs below.

1. **Key is `(academicPeriodId, entityTypeId, entityCode)`, global per period** — not scoped
   per school. Two schools cannot both hold a node for the same course in the same period.
   `charts` has no `school_id`, so a school-scoped rule would need a recursive `root_chart_id`
   walk on every write and could not be a plain database constraint.
   **Reconfirmed 2026-08-02:** the cross-school case is not an exception to tolerate — it is
   precisely the situation this change exists to prevent. Design must not reopen this.
2. **Nodes with `entityCode IS NULL` are exempt.** Area, Subarea and untagged generic nodes may
   repeat freely within a period. This matches `ENTITY_TYPES_WITH_CODE` and matches SQL NULL
   semantics in a partial unique index.
3. **Enforced in the application _and_ in the database**, via a partial unique index.
4. **The existing `(staffId, academicPeriodId, entityCode)` check is replaced**, not kept
   alongside. All four paths converge on the one key.
5. **Only active nodes participate** (`is_active = true`). A soft-deleted node must not block
   re-adding the entity. Noted as an assumption rather than a question — say so if it is wrong.

## Acceptance criteria

1. **AC-1** — Given an active chart node for `(period P, entity type PROGRAM, entity code E)`,
   when a user calls maintenance create for another node with the same trio, then the request
   is rejected with `400` and the error list contains the new duplicate key; no row is written.

2. **AC-2** — Given two active nodes A and B in period P, when maintenance update changes B's
   entity type or entity code so that B's trio equals A's, then the request is rejected with
   `400`; and when the update leaves B's trio unchanged (or changes only staff/title), it
   succeeds — a node never collides with itself.

3. **AC-3** — Given an active node for `(P, PROGRAM, E)`, when generic CRUD create is called
   with the same trio, then the request is rejected with `400`, regardless of which `staffId`
   the new node names. Conversely, a create whose trio is free succeeds even when it reuses a
   `staffId` and `entityCode` combination that the old `(staffId, period, entityCode)` rule
   would have rejected.

4. **AC-4** — Given an active node, when generic CRUD update would move it onto another active
   node's trio in the same period, then the request is rejected with `400`; updating the node
   without changing its trio succeeds.

5. **AC-5** — Given any number of existing Area, Subarea or untagged nodes in period P, when
   another such node (`entityCode` null) is created via any write path, then it is accepted.
   The rule never fires for a null entity code.

6. **AC-6** — Given an upload file containing two rows that resolve to the same
   `(entity type, entity code)`, when the file is processed for period P, then no rows are
   written, the response carries `success: false`, and the returned Excel marks **both** rows
   in the error column with the localized duplicate message in the file's language (es and en
   both present in `chartsErrorMessages`).

7. **AC-7** — Given an active node for `(P, COURSE, E)` created through the maintenance UI,
   when an upload for period P contains a row resolving to `(COURSE, E)`, then the upload is
   rejected, no rows are written, and the returned Excel marks that row with the localized
   "already exists in this period" message.

8. **AC-8** — After the migration, a direct `INSERT` into `organization.charts` duplicating an
   active `(academic_period_id, entity_type_id, entity_code)` with a non-null `entity_code`
   fails on the unique index. An insert with `entity_code IS NULL`, or one duplicating an
   `is_active = false` row, succeeds.

9. **AC-9** — The migration's `up()` is safe to run against a database that already contains
   violating rows: either it resolves them by an explicitly documented rule, or it fails with a
   message that names the conflicting `(period, entity type, entity code)` groups. It must not
   silently delete chart nodes. `down()` drops the index and restores the prior state.

10. **AC-10** — `ChartValidation` has spec coverage for the new rule on all four application
    entry points, including the self-exclusion case (AC-2/AC-4) and the null-entity-code
    exemption (AC-5). Each new test is confirmed to fail before the change that makes it pass.

11. **AC-11** — The old `(staffId, academicPeriodId, entityCode)` condition no longer appears in
    `validateCreate` / `validateUpdate`, and no route, DTO or response shape changes, so
    `openapi.json` is unaffected. If any of that turns out to be false during design, the spec
    is regenerated in the same PR.

### Traceability

Filled in by `/abet-design-feature` and kept current through implementation.

| AC  | Criterion                                                         | Satisfied by                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Maintenance create rejects a duplicate trio                       | `charts.validation.ts` → `validateMaintenanceCreate` calling `isEntityTakenInPeriod`, backed by `charts.repository.ts` → `findActiveNodeByEntity` (filters `isActive`). Tests: `charts.validation.spec.ts` § validateMaintenanceCreate                                                                                 |
| 2   | Maintenance update rejects a duplicate trio, excludes self        | `charts.validation.ts` → `validateMaintenanceUpdate`, passing `excludeChartId: id` and resolving the written trio through the shared `resolveEffectiveEntity`, which `charts.service.ts` → `updateNode` also calls. Tests: `charts.validation.spec.ts` § validateMaintenanceUpdate, `charts.service.spec.ts`           |
| 3   | Generic create rejects on the new key, independent of staff       | `charts.validation.ts` → `validateCreate`. Tests: `charts.validation.spec.ts` § validateCreate, incl. the case the old staff-based rule rejected now passing                                                                                                                                                           |
| 4   | Generic update rejects a duplicate trio, excludes self            | `charts.validation.ts` → `validateUpdate`, merging the DTO over the stored row before checking. Tests: `charts.validation.spec.ts` § validateUpdate                                                                                                                                                                    |
| 5   | Null entity code is exempt on every path                          | Single early return in `isEntityTakenInPeriod` (null type **or** null code → free), plus the index predicate `WHERE entity_code IS NOT NULL`. Tests: one case per path in `charts.validation.spec.ts`                                                                                                                  |
| 6   | Upload rejects intra-file duplicates, both rows annotated         | Migration `1785730489320` → `duplicateEntityInFile`, grouped on the resolved entity id with a window function so **every** row of the group is returned; es/en text in `charts-template.labels.ts`. Tests: `charts-upload.service.spec.ts` (message mapping); runbook step 6 (behaviour)                               |
| 7   | Upload rejects a row colliding with an existing node              | Migration `1785730489320` → `entityAlreadyInPeriod`, resolving the file's business code to an internal id before comparing against `charts.entity_code`. Verified live via `audit.fn_upload_charts`; runbook steps 7–8                                                                                                 |
| 8   | Partial unique index enforces the invariant in Postgres           | Migration `1785730489320` → `UQ_charts_academic_period_entity_type_entity_code`, unique + partial on `entity_code IS NOT NULL AND is_active`. Race translated to a domain conflict by `charts.repository.ts` → `translateDuplicateNode` on `create`, `update` and `updateNode`. Tests: `charts.repository.spec.ts`     |
| 9   | Migration is safe against pre-existing duplicates; `down()` works | Migration `up()` guard queries the violating groups and throws naming each `(period, entity type, entity)` with its chart ids, before any write and without deleting anything; `down()` drops the index and restores the prior function body. Exercised against a live database — the guard aborted on two real groups |
| 10  | Validation specs cover all four paths and both edge cases         | `charts.validation.spec.ts` (25 cases), `charts.repository.spec.ts` (9), `charts.service.spec.ts` (5). Each new case confirmed red before the change that made it pass; the two pre-existing `validateCreate` fixtures were rewritten first because they passed on `undefined` fields                                  |
| 11  | Old staff-based rule removed; `openapi.json` unaffected           | `chartExists` deleted from `config/strings/charts.validation.ts`; `grep -rn "chartExists" src/` empty; `pnpm openapi:export` produces no diff — no route, DTO or response shape changed                                                                                                                                |

## Dependencies

- **Production data — audited clean 2026-08-02.** The requester ran the duplicate audit against
  production: **zero** active rows violate `(academic_period_id, entity_type_id, entity_code)`
  where `entity_code IS NOT NULL`. No dedup work is needed and no cross-school duplicate exists
  today, so the migration has a clean run ahead of it.
  This is a point-in-time measurement, not a guarantee. Production keeps accepting writes and
  nothing prevents a new duplicate until this change ships, so AC-9 stands: the migration must
  still fail loudly rather than assume the table is clean. Re-run the check immediately before
  deploying.
- **`audit.fn_upload_charts` must be re-created wholesale.** Per
  [POLICIES.md § Migrations](../../../docs/POLICIES.md#migrations), the change is a new
  forward-only migration carrying a full `CREATE OR REPLACE FUNCTION` body, with `down()`
  restoring the body from `1781649412764`. The existing chart-upload migrations are the model.
- **New upload error codes** need entries in both `es` and `en` of `chartsErrorMessages`
  (`src/modules/uploads/charts/model/charts-template.labels.ts`), or the raw code leaks into
  the user's Excel.
- **New i18n key** in `chartsValidationStrings` for the application-path rejection. The
  frontend (`UPC-ABET/FRONT-ACREDITACION-3.0`) renders these keys, so it needs the matching
  translation added — a small follow-up in that repo, not part of this change's PR.
- No external system involved: no Banner, uPlanner, Entra ID or S3 dependency.

## Risks

| Risk                                                                                  | Impact                                                                      | Mitigation                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A duplicate appears between now and deployment                                        | Migration fails on the unique index during a release                        | Downgraded from the original risk — production audited clean on 2026-08-02 (zero violating rows). The window is real but small, and AC-9 makes the failure loud rather than silent. Re-run the audit as a pre-deploy step |
| ~~Global-per-period key blocks a legitimate cross-school case~~ **Closed 2026-08-02** | —                                                                           | Not a risk. The requester confirmed that one entity under two schools in the same period is itself the defect being fixed. Where the audit finds such rows they are conflicts to resolve, not evidence against the key    |
| Duplicate detection added to `fn_upload_charts` degrades on large files               | A 1000-row template (`TEMPLATE_MAX_ROWS`) times out                         | Follow the set-based style of `1784093233471-set-based-student-sections-upload-function.ts`; avoid per-row subqueries over `p_rows`                                                                                       |
| Rule is implemented four times and drifts                                             | Upload accepts what the UI rejects, reintroducing the current inconsistency | Single source of truth for the key. Design must say explicitly where it lives and how the PG function stays aligned with the TypeScript rule                                                                              |
| Existing callers depend on the old staff-based rejection                              | Something that fails today starts succeeding (see AC-3, second half)        | Search for `chartExists` usage across both repos during design; the key removal is a deliberate behaviour change, so it belongs in the PR description                                                                     |
| Concurrent maintenance creates race past the application check                        | Two duplicate nodes land despite validation                                 | The partial unique index (decision 3) is the backstop; the service must translate the resulting constraint violation into the same i18n error rather than a `500`                                                         |

## Open questions

None. The four decisions above close the ambiguity that blocked design, and both data
questions were answered on 2026-08-02 before design started: production holds zero violating
rows, and the cross-school case is confirmed as the defect being fixed rather than an
exception to accommodate. Design can proceed on a clean table and a settled key.
