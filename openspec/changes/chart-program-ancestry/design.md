# Design — Course chart nodes always resolve to a pre-configured program

**Slug**: `chart-program-ancestry`
**Proposal**: `./proposal.md`

## Read first

- `docs/CONTEXT.md` § Business Rules — the existing "at most one active org chart node per
  entity per period" rule this change builds on top of, and § Database (`organization`,
  `academic`, `core` schemas).
- `docs/POLICIES.md` § Migrations, § Database Access (Repository Boundary), § Naming
  Conventions.
- `openspec/specs/unique-chart-entity-per-period/proposal.md` and its
  `design.md`/`tasks.md` — direct prior art: same table, same `fn_upload_charts` function,
  same four-write-paths shape, and the exact lesson this design reuses (one rule, one place,
  applied identically everywhere, or it drifts).
- `src/modules/organization/charts/model/charts.entity.ts`,
  `src/modules/organization/charts/core/charts.validation.ts`,
  `src/modules/organization/charts/core/charts.repository.ts` — the code this change extends.
- `src/modules/admin/organization/chart-heads/` (all files) — the pre-configuration pattern
  this change clones for Program.
- `src/modules/uploads/charts/` (all files) — the Excel path.
- `src/database/migrations/1785730489320-enforce-unique-chart-entity-per-period.ts` — the
  current, live body of `audit.fn_upload_charts`; this change's migration recreates it wholesale.
- `src/libs/school-program.functions.ts` — existing precedent for resolving "is this program
  under this school" via `root_chart_id`, confirming the chosen SQL shape is already used
  elsewhere in the codebase (program listing filters), not invented for this change.

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                             |
| --------------------------------------------- | -------------------------------- |
| Datastore, broker or cache choice             | No                               |
| Auth or payments provider                     | No                               |
| Public API contract change or breaking change | Partially — assessed, not an ADR |
| New module boundary or cross-repo split       | No                               |
| Language, runtime or framework                | No                               |
| Contradicting an existing ADR                 | No                               |

**Conclusion**: no ADR required.

