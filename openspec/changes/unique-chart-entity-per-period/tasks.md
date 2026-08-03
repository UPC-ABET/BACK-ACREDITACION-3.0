# Tasks — Unique chart entity per academic period

**Slug**: `unique-chart-entity-per-period` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## For whoever executes this

- Work in checkpointed batches of 3–5 tasks. Partition each batch by files touched and fan the
  non-overlapping ones out to parallel subagents.
- TDD throughout: write the test, **see it fail**, implement, see it pass.
- A task is complete when **its test passes**, not when the code is written.
- Marking done means checking the box **and** appending `✅ DONE (YYYY-MM-DD)` to the heading.
  Never one without the other — the completeness gate reads the boxes.
- **No autonomous commits.** Propose the grouping and stop.
- Do not edit `docs/POLICIES.md` or `docs/adr/*`.
- Tests: `npx jest --no-coverage <path>` for one file, `pnpm test` for the suite.
  Typecheck: `pnpm exec tsc --noEmit -p tsconfig.build.json`. Lint: `pnpm lint`.
- **Never run `pnpm migration:run` against anything but your own local database.**
- Milestones 1 and 2 are independent — different files, no shared edits. Milestone 3's index
  task must land after Milestone 2's migration task, because they edit the same migration file.

## Goal

Enforce one active chart node per `(academic period, entity type, entity code)` across all
four TypeScript write paths, the Excel upload function, and the schema itself — replacing the
inconsistent per-path rules that let the same course or programme be attached twice in one
period, including under two different schools.

## Slicing

Vertical. Milestone 1 makes the API reject duplicates; Milestone 2 makes the upload reject
them with a localized message in the returned Excel; Milestone 3 makes the database refuse to
hold one at all. Each is demonstrable on its own.

---

## Milestone 1 — The application paths reject duplicates

### Task 1.1 — One lookup, one helper, one error key ✅ DONE (2026-08-02)

- [x] Task complete

> Red for the right reason on the first run: the duplicate case resolved instead of rejecting.
> The null-exemption case passed trivially before implementation (the method was never called
> at all), so it is a guard rather than proof — it earns its keep once the helper exists.
> Noted while working: `jest.clearAllMocks()` in this spec's `beforeEach` does **not** clear
> implementations set by `mockResolvedValue`, so values leak between cases. Every new case sets
> `findActiveNodeByEntity` explicitly rather than relying on a reset.

**Files**

- `src/modules/organization/charts/core/charts.repository.ts` (modify)
- `src/modules/organization/charts/core/charts.validation.ts` (modify)
- `src/modules/organization/charts/config/strings/charts.validation.ts` (modify)
- `src/modules/organization/charts/core/charts.validation.spec.ts` (test)

**Steps (TDD)**

1. Add `findActiveNodeByEntity` to `mockRepo` in the spec. Write the failing cases for
   `validateMaintenanceCreate`: rejects when the trio is taken, passes when free, and passes
   when `entityCode` is null (Area/Subarea). `npx jest --no-coverage src/modules/organization/charts/core/charts.validation.spec.ts` → expect **red**.
2. Add `entityAlreadyAssigned: 'error.chart.entityAlreadyAssigned'` to `chartsValidationStrings.error`.
3. Add `ChartRepository.findActiveNodeByEntity(academicPeriodId, entityTypeId, entityCode)`
   using TypeORM `where` with `isActive: true`. Do **not** reuse `findOneByCondition` without
   the flag — it does not filter `is_active`.
4. Add `ChartValidation.isEntityTakenInPeriod(repo, params)`, returning `false` when
   `entityCode == null` or `entityTypeId == null`, honouring `excludeChartId`.
5. Call it from `validateMaintenanceCreate`, **after** the entity-type and entity-existence
   checks so an invalid type still reports as an invalid type.
6. Re-run → expect **green**. Then `pnpm exec tsc --noEmit -p tsconfig.build.json`.

**Commit**: `feat(charts): reject duplicate entity nodes on maintenance create`

