# Course chart nodes always resolve to a pre-configured program

**Slug**: `chart-program-ancestry`
**Branch**: `feat/chart-program-ancestry`
**Repos affected**: both (see Dependencies for the frontend follow-up)
**Created**: 2026-08-18

## Problem

The org chart's Excel upload builds an arbitrary `code`/`parentCode` tree of Program, Area,
Subarea and Course nodes under a school, and today any row can attach directly under the
School node with a blank `parentCode`. Nothing requires a Course — or the Area/Subarea above
it — to ever pass through a Program node on its way up. A coordinator can upload a Course
straight under the school, or an Area with no career above it, and the upload accepts it.

This matters because "which career is this course part of" is exactly the kind of fact IFC
routing, evidence and reporting eventually need to walk back up the tree to answer, the same
way `root_chart_id` is already walked to find a course's responsible School
(`src/modules/ifc/notifications/core/notification-dispatcher.sql.ts`, per the
`unique-chart-entity-per-period` change). A course with no career ancestor is a course nobody
can correctly attribute to a program later, and the upload gives no signal today that anything
is wrong.

## What already exists

- **`organization.charts`** (`src/modules/organization/charts/model/charts.entity.ts`) — the
  tree: `staffId` (not nullable), `academicPeriodId`, `rootChartId`, `title`, `entityTypeId`,
  `entityCode`. `TYPE_CODES.ENTITY_TYPE` defines `DEAN`, `SCHOOL`, `PROGRAM`, `AREA`,
  `SUBAREA`, `COURSE`; `ENTITY_TYPES_WITH_CODE` = School, Program, Course
  (`src/modules/organization/charts/core/charts.validation.ts`).
- **`admin/organization/chart-heads`** — the direct precedent for this change. A dedicated
  admin action (`ConfigureChartHeadsDto`) pre-creates the Dean node and one Director node per
  school, _before_ any Excel upload. `ChartHeadsRepository.upsertHead` is idempotent per
  `(period, entityTypeId, entityCode)` — a repeat call updates staff/title on the existing
  node rather than duplicating it, and never deletes a node omitted from a later call.
- **`uploads/charts`** (`ChartsUploadService`, `audit.fn_upload_charts`) — the Excel path.
  `processUpload` already refuses to run until `schoolChartExists(schoolId, period)`. Rows
  carry `code`, `parentCode`, `title`, `professorCode`, `email`, `entityType`, `entityCode`.
  `UPLOADABLE_ENTITY_TYPE_CODES` currently allows Program, Area, Subarea, Course as a row's own
  tag. A blank `parentCode` today means "attach directly under the School node"; a non-blank
  value must match another row's `code` in the same file or the upload fails with
  `parentNotFound`.
- **`academic.programs`** (`src/modules/academic/programs/model/programs.entity.ts`) — the
  program catalog: `code`, `name`, `degree`, `modalityTypeId`. **No `school_id`** — a
  program's association with a school exists only through the org chart tree, nowhere else.
- **`unique-chart-entity-per-period`** (`openspec/specs/unique-chart-entity-per-period`) — the
  most relevant prior art. It already enforces one active chart node per
  `(academicPeriodId, entityTypeId, entityCode)` globally across schools, via a partial unique
  index (`UQ_charts_academic_period_entity_type_entity_code`) plus identical checks in
  `ChartValidation` on all four write paths (Excel upload, maintenance create/update, generic
  CRUD). This change reuses that invariant rather than introducing a new one, and inherits its
  explicit lesson: a rule expressed once per write path drifts unless it's the same rule
  everywhere.

## Goals

- A Program chart node is only ever created through a dedicated pre-configuration action
  (extending or sitting beside `chart-heads`), never through the Excel upload — an admin
  attaches one or more `academic.programs` to a School for a period, each with an assigned
  coordinator, the same idempotent-upsert way Directors work today.
- The Excel upload never asks the uploader to select a program up front. Instead, any row's
  `parentCode` may name a real program code; if that program is pre-configured for the school
  being uploaded to, the row attaches under it.
- A blank `parentCode` is no longer accepted for any row — every Area, Subarea and Course must
  resolve, directly or transitively, to a pre-configured Program node.
- The same requirement holds on every write path that can create or move a chart node:
  Excel upload, maintenance-UI create/update, and generic CRUD create/update.
