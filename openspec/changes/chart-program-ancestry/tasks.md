# Tasks — Course chart nodes always resolve to a pre-configured program

**Slug**: `chart-program-ancestry` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and fan the
  non-overlapping ones out to parallel subagents.
- TDD throughout: write the test, **see it fail**, implement, see it pass. Run tests with
  `npx jest --no-coverage <path>`.
- A task is complete when **its test passes**, not when the code is written. Tasks whose AC is
  only verifiable by hand are marked so explicitly — their "test" is the corresponding
  `runbook.md` step, not a Jest run.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the heading.
  Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*`.
- The migration in Milestone 2 **must** be created via
  `pnpm migration:create src/database/migrations/<kebab-case-name>` so its timestamp is
  current and monotonic — never hand-pick the filename or timestamp (POLICIES § Migrations).
- Run `pnpm exec tsc --noEmit -p tsconfig.build.json` after any TypeScript change and
  `pnpm openapi:export` once the `chart-heads` DTO changes land (Milestone 1), committing the
  diff.

## Goal

An Area, Subarea or Course chart node can only ever be reached by first passing through a
Program node, and a Program node can only ever be created through a dedicated
pre-configuration step (extending `chart-heads`) — never through the Excel upload, the
maintenance UI, or generic CRUD. The Excel upload references a pre-configured program
directly by its business code in `parentCode`, with no separate manual selection step.

## Slicing

Vertical. Each milestone delivers something demonstrable on its own: Milestone 1 alone lets an
admin pre-configure programs and see them in the response; Milestone 2 alone makes the Excel
upload use them; Milestone 3 closes the same gap on the other two write paths.

---

## Milestone 1 — Program pre-configuration under `chart-heads` (AC-1, AC-2)

### Task 1.1 — Add `ChartProgramDto` and extend chart-heads DTOs ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/admin/organization/chart-heads/model/chart-heads.dtos.ts` (modify)

**Steps**

1. Add `ChartProgramDto` (`programId: number`, `staffId: number`, `userId?: number | null`,
   `title: I18nText`), mirroring `ChartDirectorDto`'s decorators exactly.
2. Add `programs?: ChartProgramDto[]` to `ChartDirectorDto` — `@IsOptional() @IsArray()
@ValidateNested({ each: true }) @Type(() => ChartProgramDto)` — optional so an existing
   caller that omits it keeps working (design.md § ADR gate).
3. Add `ChartHeadProgramViewDto extends ChartHeadDeanViewDto` with `programId: number`,
   `programCode: string` (mirrors how `ChartHeadDirectorViewDto` adds `schoolId`/`schoolCode`
   on top of `ChartHeadDeanViewDto`).
4. Add `programs: ChartHeadProgramViewDto[]` to `ChartHeadDirectorViewDto`.
5. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(chart-heads): add program DTOs for pre-configuration`

### Task 1.2 — `ChartHeadsValidation`: program existence, payload duplicates, cross-school conflict ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/admin/organization/chart-heads/core/chart-heads.validation.ts` (modify)
- `src/modules/admin/organization/chart-heads/core/chart-heads.validation.spec.ts` (test)
- `src/modules/admin/organization/chart-heads/config/strings/chart-heads.validation.ts` (modify)

**Steps (TDD)**

1. Add failing cases to `chart-heads.validation.spec.ts`: (a) a `programId` repeated across
   two different directors in one payload is rejected; (b) a `programId` that does not exist
   in `academic.programs` is rejected; (c) a `programId` already configured for a _different_
   school (mock `findProgramsConfiguredForOtherSchool` returning a hit) is rejected; (d) a
   `programId` already configured for the _same_ school in the payload succeeds (idempotent
   re-configure); (e) a program coordinator `staffId` that does not exist is rejected.
   `npx jest --no-coverage chart-heads.validation.spec` → expect **red** on the new cases.