### Task 1.2 — Shared effective-trio resolution for maintenance update ✅ DONE (2026-08-02)

- [x] Task complete

> Two of the four new cases went red, which is the honest split: the self-exclusion case and
> the type-only case pass under the old code too, so only the other two proved anything.
> `updateNode` needed one behavioural care point during the refactor — it previously wrote
> `partial.entityCode` only inside its two branches, so the shared resolver is called only when
> the DTO carries a type or a code. Calling it unconditionally would start writing `entityCode`
> on title-only edits.

**Files**

- `src/modules/organization/charts/core/charts.validation.ts` (modify)
- `src/modules/organization/charts/api/charts.service.ts` (modify)
- `src/modules/organization/charts/core/charts.validation.spec.ts` (test)

**Steps (TDD)**

1. Failing cases for `validateMaintenanceUpdate`: rejects when the update lands on another
   node's trio; **passes when the node's own trio is unchanged** (self-exclusion); resolves
   correctly for a type-only DTO and for a code-only DTO. → expect **red**.
2. Export `resolveEffectiveEntity(current, dto, newTypeCode)` from `charts.validation.ts` —
   pure, synchronous, mirroring the existing `resolveEntityCode` semantics.
3. Use it in `validateMaintenanceUpdate`, passing `excludeChartId: id`.
4. **Refactor `ChartService.updateNode` (`charts.service.ts:79-87`) onto the same function.**
   Leaving its private copy is the drift this change exists to prevent — see design § AC-2.
5. Re-run the spec → **green**. Typecheck.

**Commit**: `refactor(charts): share effective-entity resolution between validation and update`

### Task 1.3 — Generic CRUD onto the new key, old rule removed ✅ DONE (2026-08-02)

- [x] Task complete

> The fixture trap was real and worse than the design assumed. `validateCreate` was tested with
> `{ name: 'test' }` — the old rule queried on `staffId`/`academicPeriodId`/`entityCode`, all
> `undefined`, so the "duplicate" case only passed because `findOneByCondition` was mocked to
> return a row for a query that matched nothing meaningful. Rewritten with real DTOs first;
> 3 of the 25 cases went red against the old implementation.
> `grep -rn "chartExists" src/` now returns nothing. 25 passed, and the full
> `organization` + `uploads` suites stayed green (137 tests, 21 suites).

**Files**

- `src/modules/organization/charts/core/charts.validation.ts` (modify)
- `src/modules/organization/charts/config/strings/charts.validation.ts` (modify)
- `src/modules/organization/charts/core/charts.validation.spec.ts` (test)

**Steps (TDD)**

1. **Rewrite the two trapped `validateCreate` cases first.** They currently pass `{ name: 'test' }`,
   a DTO with none of the fields the rule reads, so they pass for the wrong reason. Replace with
   realistic DTOs carrying `academicPeriodId`, `entityTypeId`, `entityCode`.
2. Add the failing cases: create rejects a taken trio regardless of `staffId`; create **succeeds**
   for a case the old `(staffId, period, entityCode)` rule rejected; update rejects a duplicate
   trio and excludes itself; null `entityCode` is exempt on both. → expect **red**.
3. Replace the `findOneByCondition` block in `validateCreate` and `validateUpdate` with
   `isEntityTakenInPeriod`. In `validateUpdate`, merge the DTO over the loaded row
   (`dto.x ?? node.x`) for all three components before checking.
4. Delete `chartExists` from `chartsValidationStrings.error`. First run
   `grep -rn "chartExists\|error.chart.chartExists" src/` and confirm nothing else uses it.
5. Re-run → **green**. Typecheck. Then `grep -rn "chartExists" src/` → expect no output.

**Commit**: `feat(charts): key duplicate detection on period, entity type and entity code`

### Task 1.4 — Translate the unique-violation race into the same error ✅ DONE (2026-08-02)

- [x] Task complete