The one non-trivial row: `chart-heads`' `configure` endpoint gains a `programs` array on
each director. It is designed as **optional** (`@IsOptional()`, defaults to none configured)
so every existing call to `POST /admin-chart-heads/configure` keeps working unchanged — this
is an additive DTO change, not a breaking one. Separately, the Excel upload narrows what it
_accepts_ (Program can no longer be a row's own tag; a blank `parentCode` is now rejected).
That is a business-rule tightening on top of an unchanged request shape, not a route or DTO
contract change — the same kind of change `unique-chart-entity-per-period` made (new
rejection codes on an existing upload) without an ADR. No datastore, auth provider, module
boundary or language choice is involved.

## Approach

### AC-1 / AC-2 — Program pre-configuration, one school per period

Extends `chart-heads` rather than adding a new module: it already has the exact mechanism
needed — `ChartHeadsRepository.upsertHead`, idempotent per
`(academicPeriodId, entityTypeId, entityCode)`, updating staff/title in place on a repeat call
and never deleting a node omitted from one. `ConfigureChartHeadsDto.directors[]` gains a
`programs?: ChartProgramDto[]` (`programId`, `staffId`, `userId?`, `title`), and `configure()`
resolves the Program type id once and calls `upsertHead` per program with
`entityCode: programId`, `rootChartId: <that director's own chart id, already known from the
same loop iteration>`.

**The gap `upsertHead` does not close on its own**: it keys on `(period, entityTypeId,
entityCode)` alone, so calling `configure` twice with the same `programId` under a _different_
director does not fail — it silently moves the existing node's `rootChartId` to the new
school. That is exactly AC-2's rejection case, not a re-parent. `ChartHeadsValidation.
validateConfigure` must therefore check, **before** any upsert runs, whether a requested
`programId` already has an active chart node under a different school this period (new
repository method `findProgramsConfiguredForOtherSchool`), and reject the whole call if so —
the same way it already rejects a `programId` repeated twice within one payload. The global
partial unique index (`UQ_charts_academic_period_entity_type_entity_code`, from
`unique-chart-entity-per-period`) still backstops the plain duplicate-insert case; this
check covers the update-in-place case the index cannot see because it is not a second row.

### AC-3 / AC-4 / AC-5 / AC-6 / AC-7 — Excel `parentCode` resolves to a configured program

`audit.fn_upload_charts` is recreated wholesale (forward-only migration, full
`CREATE OR REPLACE FUNCTION` body, per POLICIES § Migrations). Three changes to the existing
per-row validation loop, in the same style as the duplicate-entity checks
`unique-chart-entity-per-period` already added:

1. The entity-type resolution subquery drops `'TG903-T003'` (Program) from its `IN (...)`
   list, leaving Area/Subarea/Course. A row still tagged `Program` in the file simply fails to
   resolve and falls into the existing `entityTypeInvalid` branch — no new error code needed
   for this part (AC-8), it is a direct, honest consequence of Program no longer being a
   selectable type.
2. `parent_code` is required now — a `NULL` (blank) value raises a new `parentCodeEmpty`
   error, mirroring the existing `codeEmpty`/`titleEmpty` shape exactly.
3. Where the old function only checked "does `parent_code` match another row's `code`",
   the new one checks, in this order (**local file code wins over a program code** — a
   documented, deliberate precedence in case of an unlikely collision):
   - matches a row's `code` in this file → unchanged, resolved in the existing wiring pass.
   - else, matches `academic.programs.code` (active) → check whether that program has an
     active chart node under **this specific `p_school_id`** for this period (its
     `root_chart_id` equal to the school's own chart id, resolved via `v_school_chart_id`,
     already computed for the school lookup). If yes, the row is valid; if the program exists
     but its configured node belongs to a different school (or none), reject with the new
     `programNotConfiguredForSchool` — distinct from a code that resolves to nothing at all.
   - else → the existing `parentNotFound`.

A new wiring pass mirrors "pass 2" (which links file-local parent/child pairs) but links rows
whose `parent_code` resolved to a program instead: `root_chart_id` is set directly to that
program's chart id. The old "pass 3: top-level rows hang under the school node" is deleted —
nothing reaches that stage with a still-unresolved parent any more, since a blank or
unresolvable `parent_code` is now caught in the per-row validation loop before any insert.

**AC-7 (topmost-node attribution) requires no new logic.** A row several levels under a
broken chain still has a `parent_code` that correctly names its own immediate, file-local
parent — that check still passes for it. Only the row actually missing a valid parent (blank,
or naming neither a file code nor a configured program) fails, so per-row validation already
produces exactly one error per broken chain, at its root, with no chain-walk required.

### AC-8 — Program no longer uploadable as a row

Covered structurally above (§ AC-3–7, point 1). On the TypeScript side,
`UPLOADABLE_ENTITY_TYPE_CODES` and `ENTITY_TYPE_CODES_REQUIRING_CODE` in
`charts-upload.service.ts` drop `TYPE_CODES.ENTITY_TYPE.PROGRAM`, so the generated template's
entity-type dropdown and legend never offer it. The legend sheet gets one added line
explaining that `parentCode` may be a program's own code, since that is now the _only_ way a
program appears in the file.

### AC-9 — Same ancestry rule on maintenance UI and generic CRUD

Two independent gaps close together here, both flowing from the same underlying fact: Program
becomes a **read-only entity type** (`READ_ONLY_ENTITY_TYPES` in `charts.validation.ts` gains
`ENTITY.PROGRAM`, joining School and Dean — `SCHOOL` already sits in both
`READ_ONLY_ENTITY_TYPES` and `ENTITY_TYPES_WITH_CODE`, so Program joining both lists is not a
new shape, just a new member). This is a necessary companion to AC-1/AC-2, not a separate
decision: without it, the maintenance UI and generic CRUD would remain a second, uncontrolled
way to create or retarget a Program node, reopening exactly the loophole this change closes on
the Excel side.

With Program read-only, only Area/Subarea/Course can ever be created or re-typed through these
paths, and a new repository method decides ancestry for exactly those three:

```
hasProgramAncestor(chartId: number | null): Promise<boolean>
```

A recursive CTE starting at `chartId` (inclusive) and walking `root_chart_id` upward, true if
any node in that walk — including `chartId` itself — is Program-typed.
`chartId === null` short-circuits to `false` (no parent, no ancestor).

Applied at four call sites:

- `validateMaintenanceCreate` — after `typeCode` resolves and only for Area/Subarea/Course,
  check `hasProgramAncestor(dto.rootChartId)`.
- `validateMaintenanceUpdate` — `UpdateChartNodeDto` has no `rootChartId` field, so a node's
  parent cannot move through this path; the only new case is re-typing an existing node
  _into_ Area/Subarea/Course, so the check runs against the node's own **existing**
  `rootChartId` (which `getNodeWithType` must now also return — currently it does not) when
  `newTypeCode` requires an ancestor.
- Generic `validateCreate` — `CreateChartDto.rootChartId` is optional; the check runs when
  the resolved entity type requires an ancestor, against `data.rootChartId ?? null`.
- Generic `validateUpdate` — `UpdateChartDto.rootChartId` can move a node, so the check runs
  against `data.rootChartId ?? entity.rootChartId` whenever either `rootChartId` or
  `entityTypeId` is present in the payload (mirrors the existing condition that already
  guards the uniqueness re-check in this method, so it does not re-walk ancestry on every
  staff/title-only edit).

New i18n key: `chartsValidationStrings.error.programAncestorRequired`
(`error.chart.programAncestorRequired`).

### AC-10 — Rollback never touches Program nodes

No code change. `audit.fn_rollback_charts` deletes chart nodes by `upload_log_id`
(confirmed in `1781476612764-switch-chart-upload-to-professor-code-and-contact-email.ts`'s
own comment). Since `fn_upload_charts` no longer inserts Program nodes at all (§ AC-3–8),
none ever carries the upload's `upload_log_id`, so this is a structural consequence of the
change above, not something to implement separately. Verified by hand in the runbook.

### AC-11 — `openapi.json`

Regenerated (`pnpm openapi:export`) after the `chart-heads` DTO change lands. No route is
added or removed; only `ConfigureChartHeadsDto`/`ChartHeadsConfigurationDto` and their nested
Swagger schemas change shape.

### AC-12 — Test coverage

See Testing strategy below.

## Backend

- **Module touched**: `src/modules/admin/organization/chart-heads/` (extended, no new
  module) — DTOs, validation, repository, and its existing controller/swagger stay in place
  with regenerated response shapes.
- **Module touched**: `src/modules/uploads/charts/` — `charts-upload.service.ts` constants
  and comments; `charts-template.labels.ts` new es/en messages and legend text.
- **Module touched**: `src/modules/organization/charts/` — `charts.validation.ts`,
  `charts.repository.ts`, `config/strings/charts.validation.ts`.
- **Migration**: one new forward-only migration, created via
  `pnpm migration:create src/database/migrations/recreate-fn-upload-charts-program-ancestry`
  (name illustrative; the CLI stamps the real timestamp), carrying the full
  `CREATE OR REPLACE FUNCTION audit.fn_upload_charts(...)` body per POLICIES § Migrations. No
  entity or column changes, so no `synchronize`/entity diff is involved. `down()` restores the
  function body from `1785730489320-enforce-unique-chart-entity-per-period.ts` verbatim.
- **Endpoints**: no new route. `POST /admin-chart-heads/configure` and
  `GET /admin-chart-heads/:academicPeriodId` (existing) change request/response shape only
  (additive `programs`/`programs` fields).
- **Guards / scope**: unchanged — `chart-heads` already sits behind
  `@RequirePermission({ module: PERMISSION_MODULES.ADMIN, ... })`; no scope header applies to
  it today (period comes from the DTO body, matching its existing pattern) and this change
  does not alter that.
- **i18n keys**: new `error.chart.programAncestorRequired`
  (`config/strings/charts.validation.ts`). New Excel-report message keys `parentCodeEmpty`,
  `programNotConfiguredForSchool` (es/en) in `charts-template.labels.ts` — these are not i18n
  keys (per POLICIES, Excel error text is localized server-side into the file, not returned as
  a key), consistent with how `parentNotFound` etc. already work there.
- **Validation**: business-rule validation (`ChartHeadsValidation`, `ChartValidation`) throws
  domain errors (`BadRequestError`) exactly as the existing code already does; no new pattern
  introduced.

## Testing strategy

| AC  | Covered by                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Kind                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | `chart-heads.validation.spec.ts` (existing-node upsert case). `chart-heads.repository.ts` has no spec file today (only `chart-heads.validation.spec.ts` exists) — the repository's own upsert/query logic stays unverified by a unit test, same as the rest of that file, and is exercised manually via the runbook                                                                                                                                                                                                          | unit + manual        |
| 2   | `chart-heads.validation.spec.ts` — new case: `findProgramsConfiguredForOtherSchool` returns a hit → rejected                                                                                                                                                                                                                                                                                                                                                                                                                 | unit                 |
| 3   | `fn_upload_charts` behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | manual — runbook     |
| 4   | `fn_upload_charts` behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | manual — runbook     |
| 5   | `fn_upload_charts` behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | manual — runbook     |
| 6   | `fn_upload_charts` behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | manual — runbook     |
| 7   | `fn_upload_charts` behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | manual — runbook     |
| 8   | `charts-upload.service.spec.ts` — `UPLOADABLE_ENTITY_TYPE_CODES` no longer includes Program (template generation)                                                                                                                                                                                                                                                                                                                                                                                                            | unit                 |
| 9   | `charts.validation.spec.ts` — new cases for `validateMaintenanceCreate`/`validateMaintenanceUpdate`/`validateCreate`/`validateUpdate`, incl. `rootChartId: null`, existing-node re-type, and the self-exclusion case, with `repo.hasProgramAncestor` mocked (matching this file's existing convention of mocking repository methods rather than unit-testing raw SQL directly — `charts.repository.spec.ts` today only covers `create`/`update` duplicate-race translation, not raw-SQL helpers like `getMaintenanceBranch`) | unit                 |
| 10  | manual — runbook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | manual               |
| 11  | `pnpm openapi:export` produces the expected diff, no unrelated route changes                                                                                                                                                                                                                                                                                                                                                                                                                                                 | manual (CI-adjacent) |
| 12  | all of the above, confirmed red before the corresponding change                                                                                                                                                                                                                                                                                                                                                                                                                                                              | unit                 |

The PG function itself (AC-3–AC-7, AC-10) is not covered by Jest — this codebase's existing
pattern for `fn_upload_charts` changes (see `unique-chart-entity-per-period`'s own traceability
table: "Verified live via `audit.fn_upload_charts`; runbook steps") is to verify it by hand
against a real upload, which `runbook.md` documents step by step.

## Risks

| Risk                                                                                                                                | Mitigation                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing periods already contain Area/Subarea/Course chains with no Program ancestor                                                | Runbook's pre-deploy audit query surfaces them; the rule applies to new writes only (proposal Non-goals), so this is informational, not a blocker, unless it turns out to be large enough to need a team decision |
| `upsertHead`'s update-in-place semantics silently reparenting a program across schools if the new validation is skipped or bypassed | `findProgramsConfiguredForOtherSchool` runs inside `ChartHeadsValidation.validateConfigure`, called unconditionally before `repository.configure()` — no code path reaches the repository without it              |
| The PG function grows large and harder to review across three migrations layered on it                                              | Recreate wholesale per POLICIES convention (as every prior `fn_upload_charts` migration already does); keep the new checks in the same per-row loop shape as the existing ones rather than a divergent style      |
| A file-local row `code` coincidentally equal to a real program's code                                                               | Documented precedence: file-local code wins, checked first; if this ever proves surprising in practice it is one line to reorder, not a schema change                                                             |
| Removing Program from `UPLOADABLE_ENTITY_TYPE_CODES` breaks an in-flight upload built against the old template                      | Coordinate release timing with whoever holds distributed templates; the new legend text signals the change going forward                                                                                          |

## Docs to update in this PR

- [x] `docs/CONTEXT.md` § Business Rules — add one entry alongside the existing "at most one
      active org chart node per period" rule: an Area, Subarea or Course chart node must
      resolve, directly or through its ancestry, to a Program node that was itself created
      through the `chart-heads` pre-configuration step — never through the Excel upload or
      the maintenance UI/generic CRUD directly. State the _why_: this is what lets IFC routing
      and evidence reporting attribute a course to a career, the same reason the entity
      uniqueness rule exists.
- [x] `openapi.json` — regenerated via `pnpm openapi:export`, committed in this PR (AC-11).