2. Add `programNotFound`, `duplicateProgramInPayload`, `programAssignedToOtherSchool` to
   `chart-heads.validation.ts` (config/strings).
3. In `ChartHeadsValidation.validateConfigure`: flatten `dto.directors.flatMap(d =>
d.programs ?? [])`; check for duplicate `programId` within that flattened list; call
   `repo.findMissingProgramIds` and `repo.findProgramsConfiguredForOtherSchool` (new repo
   methods, implemented in Task 1.3 — stub them in the mock for this task); include every
   program's `staffId`/`userId` in the existing staff/user existence checks.
4. Re-run → expect **green**.

**Commit**: `feat(chart-heads): validate program pre-configuration requests`

> Implemented together with Task 1.3: `validateConfigure`'s new calls (`findMissingProgramIds`,
> `findProgramsConfiguredForOtherSchool`) needed the repository's real method signatures to
> typecheck against `ChartHeadsRepository`. All 14 cases (7 existing + 7 new) passed on the
> first full run.

### Task 1.3 — `ChartHeadsRepository`: upsert program nodes, extend configuration read ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/admin/organization/chart-heads/core/chart-heads.repository.ts` (modify)

**Steps**

1. In `configure()`, after resolving `deanTypeId`/`schoolTypeId`, also resolve
   `programTypeId` via `typeIdByCode`. Inside the existing `for (const director of
dto.directors)` loop, after `upsertHead` returns the director's own chart id, loop over
   `director.programs ?? []` and call `upsertHead` per program with `entityTypeId:
programTypeId`, `entityCode: program.programId`, `rootChartId: <the director's chart id
just resolved>`.
2. Add `findMissingProgramIds(ids: number[]): Promise<number[]>`, mirroring
   `findMissingSchoolIds` against `academic.programs`.
3. Add `findProgramsConfiguredForOtherSchool(programIds: number[], academicPeriodId: number,
excludeSchoolId: number | null): Promise<number[]>` — returns the subset of `programIds`
   that have an active chart node (`entity_type_id` = Program, `entity_code` = programId,
   `academic_period_id` = the period, `is_active = true`) whose `root_chart_id` resolves to a
   School chart node with `entity_code <> excludeSchoolId` (or any school, when
   `excludeSchoolId` is null — used per-director since each director's own school is the one
   exclusion for that director's own program list). Design note: call this once per director
   with that director's `schoolId` as the exclusion, inside `validateConfigure`, not once
   globally — a program legitimately re-configured for the _same_ school must not trip this
   check.
4. Extend `getConfiguration()`: for each director row, also select its programs (chart nodes
   with `entity_type_id` = Program and `root_chart_id` = the director's own chart id),
   resolving `programCode` via `academic.programs`, same join style as the existing director
   query resolves `schoolCode`.

**Commit**: `feat(chart-heads): persist and read program pre-configuration`

### Task 1.4 — Regenerate `openapi.json` ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `openapi.json` (modify, generated)

**Steps**

1. `pnpm openapi:export`.
2. Confirm the diff touches only `ConfigureChartHeadsDto`/`ChartHeadsConfigurationDto` and
   their nested schemas — no unrelated route changes.

**Commit**: `chore(openapi): regenerate spec for program pre-configuration`

---

## Milestone 2 — Excel upload resolves `parentCode` against configured programs (AC-3–AC-8, AC-10)

### Task 2.1 — Recreate `audit.fn_upload_charts` ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/database/migrations/<cli-timestamp>-<kebab-case-name>.ts` (create, via
  `pnpm migration:create`)

**Steps**

1. `pnpm migration:create src/database/migrations/require-program-ancestor-in-chart-upload`
   (illustrative name — keep it descriptive and kebab-case; the CLI stamps the timestamp).
2. `up()`: full `CREATE OR REPLACE FUNCTION audit.fn_upload_charts(...)` body, copied from
   `1785730489320-enforce-unique-chart-entity-per-period.ts`'s `up()` and modified per
   design.md § AC-3–AC-8:
   - Entity-type resolution subqueries: drop `'TG903-T003'` from every `t.code IN (...)` list
     that currently includes it (both the per-row `resolved_entity_code` computation and the
     insert-pass `et` lateral join).
   - Per-row parent-code validation: replace the single `parent_code IS NOT NULL AND NOT
EXISTS (...)` check with, in order: blank → `parentCodeEmpty`; matches a file code → ok;
     matches an active `academic.programs.code` → check that program's active chart node
     exists with `root_chart_id = v_school_chart_id` for this period, else
     `programNotConfiguredForSchool`; else → `parentNotFound`.
   - New wiring pass after the existing "pass 2" (file-local parent linking): for rows whose
     `parent_code` resolved to a program (not a file code), `UPDATE organization.charts SET
root_chart_id = <that program's chart id>` for the matching rows.
   - Delete the old "pass 3: top-level rows hang under the school node" — no row should reach
     wiring with an unresolved parent any more.
3. `down()`: full body restored verbatim from `1785730489320`'s `up()` (i.e., the function as
   it exists today, unmodified).