> 2 of 5 cases red — the three pass-through cases were green before the change, which is the
> point of having them: they prove the narrow match does not over-reach.
> The wrapper had to override `create` and `update` rather than wrap `save`, because generic
> CRUD reaches the DB through `BaseRepository.create`/`update` while `createNode` goes through
> `create`. `BaseRepository.update` calls `getJsonbColumnNames()`, so the spec's fake TypeORM
> repository needs a `metadata.columns` array or it throws before reaching the driver error.

**Files**

- `src/modules/organization/charts/core/charts.repository.ts` (modify)
- `src/modules/organization/charts/core/charts.repository.spec.ts` (test, new)

**Steps (TDD)**

1. New spec asserting that a thrown `QueryFailedError`-shaped object with `code: '23505'` and
   the index name in its constraint field is rethrown as a `ConflictError` carrying
   `error.chart.entityAlreadyAssigned`, and that an unrelated `23505` is rethrown untouched.
   → expect **red**.
2. Add a private wrapper in `ChartRepository` around `create` and `update` that matches on
   **both** the SQLSTATE and the index name `UQ_charts_academic_period_entity_type_entity_code`.
   Matching on SQLSTATE alone would swallow unrelated unique violations.
3. Re-run → **green**. Typecheck.

**Commit**: `fix(charts): return a conflict instead of a 500 on the duplicate-node race`

---

## Milestone 2 — The upload rejects duplicates with a readable message

### Task 2.1 — Error codes and localized messages ✅ DONE (2026-08-02)

- [x] Task complete

> All 4 parameterised cases red first — the raw code really did reach the cell.
> The existing annotation test only asserted `excelWithErrors` was truthy, so it would not have
> caught a missing message. The new cases decode the base64 workbook and read the error cell,
> asserting the text is not the code. Error column is 9 for two languages
> (2 + languages + 4 + 1); that arithmetic is duplicated from the service and would need
> updating if a third language were configured.

**Files**

- `src/modules/uploads/charts/model/charts-template.labels.ts` (modify)
- `src/modules/uploads/charts/api/charts-upload.service.spec.ts` (test)

**Steps (TDD)**

1. Failing case modelled on the existing "returns annotated excel when the function reports row
   errors" test: a mocked `callUploadFunction` returning `duplicateEntityInFile` and
   `entityAlreadyInPeriod` produces localized text — not the raw code — in the annotated Excel,
   for both `es` and `en`. `npx jest --no-coverage src/modules/uploads/charts/api/charts-upload.service.spec.ts` → **red**.
2. Add both codes to `chartsErrorMessages.es` and `chartsErrorMessages.en`. Both dictionaries —
   `annotateErrors` falls back to the raw code, so a missing entry leaks it into the user's file.
3. Re-run → **green**. Typecheck.

**Commit**: `feat(charts-upload): add localized messages for duplicate entity rows`

### Task 2.2 — Recreate `audit.fn_upload_charts` with the two new checks ✅ DONE (2026-08-03)

- [x] Task complete

**Files**

- `src/database/migrations/<generated>-enforce-unique-chart-entity-per-period.ts` (create)

**Steps**

1. `pnpm migration:create src/database/migrations/enforce-unique-chart-entity-per-period`.
   **Never hand-pick the timestamp.**
2. Copy the full function body forward from
   `1781649412764-reject-chart-upload-email-mismatch-for-linked-user.ts`. `down()` restores that
   exact body.
3. Add the two set-based checks alongside the existing intra-file checks, before any write:
   - `duplicateEntityInFile` — rows grouping to the same `(resolved entity type, entityCode)`
     more than once. **Return every offending row**, not just the second.
   - `entityAlreadyInPeriod` — the resolved entity already has an active node in the period.
4. **Resolve the business code to an internal id before comparing.** The file's `entityCode`
   column holds `programs.code` / `courses.code`; `charts.entity_code` holds the id. Comparing
   them directly compiles, runs, and never matches — see design § AC-6/AC-7. Follow the existing
   insert (pass 1) for how the resolution is done.