- A rejected row names the actual problem (parent not found at all, vs. a program that exists
  in the catalog but isn't configured for _this_ school) rather than one generic error.

## Non-goals

- Adding a `school_id` column to `academic.programs`. A program's school association continues
  to live only in the org chart, established by the pre-configuration action.
- Changing what a row's own `entityType`/`entityCode` tag means for Area, Subarea or Course —
  only removing `PROGRAM` as a value a row can tag itself with.
- Retroactively fixing, flagging, or deactivating chart nodes from already-loaded periods that
  violate the new rule. This surfaces the problem going forward; existing data is a rollout
  dependency (see below), not something this change silently repairs.
- Changing the `(academicPeriodId, entityTypeId, entityCode)` uniqueness invariant or its index
  — reused as-is from `unique-chart-entity-per-period`.
- Scoping Program pre-configuration by modality. It follows the same school+period scoping
  `chart-heads` already uses.
- Allowing a Program to be _removed_ from a school through the pre-configuration action.
  Matches the existing `chart-heads` precedent — deactivation, if ever needed, is a separate
  maintenance-UI action, not part of this change.
- Building the frontend screens. Tracked as a cross-repo dependency below.

## Acceptance criteria

1. **AC-1** — Given an admin pre-configuration call attaching Program `X` to School `S` for
   period `P` with coordinator staff `T`, when the call succeeds, then a chart node exists
   with `entityTypeId = PROGRAM`, `entityCode = X`, `staffId = T`, `rootChartId` = School `S`'s
   Director node. Calling it again with the same trio updates staff/title on the existing node
   rather than creating a duplicate (same semantics as `ChartHeadsRepository.upsertHead`).

2. **AC-2** — Given Program `X` already configured under School `A` for period `P`, when an
   admin attempts to configure `X` under School `B` for the same period, then the request is
   rejected — a program may be attached to at most one school per period. No new index is
   introduced; this reuses `UQ_charts_academic_period_entity_type_entity_code`.

3. **AC-3** — Given Program `X` is configured for School `S` in period `P`, when an Excel
   upload for School `S` / period `P` contains a row whose `parentCode` equals `X`'s code, then
   that row attaches under `X`'s chart node, regardless of whether the row is an Area, a
   Subarea, or a Course.

4. **AC-4** — Given Program `X` is configured for School `A` only, when an Excel upload for
   School `B` (a different school) in the same period contains a row whose `parentCode` equals
   `X`'s code, then the row is rejected with an error stating the program is not configured for
   this school — distinct from "parent not found," even though `X` is a valid program in the
   catalog.

5. **AC-5** — Given an Excel upload row whose `parentCode` matches neither another row's `code`
   in the file nor any program code configured for the target school, then the row is rejected
   with the existing parent-not-found error, and no other row is penalized as a side effect.

6. **AC-6** — Given an Excel upload row with a blank `parentCode`, then the row is always
   rejected. Direct attachment under the School node is no longer available to Area, Subarea,
   or Course rows through this upload.

7. **AC-7** — Given a chain of rows in one upload where only the topmost row's `parentCode`
   fails to resolve (blank, or naming neither a file code nor a configured program), then only
   that topmost row is marked with the error in the returned Excel — rows beneath it, whose own
   `parentCode` correctly names their immediate (file-local) parent, are not separately flagged
   for the same root cause.

8. **AC-8** — `PROGRAM` is removed from the entity types a row can tag itself as in the Excel
   upload (`UPLOADABLE_ENTITY_TYPE_CODES`) and from the generated template's entity-type
   dropdown and legend. A row that still specifies `PROGRAM` as its own `entityType` is
   rejected with an error stating Program nodes are configured separately, not uploaded.

9. **AC-9** — Given a chart node created or updated through the maintenance UI or generic CRUD
   whose parent does not resolve — directly, or through its persisted `rootChartId` ancestry —
   to a Program-typed node before reaching the School node, then the create/update is rejected.
   The same rule as AC-3–AC-6, expressed against real ancestry instead of file-local codes, and
   it does not re-validate ancestors that were already valid when they were written.

10. **AC-10** — A rollback of an org-chart Excel upload (`audit.fn_rollback_charts`) never
    deactivates or removes a Program chart node — Program nodes are written only by the
    pre-configuration action in AC-1 and are never part of what a given upload's
    `uploadLogId` created.

11. **AC-11** — `openapi.json` reflects the pre-configuration endpoint (new or extended) and
    any changed upload/template response shape; regenerated and committed in the same PR.

12. **AC-12** — `ChartValidation` (or its equivalent after design) has spec coverage for: a
    program-not-configured-for-this-school rejection, a blank-`parentCode` rejection, correct
    attachment under a pre-configured program for Area/Subarea/Course, and the maintenance/CRUD
    ancestor-chain check including the self-exclusion case. Each new test is confirmed to fail
    before the change that makes it pass.

### Traceability

Filled in by `/abet-design-feature` and kept current through implementation.

| AC  | Criterion                                                      | Satisfied by |
| --- | -------------------------------------------------------------- | ------------ |
| 1   | Pre-config upserts a Program node idempotently                 | TBD          |
| 2   | A program may belong to at most one school per period          | TBD          |
| 3   | Excel row attaches under its school's pre-configured program   | TBD          |
| 4   | Program configured for a different school is rejected          | TBD          |
| 5   | Unresolvable `parentCode` keeps today's parent-not-found error | TBD          |
| 6   | Blank `parentCode` is always rejected                          | TBD          |
| 7   | Only the topmost broken row in a chain is flagged              | TBD          |
| 8   | `PROGRAM` removed from uploadable row types and template       | TBD          |
| 9   | Maintenance UI / generic CRUD enforce the same ancestry rule   | TBD          |
| 10  | Upload rollback never touches Program nodes                    | TBD          |
| 11  | `openapi.json` regenerated for the pre-config endpoint         | TBD          |
| 12  | Spec coverage for the new rule, confirmed red-then-green       | TBD          |

## Dependencies

- **Frontend** (`UPC-ABET/FRONT-ACREDITACION-3.0`) needs a Program pre-configuration screen
  (extending or sitting beside the existing chart-heads screen) and the Excel template change
  (Program dropped from the entity-type dropdown/legend). Tracked as a follow-up in that repo,
  not part of this PR.
- **Production audit before deploy**: existing periods may already contain Area/Subarea/Course
  chains with no Program ancestor, uploaded under the old, more permissive rule. Following the
  `unique-chart-entity-per-period` precedent, this needs a pre-deploy audit query; the new rule
  applies going forward and does not retroactively alter existing chains (see Non-goals).
- Reuses `UQ_charts_academic_period_entity_type_entity_code` from
  `unique-chart-entity-per-period` — no new index for AC-2.
- Directly touches `chart-heads` (or its extension) and `audit.fn_upload_charts`; the latter
  is a forward-only migration carrying a full `CREATE OR REPLACE FUNCTION` body per
  [POLICIES.md § Migrations](../../../docs/POLICIES.md#migrations).

## Risks

| Risk                                                                                        | Impact                                                                                     | Mitigation                                                                                                             |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Existing periods already contain chains with no Program ancestor                            | New validation could appear to "break" historical data if misapplied                       | Rule is enforced on new writes going forward only (Non-goals); pre-deploy audit surfaces the scale of the gap          |
| Removing Program from `UPLOADABLE_ENTITY_TYPE_CODES` changes the distributed Excel template | Schools using an old template hit a new, unfamiliar rejection                              | Coordinate rollout with frontend; regenerate and redistribute the template with the same release                       |
| A file-local row `code` could coincidentally equal a real program's code                    | Ambiguous `parentCode` resolution (local row vs. program)                                  | Design fixes and documents one precedence (file-local codes checked first, program codes second) in `fn_upload_charts` |
| Rule expressed twice — PG function for Excel, TypeScript for maintenance/CRUD               | The two drift, reproducing exactly the risk called out in `unique-chart-entity-per-period` | Single documented rule, both call sites reviewed together in the same PR                                               |
| New/extended pre-config endpoint needs the same permission and scope wiring as chart-heads  | Endpoint ships without `@RequirePermission` or scope headers wired correctly               | Follow `chart-heads.controller.ts` as the direct template                                                              |

## Open questions

None. The mechanism (pre-configuration creates Program nodes; the Excel references them by
code as a parent; blank `parentCode` is disallowed; the rule applies to all four write paths)
was settled in discussion on 2026-08-18.