**Commit**: `feat(charts-upload): require program ancestor for area, subarea and course rows`

> No Jest coverage for the PG function itself — verified manually per `runbook.md`, matching
> this codebase's existing pattern for `fn_upload_charts` migrations. `v_school_chart_id` was
> moved to the top of the function so the per-row parent validation can use it; the duplicate
> Program branch (T003) in the intra-file entity-duplicate and entity-already-in-period checks
> was also dropped since Course is now the only entity-coded uploadable type.

### Task 2.2 — Drop Program from uploadable entity types ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/uploads/charts/api/charts-upload.service.ts` (modify)
- `src/modules/uploads/charts/api/charts-upload.service.spec.ts` (test)

**Steps (TDD)**

1. Add a failing case to `charts-upload.service.spec.ts` asserting the generated template's
   entity-type dropdown/legend never includes Program.
   `npx jest --no-coverage charts-upload.service.spec` → expect **red**.
2. Remove `TYPE_CODES.ENTITY_TYPE.PROGRAM` from `UPLOADABLE_ENTITY_TYPE_CODES` and
   `ENTITY_TYPE_CODES_REQUIRING_CODE`. Update the comment above
   `UPLOADABLE_ENTITY_TYPE_CODES` to describe the new `parentCode`-as-program-code mechanism
   instead of the old "blank means generic node under the school" behaviour.
3. Re-run → expect **green**.

**Commit**: `feat(charts-upload): remove program from uploadable entity types`

> The existing template test asserted `Carrera` required an entity code in the legend; updated
> it to assert Program is absent from the legend entirely, confirmed red (received `undefined`
> against the old `'Sí'` expectation) before the fix.

### Task 2.3 — New Excel error messages and legend text ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/uploads/charts/model/charts-template.labels.ts` (modify)

**Steps**

1. Add `parentCodeEmpty` and `programNotConfiguredForSchool` to `chartsErrorMessages.es` and
   `.en`, matching the existing tone/format of the neighbouring entries.
2. Add one line to the legend sheet content (via `addEntityTypeLegend` or a new short note)
   explaining that `parentCode` may name a program's own code to attach a row under a
   pre-configured program.

**Commit**: `feat(charts-upload): document the program-code parent mechanism in the template`

---

## Milestone 3 — Maintenance UI and generic CRUD enforce the same ancestry rule (AC-9)

### Task 3.1 — `hasProgramAncestor` and `rootChartId` on `getNodeWithType` ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/organization/charts/core/charts.repository.ts` (modify)

**Steps**

1. Add `rootChartId: number | null` to `ChartNodeRecord` and to `getNodeWithType`'s `SELECT`.
2. Add `hasProgramAncestor(chartId: number | null): Promise<boolean>` — `chartId === null`
   returns `false` immediately (no query); otherwise a recursive CTE walking `root_chart_id`
   upward from `chartId` (inclusive), returning whether any node in that walk has
   `entity_type_id` matching `TYPE_CODES.ENTITY_TYPE.PROGRAM`, per design.md § AC-9.