5. Skip rows whose resolved code is null. Only `TG903-T003` and `TG903-T006` reach these checks.
6. Style: set-based, following `1784093233471-set-based-student-sections-upload-function.ts`.
   Avoid per-row subqueries over `p_rows` — the template allows 1000 rows.
7. `pnpm migration:run` **against your local database only**, then `pnpm migration:revert`, then
   run it again. Both directions must work.

**Commit**: `feat(charts-upload): reject duplicate entity rows in the upload function`

> Initially blocked — no Postgres was running — then verified on 2026-08-03 against the live
> local database, inside a transaction that was rolled back, so nothing was left behind.
> The function's new checks were exercised by calling `audit.fn_upload_charts` directly with
> crafted rows, which is the only way to prove the business-code -> id resolution rather than
> assuming it:
>
> - a row naming a course that already has a node in the period returned `entityAlreadyInPeriod`;
> - a course with **no** node in that period did **not** trip it (no over-matching — this is the
>   assertion that would have caught the "compares a code to an id and never matches" trap, since
>   that bug makes the check silently always pass);
> - two rows naming the same course returned `duplicateEntityInFile` for **both** rows 2 and 3;
> - two rows naming different courses returned neither.
>   Fixture used: period 1, course `1ASI0736` (already noded) and `1AAD0099` (free).

---

## Milestone 3 — The database enforces the invariant

### Task 3.1 — Duplicate guard and partial unique index ✅ DONE (2026-08-03)

- [x] Task complete

**Files**

- `src/database/migrations/<same file as Task 2.2>` (modify)

**Steps**

1. Extend the migration from Task 2.2 — same file, do not create a second one.
2. In `up()`, **before** creating the index, run the guard query: active rows with a non-null
   entity code grouped by the trio, `HAVING count(*) > 1`. If any rows return, throw an `Error`
   listing the offending `(academic_period_id, entity_type_id, entity_code)` groups and their
   chart ids.
3. **The guard never deletes or deactivates a node.** AC-9 prohibits it — choosing which
   duplicate survives has IFC consequences and is a decision for the team.
4. Create the index:
   ```sql
   CREATE UNIQUE INDEX "UQ_charts_academic_period_entity_type_entity_code"
     ON organization.charts (academic_period_id, entity_type_id, entity_code)
     WHERE entity_code IS NOT NULL AND is_active = true;
   ```
5. `down()` drops the index **and** restores the prior function body.
6. Verify locally against a seeded duplicate: `up()` names the group and aborts, writing nothing.
   Then clear the duplicate and confirm `up()` succeeds. Then `pnpm migration:revert`.

**Commit**: `feat(charts): enforce one active chart node per entity and period`

> Verified 2026-08-03, and the guard earned its keep immediately: the **local dev database
> already held 2 violating groups**, so the real `up()` aborted on the first run with
> `period=1 entityType=73 entity=38 -> 2 active nodes (chart ids: 279, 299)` and
> `period=2 entityType=73 entity=1036 -> 3 active nodes (chart ids: 747, 754, 776)`.
> Nothing was written on that path — the index did not exist afterwards. (Production was
> audited clean on 2026-08-02; this is local-only data.)
> The rest was then verified in a rolled-back transaction after a temporary dedup:
> `up()` completed, the index was created `UNIQUE ... WHERE ((entity_code IS NOT NULL) AND
(is_active = true))`, a duplicate insert was rejected with SQLSTATE `23505` on constraint
> `UQ_charts_academic_period_entity_type_entity_code` — which also confirms Task 1.4 matches on
> the right constraint name — two null-`entity_code` nodes were accepted, an inactive duplicate
> was accepted, `down()` dropped the index and restored the prior function body, and `up()` ran
> again cleanly afterwards.

### Task 3.2 — Record the invariant and confirm the contract is unchanged ✅ DONE (2026-08-02)

- [x] Task complete