**Commit**: `feat(charts): add program-ancestor lookup to the chart repository`

### Task 3.2 — Enforce ancestry on all four write paths, make Program read-only ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `src/modules/organization/charts/core/charts.validation.ts` (modify)
- `src/modules/organization/charts/core/charts.validation.spec.ts` (test)
- `src/modules/organization/charts/config/strings/charts.validation.ts` (modify)

**Steps (TDD)**

1. Add failing cases to `charts.validation.spec.ts`:
   - `validateMaintenanceCreate`: creating an Area/Subarea/Course under a parent with no
     Program ancestor (`hasProgramAncestor` mocked `false`) is rejected; under one that does
     resolve (`true`) it passes (combined with the existing checks already covered).
   - `validateMaintenanceCreate`: attempting to create a node typed Program is rejected via
     the existing `entityTypeReadOnly` path (Program now in `READ_ONLY_ENTITY_TYPES`).
   - `validateMaintenanceUpdate`: re-typing an existing node into Course when its own stored
     `rootChartId` has no Program ancestor is rejected; when it does, it passes.
   - Generic `validateCreate`: `data.rootChartId` omitted (`null`) for a Course is rejected;
     provided but ancestor-less is rejected; valid ancestor passes.
   - Generic `validateUpdate`: moving `rootChartId` onto a parent with no Program ancestor is
     rejected; a staff/title-only update does not call `hasProgramAncestor` at all (asserts
     the mock was not called, matching design.md's guard condition).
     `npx jest --no-coverage charts.validation.spec` → expect **red** on the new cases.
2. Add `programAncestorRequired: 'error.chart.programAncestorRequired'` to
   `config/strings/charts.validation.ts`.
3. Add `ENTITY.PROGRAM` to `READ_ONLY_ENTITY_TYPES`.
4. Add a small `requiresProgramAncestor(entityTypeCode: string): boolean` helper (true for
   Area, Subarea, Course only) next to `entityTypeNeedsCode`.
5. Wire the four call sites per design.md § AC-9: `validateMaintenanceCreate`,
   `validateMaintenanceUpdate` (using the node's existing `rootChartId`), `validateCreate`
   (`data.rootChartId ?? null`), `validateUpdate` (`data.rootChartId ?? entity.rootChartId`,
   guarded by the same "only when `rootChartId` or `entityTypeId` present" condition used for
   the existing uniqueness re-check in that method).
6. Re-run → expect **green**.
7. `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(charts): require a program ancestor on every chart write path`

> Widened slightly beyond the literal task text: generic CRUD (`ChartController.create`/
> `update`, backed by `ChartValidation.validateCreate`/`validateUpdate`) never checked
> `isReadOnlyEntityType` at all before this change — it was a second, unguarded way to create
> or retype a Dean/School/Program node, which the maintenance UI already blocked. Since
> `POST /organization/charts/create` and `PUT .../update/:id` are real, permission-gated
> endpoints (confirmed in `charts.controller.ts`), leaving that path open would have left the
> Program-pre-configuration guarantee incomplete. Added the same `isReadOnlyEntityType` check
> there, reusing the existing helper — no new logic, no scope beyond this change's own stated
> goal ("Program is only ever created through pre-configuration").
>
> Five existing tests broke on the first run and were fixed rather than the new code changed:
> two `validateMaintenanceCreate` cases and one `validateMaintenanceUpdate` case needed
> `hasProgramAncestor` mocked (confirmed failing with `repo.hasProgramAncestor is not a
function` before `mockRepo` was updated); the `courseNode` fixture needed a `rootChartId`
> field it never had before; and one `validateMaintenanceDelete` case used Program as its
> "not read-only" example, which stopped being true. All 36 cases in the file pass; full suite
> (121 suites, 1145 tests) green afterward.

---

## Milestone 4 — Docs and pre-deploy verification

### Task 4.1 — `docs/CONTEXT.md` § Business Rules ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `docs/CONTEXT.md` (modify)

**Steps**

1. Add one entry next to the existing "at most one active org chart node per period" rule,
   per design.md § Docs to update: Area/Subarea/Course must resolve to a Program node created
   only through `chart-heads` pre-configuration, and why (IFC routing/evidence attribution).

**Commit**: `docs(context): record the program-ancestry chart rule`

### Task 4.2 — `runbook.md` ✅ DONE (2026-08-18)

- [x] Task complete

**Files**

- `openspec/changes/chart-program-ancestry/runbook.md` (create)

**Steps**

1. Write the runbook per design.md's manual-verification rows (AC-3–AC-7, AC-10) and the
   pre-deploy production audit called for in `proposal.md` § Dependencies.

**Commit**: `docs(chart-program-ancestry): add runbook`

> Already written during `/abet-design-feature` (its own step 6 creates the runbook at design
> time). Verified its error-code names (`parentCodeEmpty`, `programNotConfiguredForSchool`,
> `parentNotFound`) and mechanism description still match what was actually implemented in
> Milestone 2 — no changes needed.

---

## Audit fixes (/abet-audit-pr)

### Review round 1 (2026-08-18)

Six parallel auditors (code quality, architecture/docs, testing, antipatterns, security,
runtime robustness) ran over `origin/develop...HEAD`. Verdict: **NOT READY** — 3 majors, 2
minors, 2 suggestions. All fixed below except one suggestion, explicitly left out with reason.

### Task R1.1 — Scope `hasProgramAncestor` to the write's own academic period ✅ DONE (2026-08-18)

- [x] Task complete

**Why**: Auditor F (runtime robustness, major). Generic CRUD accepts any existing chart id as
`rootChartId` with no check that it belongs to the same period as the node being written, and
`hasProgramAncestor`'s recursive CTE had no `academic_period_id` filter — an ancestor from a
different period's tree could satisfy the current period's requirement.

**Files**

- `src/modules/organization/charts/core/charts.repository.ts` (modify)
- `src/modules/organization/charts/core/charts.validation.ts` (modify — all four call sites)
- `src/modules/organization/charts/core/charts.validation.spec.ts` (test)

**Steps**

1. `hasProgramAncestor(chartId, academicPeriodId)` — the CTE's anchor and recursive terms both
   now filter on `academic_period_id = $3`.
2. Every call site threads its own already-resolved `academicPeriodId` through.
3. Updated the 5 existing `toHaveBeenCalledWith(...)` assertions across
   `charts.validation.spec.ts` for the new second argument.

**Commit**: `fix(charts): scope program-ancestor lookup to the write's own period`

### Task R1.2 — Translate `upsertHead`'s race into a domain conflict ✅ DONE (2026-08-18)

- [x] Task complete

**Why**: Auditor F (runtime robustness, major). `upsertHead` writes through TypeORM's own
repository, not `ChartRepository`, so it never inherited `translateDuplicateNode` — a
concurrent race on a brand-new program (two schools targeting the same unclaimed `programId`)
would surface to the loser as a raw `500` instead of the `ConflictError` every other chart
write path already produces for this exact index.

**Files**

- `src/modules/admin/organization/chart-heads/core/chart-heads.repository.ts` (modify)
- `src/modules/admin/organization/chart-heads/core/chart-heads.repository.spec.ts` (create)

**Steps**

1. Added a local `translateDuplicateNode`, mirroring `ChartRepository`'s own, wrapping both
   `upsertHead`'s `save` and `update` paths.
2. New spec file (none existed for this repository before) covering: unique-violation on
   insert → conflict, unique-violation on update → conflict, a different constraint's
   violation → rethrown untouched, an unrelated error → rethrown untouched.

**Commit**: `fix(chart-heads): translate a concurrent duplicate-program race into a conflict`

### Task R1.3 — Extract the duplicated read-only/ancestor check ✅ DONE (2026-08-18)

- [x] Task complete

**Why**: Auditor A (code quality, major). The read-only-type check + program-ancestor check
pair was copy-pasted near-verbatim across `validateCreate`, `validateUpdate`,
`validateMaintenanceCreate`, `validateMaintenanceUpdate` — the exact "same rule, four places,
drifts" pattern this PR's own design and the `unique-chart-entity-per-period` prior art warn
against.

**Files**

- `src/modules/organization/charts/core/charts.validation.ts` (modify)

**Steps**

1. Extracted `ChartValidation.checkTypeConstraints(repo, typeCode, rootChartId,
academicPeriodId): Promise<string[]>` — the one place both checks are expressed.
2. All four methods now resolve their own `typeCode`/`rootChartId`/`academicPeriodId` and call
   it, folded together with Task R1.1's period-scoping fix rather than done twice.
3. Full `charts.validation.spec.ts` suite (37 cases) re-run green with no behavior change for
   any case the refactor wasn't meant to touch.

**Commit**: folded into the commits above (touches the same methods as R1.1).

### Task R1.4 — Disclose the Dean/School side effect + lock it in with a test ✅ DONE (2026-08-18)

- [x] Task complete

**Why**: Auditor B (minor) + Auditor C via the same finding (suggestion). Program joining
`READ_ONLY_ENTITY_TYPES` also newly blocks Dean/School writes through generic CRUD — correct
and intentional, but undisclosed in `design.md` and untested for those two types.

**Files**

- `openspec/changes/chart-program-ancestry/design.md` (modify)
- `src/modules/organization/charts/core/charts.validation.spec.ts` (test)

**Commit**: `docs(chart-program-ancestry): disclose the dean/school read-only side effect`

### Task R1.5 — Runbook step for the file-code-wins precedence ✅ DONE (2026-08-18)

- [x] Task complete

**Why**: Auditor C (minor). The migration's own docstring calls out "file-local code wins over
a program code on collision" as a deliberate decision; nothing in the runbook exercised it.

**Files**

- `openspec/changes/chart-program-ancestry/runbook.md` (modify)

**Commit**: `docs(chart-program-ancestry): add runbook step for code-collision precedence`

### Not fixed — self-referential `rootChartId` cycle test (Auditor C, suggestion)

Deliberately left out. Auditor C's own finding says so explicitly: "N/A this PR — track
separately," because the gap it describes (no test for `validateUpdate` moving a node's
`rootChartId` onto itself) is pre-existing and unrelated to program ancestry — it predates this
change and isn't touched by it. Fixing it here would exceed this change's own scope discipline.
Tracked as a follow-up, not part of `chart-program-ancestry`.

### Comment audit (post-fix, user-requested)

Swept every comment added in this diff against POLICIES § Comments ("only for complex,
high-reasoning code... never restate what the code already says"). Trimmed four that opened
with a restatement of the function's own signature/behavior before getting to the actual
reasoning (`hasProgramAncestor`, `findProgramsConfiguredForOtherSchool`,
`requiresProgramAncestor`, `UPLOADABLE_ENTITY_TYPE_CODES`) — kept the "why" sentence in each,
cut the "what" sentence. Left the migration's SQL comments untouched: POLICIES names the
upload/rollback PG functions specifically as material that warrants comments, and every one
of them explains a non-obvious precedence or business rule, not an obvious step.

<!--
Append-only sections below. These record what actually happened, not what was planned, and
they are the best input to the next design.

## Unplanned — <what and why>

### Task U.1 — <title>
(checkbox omitted from this template line on purpose — see "The task checkbox rule" in
reference/conventions.md for the real pattern; a literal example here would be mistaken for
an actual open task by the completeness gate)

## Post-QA fixes
-->