> AC-11 holds: `pnpm openapi:export` regenerated the spec (541 paths, 301 schemas) and
> `git diff --stat openapi.json` is empty. `grep -rn "chartExists" src/` returns nothing.
> Full suite green: 101 suites, 819 tests. `eslint src/**/*.ts` clean.
> One pre-existing prettier warning in `src/modules/survey/gra/api/gra-report.service.spec.ts`,
> a file this change never touches — left alone rather than swept into this diff.

**Files**

- `docs/CONTEXT.md` (modify)
- `openapi.json` (verify only)

**Steps**

1. Add the rule to `docs/CONTEXT.md` § Business Rules: one active chart node per
   `(academic period, entity type, entity)`, entity-coded types only, **global across schools** —
   two schools cannot both hold a node for the same course in one period. That cross-school
   consequence is the non-obvious part and is the reason the entry belongs there.
2. Run `pnpm openapi:export` and `git diff --stat openapi.json` → **expect no diff** (AC-11).
   If it diffs, a DTO or route changed and the design was wrong: commit the regenerated spec and
   say so in the PR body.
3. `pnpm lint` and `pnpm test` clean.

**Commit**: `docs(charts): record the one-node-per-entity-and-period invariant`

---

<!--
Append-only sections below. These record what actually happened, not what was planned.

## Unplanned — <what and why>

### Task U.1 — <title>
  - [ ] Task complete   <- indented on purpose: the completeness gate is
                            `grep -c '^- \[ \]'`, so a template checkbox at column 0
                            inside this comment counts as a real open task forever.

## Post-QA fixes

## Audit fixes (/abet-audit-pr)
-->

## Unplanned — migration verification blocked on a local database (2026-08-02)

### Task U.1 — Run the migration up/down against a live Postgres ✅ DONE (2026-08-03)

- [x] Task complete

> Done via a rolled-back transaction rather than a persisted `pnpm migration:run`, which turned
> out to be the stronger test: it exercised the **abort path with real violating data** as well
> as the success path, and left the database byte-identical (`migration:show` still lists the
> migration as pending afterwards).
>
> **Resolved and applied 2026-08-03.** The owner authorised deleting the local duplicates.
>
> They turned out not to be arbitrary duplicates but **wrong course codes in two uploaded
> files**: `academic.courses` holds no duplicate codes, and the normal pattern is that a node's
> title matches the course it points at. In each group exactly one node matched —
> 279 "DATA VISUALIZATION" -> course 38 _DATA VISUALIZATION_, and 776 "ANALISIS DE DATOS" ->
> course 1036 _ANALISIS DE DATOS_. The other three (299 "INTRODUCTION TO DEEP LEARNING",
> 747 "INTELIGENCIA ARTIFCIAL", 754 "TOPICOS DE REDES") each carried a course code belonging to
> a different course. Keepers were chosen on that basis, **not** on lowest id — which matters,
> because for the period-2 group the lowest id (747) was one of the wrong ones.
>
> All three losers were verified childless with no IFCs before deletion, so no re-parenting was
> needed; a post-check confirmed 0 duplicate groups and 0 dangling `root_chart_id` references.
> `pnpm migration:run` then completed and `migration:show` lists the migration as applied.
>
> Worth knowing for the PR: uploads 95 and 103 contain rows whose course code does not match
> their title, and this change is exactly what would have rejected them.

Tasks 2.2 and 3.1 are code-complete but unexecuted: nothing is listening on `localhost:5432`.
A migration that has never been run is not a finished migration — the PL/pgSQL body has not
been parsed, so a syntax error in the two new checks would still be sitting there.

**Steps**

1. Start a local Postgres and point `.env` at it (`DB_NAME=abet`).
2. `pnpm migration:run` — expect the guard to pass on a clean table and the index to be created.
3. Seed a duplicate `(period, entity type, entity)` pair and re-run `up()` on a fresh database:
   expect the abort, with the group named in the error.
4. `pnpm migration:revert`, then `pnpm migration:run` again. Both directions must work.
5. Then work the runbook manual steps 6-9, which exercise the upload function end to end.

**Commit**: none — verification only. Fix-ups get their own commit.
