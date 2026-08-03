# Design — Unique chart entity per academic period

**Slug**: `unique-chart-entity-per-period`
**Proposal**: `./proposal.md`

## Read first

Where this design started, in the order it was read.

- `./proposal.md` — the ticket. The five **Decisions taken** are settled; do not reopen them.
- `docs/POLICIES.md` § Migrations, § Database Access (Repository Boundary), § Validation
  Pattern, § i18n Key Convention, § Testing.
- `docs/CONTEXT.md` § Database, § Domain Vocabulary.
- `docs/adr/` — contains only `README.md`. **No ADRs exist in this repository yet**, so
  nothing here can contradict one.
- `openspec/specs/` — empty. No archived prior art; the prior art is in the migration history
  instead (see below).
- `src/modules/organization/charts/` — entity, validation, service, repository, controller.
  The four TypeScript write paths.
- `src/modules/uploads/charts/` — upload service, repository, `charts-template.labels.ts`.
- `src/database/migrations/1781649412764-reject-chart-upload-email-mismatch-for-linked-user.ts`
  — the **current** body of `audit.fn_upload_charts`. This is the text to copy forward.
- `src/database/migrations/1783575251494-enforce-unique-student-course-enrollment.ts` — the
  closest prior art: the same shape of change (intra-file check + DB-level check + database
  backstop) on a different table. Follow its structure.
- `src/database/migrations/1784093233471-set-based-student-sections-upload-function.ts` — the
  set-based style to follow for the new upload checks.
- `src/commons/base.repository.ts`, `src/commons/base.service.ts` — what generic CRUD actually
  does. Note `delete` → `remove` → **hard** delete, and `findOneByCondition` does **not**
  filter `is_active`.
- `src/shared/filters/all-exceptions.filter.ts` — handles `DomainError` and `HttpException`
  only. A raw Postgres error currently falls through to `error.internalServer` (500).

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                    |
| --------------------------------------------- | --------------------------------------- |
| Datastore, broker or cache choice             | No                                      |
| Auth or payments provider                     | No                                      |
| Public API contract change or breaking change | **Partially — assessed, not an ADR**    |
| New module boundary or cross-repo split       | No                                      |
| Language, runtime or framework                | No                                      |
| Contradicting an existing ADR                 | No — `docs/adr/` holds only `README.md` |

**On the partial hit.** No route, DTO or response shape changes, so `openapi.json` is
byte-identical and the frontend's generated types are unaffected. What does change is
_semantics_, in both directions:

- Requests that succeed today start failing with `400` (the new duplicate rule).
- Requests that fail today start succeeding (decision 4 removes the
  `(staffId, academicPeriodId, entityCode)` rule, so one staff member may now hold two nodes
  that today collide).

This is a behaviour change to a live API, which is why the gate is not answered "No". It does
not warrant an ADR because it is not an architectural decision with a lasting cost — it is the
enforcement of an invariant the data model always intended, reversible by dropping one index
and one validation. The decision that _would_ have warranted an ADR — global-per-period versus
school-scoped — was taken and recorded in `proposal.md` § Decisions taken, with its cost
(cross-school sharing becomes impossible) stated explicitly.

**Conclusion**: no ADR required. The second bullet above is a breaking-ish change that belongs
in the PR description, not in `docs/adr/`.

## Approach

The rule, stated once: **at most one active chart node per
`(academicPeriodId, entityTypeId, entityCode)` where `entityCode` is not null.**

It has to hold at four TypeScript entry points, inside one PL/pgSQL function, and in the
schema. The central design problem is not any single check — each is a few lines — it is
keeping five copies of one rule from drifting. Three mechanisms handle that:

1. **One lookup, one error key** for all four TypeScript paths — a single repository method
   and a single validation helper (§ AC-1).
2. **One effective-trio resolver** shared between validation and the service, so validation
   can never check a different trio than the one that gets written (§ AC-2).
3. **The partial unique index is the arbiter.** Where the checks disagree, Postgres decides,
   and it fails loudly rather than writing a duplicate (§ AC-8).

### AC-1 — Maintenance create rejects a duplicate trio

`ChartRepository` gains one method — the only place the key is expressed in TypeScript:

```typescript
async findActiveNodeByEntity(
  academicPeriodId: number,
  entityTypeId: number,
  entityCode: number,
): Promise<{ id: number } | null>
```

It filters `isActive: true`. This matters: `findOneByCondition` on `BaseRepository` does not
filter `is_active`, so relying on it would let a deactivated node block a re-add and break
decision 5. Plain TypeORM `where` — no raw SQL is needed, so none is written.

`ChartValidation` gains one helper used by all four callers:

```typescript
static async isEntityTakenInPeriod(
  repo: ChartRepository,
  params: { academicPeriodId: number; entityTypeId: number | null; entityCode: number | null;
            excludeChartId?: number },
): Promise<boolean>
```

It returns `false` immediately when `entityCode == null` or `entityTypeId == null` — that is
where decision 2 (null exemption) lives, in exactly one place. It returns a boolean rather
than throwing, so each caller keeps the existing accumulate-then-throw pattern and its own
`result.*` message.

In `validateMaintenanceCreate`, the check goes **after** the existing entity-type and
entity-existence checks, so a row with an invalid type reports that rather than a confusing
duplicate error. The type code is already resolved there via `repo.getEntityTypeCode(...)`;
`resolveEntityCode(typeCode, dto.entityCode)` gives the effective code.

New i18n key in `config/strings/charts.validation.ts`:
`entityAlreadyAssigned: 'error.chart.entityAlreadyAssigned'`.

### AC-2 — Maintenance update rejects a duplicate trio, excludes self

This is the subtle one, and the place a naive implementation goes wrong.

`UpdateChartNodeDto` may carry `entityTypeId`, or `entityCode`, or neither. `ChartService.updateNode`
already computes the effective values (`charts.service.ts:79-87`): if `entityTypeId` is given it
re-resolves the code against the **new** type; if only `entityCode` is given it resolves against
the node's **existing** type; and `resolveEntityCode` nulls the code for types that do not take
one. If validation computes the trio any differently, it validates one thing and writes another.

So the resolution is extracted into a single exported function in `core/charts.validation.ts`:

```typescript
export const resolveEffectiveEntity = (
  current: { entityTypeId: number | null; entityTypeCode: string | null; entityCode: number | null },
  dto: { entityTypeId?: number; entityCode?: number },
  newTypeCode: string | null,
): { entityTypeId: number | null; entityCode: number | null }
```

Pure and synchronous — the type-code lookup stays with the caller, which already does it.
`validateMaintenanceUpdate` and `ChartService.updateNode` both call it. **`updateNode` must be
refactored to use it rather than keeping its own copy of the logic**; leaving both is the
drift this change exists to prevent.

`excludeChartId: id` is what makes a node not collide with itself, covering the "changes only
staff or title" half of the AC. `getNodeWithType(id)` already returns `entityTypeId`,
`entityTypeCode` and `entityCode`, so no new query is needed.

### AC-3 — Generic create rejects on the new key, independent of staff

In `validateCreate`, the old condition is deleted outright (decision 4):

```diff
- where: { staffId: data.staffId, academicPeriodId: data.academicPeriodId, entityCode: data.entityCode }
+ isEntityTakenInPeriod(repo, { academicPeriodId, entityTypeId, entityCode })
```

`CreateChartDto` has both `entityTypeId` and `entityCode` optional, so the null exemption in
the helper carries this path with no extra branching.

The existing `chartExists` key becomes unused. Delete it from `chartsValidationStrings` rather
than leaving it — a dead i18n key is a key the frontend keeps a translation for forever.
Grep both repositories for `error.chart.chartExists` before removing it.

_Observed, deliberately not changed:_ `CreateChartDto` carries `academicPeriodId` in the body,
which § Scope Headers says should come from `X-Academic-Period-Id`. That is pre-existing and
outside this change's scope; correcting it would alter the request shape and therefore
`openapi.json`, which AC-11 asserts is untouched. Worth its own change.

### AC-4 — Generic update rejects a duplicate trio, excludes self

Same shape as AC-2 but simpler, because generic update has no `resolveEntityCode` semantics —
it writes what the DTO says. The effective trio is the stored row merged with the DTO:

```
effectivePeriod = dto.academicPeriodId ?? node.academicPeriodId
effectiveTypeId = dto.entityTypeId     ?? node.entityTypeId
effectiveCode   = dto.entityCode       ?? node.entityCode
```

`validateUpdate` already loads the row via `findOneById`, and `ChartEntity` carries all three
fields, so the merge needs no new query. Pass `excludeChartId: id`.

Note `dto.entityCode ?? node.entityCode` cannot express "clear the code" — an explicit `null`
is indistinguishable from absent in the current DTO. That is pre-existing generic-CRUD
behaviour and this change does not alter it.

### AC-5 — Null entity code is exempt on every path

Guaranteed structurally rather than by four separate branches: `isEntityTakenInPeriod` returns
`false` when either component is null, and the partial index carries
`WHERE entity_code IS NOT NULL`. The upload function's checks are written to skip rows whose
resolved entity code is null for the same reason. Area, Subarea and untagged nodes repeat
freely.

### AC-6 / AC-7 — Upload rejects intra-file and file-vs-DB duplicates

One new migration recreating `audit.fn_upload_charts` in full. Per § Migrations the function
body is copied forward from `1781649412764` and edited; `down()` restores that exact body.

Two new checks, both placed with the existing intra-file checks **before** any write, both
set-based per the style of `1784093233471`:

- **`duplicateEntityInFile`** — rows grouping to the same `(resolved entity type, entityCode)`
  more than once. Every offending row is returned, not just the second, so the user sees both
  ends of the conflict in the annotated Excel (AC-6 says "both rows").
- **`entityAlreadyInPeriod`** — the resolved entity already has an active node in
  `p_academic_period_id`.

The resolution asymmetry is the trap here: **the file's `entityCode` column holds the business
code** (`programs.code`, `courses.code`) while **`charts.entity_code` holds the internal id**.
The existing insert already bridges this (`charts-upload` migration, pass 1). The new DB check
must resolve the business code to an id first and then look for an active chart on
`(academic_period_id, entity_type_id, resolved id)` — comparing the file's code against
`charts.entity_code` directly would compare a code to an id and silently never match.

Only `TG903-T003` (Program) and `TG903-T006` (Course) can reach these checks: School and Dean
are not uploadable, and Area/Subarea carry no code.

`chartsErrorMessages` in `src/modules/uploads/charts/model/charts-template.labels.ts` gains
both codes in **both** `es` and `en`. A missing entry means the raw code string is written into
the user's Excel — `annotateErrors` falls back to `messages[code] ?? code`.

Note the interaction with `chartsLoadedForSchoolPeriod`: it already blocks a second upload for
the same school and period, so `entityAlreadyInPeriod` fires for a file colliding with nodes
created through the maintenance UI, or — now that the key is global per period — with another
school's nodes in the same period. That second case is the one the requester asked for.

### AC-8 — Partial unique index

```sql
CREATE UNIQUE INDEX "UQ_charts_academic_period_entity_type_entity_code"
	ON organization.charts (academic_period_id, entity_type_id, entity_code)
	WHERE entity_code IS NOT NULL AND is_active = true;
```

A partial **index**, not a constraint, because Postgres `UNIQUE` constraints cannot carry a
`WHERE` clause. It keeps the `UQ_` prefix from § Migrations because it enforces uniqueness;
`IDX_` would misdescribe it. 49 characters, within the 63-byte identifier limit.

`is_active = true` in the predicate is decision 5 expressed in the schema. Since generic
`delete` is a hard delete and `deleteNode` hard-deletes the subtree, inactive rows arise only
from an explicit `isActive: false` update — but the predicate keeps the index honest if that
ever changes.

**Race backstop.** Without translation a unique violation reaches `AllExceptionsFilter` as a
raw driver error and returns `500 error.internalServer`. `ChartRepository` therefore catches
`QueryFailedError` with SQLSTATE `23505` **on this index name only** and rethrows
`ConflictError(chartsValidationStrings.error.entityAlreadyAssigned)`, so a lost race and a
detected duplicate look the same to the client. The translation lives in the repository —
it is the layer that owns the database, and putting index names in the global filter would
give a shared file module-specific knowledge. One private helper wrapping `create` and
`update` covers all four paths.

### AC-9 — Migration safe against pre-existing duplicates

Production audited clean on 2026-08-02 (proposal § Dependencies), but the migration must not
assume that — writes continue until this ships.

`up()` runs a guard query **before** creating the index: group active rows with a non-null
entity code by the trio, `HAVING count(*) > 1`. If any rows come back, throw an `Error` whose
message lists the offending `(academic_period_id, entity_type_id, entity_code)` groups with
their chart ids. TypeORM aborts the migration in its transaction and nothing is written.

Letting `CREATE UNIQUE INDEX` fail on its own would also be safe, but its message names only
the index — the operator would still have to go find the conflicts by hand at deploy time.

`up()` never deletes or deactivates a chart node. That is AC-9's explicit prohibition and it
is not negotiable: choosing which duplicate survives is a data decision with IFC consequences.
`down()` drops the index and restores the prior `fn_upload_charts` body.

### AC-10 — Validation spec coverage

`core/charts.validation.spec.ts` gains cases for all four entry points, the self-exclusion
cases and the null exemption. `mockRepo` gains `findActiveNodeByEntity`.

**The existing spec has a live fixture trap** — `validateCreate` is currently tested with
`{ name: 'test' }`, a DTO carrying none of the fields the rule reads. It passes because the
query is built from `undefined`s, not because the rule works. Those two cases must be rewritten
with realistic DTOs as part of this change, or they will keep passing no matter what the new
code does. Per § Testing, confirm each new case fails before the implementation lands.

### AC-11 — Old rule removed, spec unaffected

`grep -rn "chartExists" src/` returns nothing when done. `pnpm openapi:export` produces no diff
— asserted, then verified by running it. If it _does_ diff, something changed a DTO or route
and the design was wrong; regenerate and say so in the PR.

## Backend

- **Module**: `src/modules/organization/charts/` and `src/modules/uploads/charts/`
- **Entities**: none. `ChartEntity` is unchanged — the index is schema-level and TypeORM does
  not need to know about it (`synchronize: false`).
- **Migration**: one, hand-written, created with
  `pnpm migration:create src/database/migrations/enforce-unique-chart-entity-per-period`.
  Carries the duplicate guard, the partial unique index, and the recreated
  `audit.fn_upload_charts`. Both `up()` and `down()` implemented.
- **Endpoints**: unchanged. No new route, no DTO field, no response shape change.
- **Guards / scope**: unchanged. Maintenance create already takes the period from
  `@AcademicPeriodId()`; the duplicate rule is scoped by that same period and adds no header.
- **i18n keys**: `+ error.chart.entityAlreadyAssigned` (application paths);
  `- error.chart.chartExists` (removed with the old rule). Upload codes
  `duplicateEntityInFile` and `entityAlreadyInPeriod` are **not** i18n keys — they are resolved
  to es/en text server-side in `charts-template.labels.ts` and written into the Excel.
- **Validation**: business rules in `core/charts.validation.ts` throwing `BadRequestError`;
  the 23505 backstop throws `ConflictError` from the repository. No DTO validation changes.

## Cross-repo mode

**Single-repo (backend only.)** The frontend renders i18n keys from its own dictionary and
needs one string added for `error.chart.entityAlreadyAssigned`, and one removed for
`error.chart.chartExists`. That is a translation edit against an unchanged API contract, not a
coordinated change: no endpoint, request, response or type moves, `openapi.json` is untouched,
and the backend can ship first without the frontend breaking — an untranslated key renders as
the key, which is ugly but not broken.

It is therefore recorded as a follow-up in `proposal.md` § Dependencies rather than being
given a change folder in `FRONT-ACREDITACION-3.0`. **Raise it with whoever owns the frontend
when this PR opens**, so the string is not discovered missing in production.

## Testing strategy

| AC  | Covered by                                                                                                                 | Kind                 |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | `charts.validation.spec.ts` — maintenance create, duplicate and free                                                       | unit                 |
| 2   | `charts.validation.spec.ts` — update onto another trio; self-update passes; type-only and code-only DTOs resolve correctly | unit                 |
| 3   | `charts.validation.spec.ts` — generic create, incl. differing `staffId`, and the case the old rule rejected now passing    | unit                 |
| 4   | `charts.validation.spec.ts` — generic update, incl. self-exclusion                                                         | unit                 |
| 5   | `charts.validation.spec.ts` — null `entityCode` and null `entityTypeId` on every path                                      | unit                 |
| 6   | `charts-upload.service.spec.ts` — a mocked `duplicateEntityInFile` row produces localized text in the annotated Excel      | unit (mapping only)  |
| 6   | Real upload of a file with two rows for one course                                                                         | **manual** → runbook |
| 7   | Real upload colliding with an existing node, and with another school's node in the same period                             | **manual** → runbook |
| 8   | Direct `INSERT` duplicating an active trio; null-code and inactive inserts succeed                                         | **manual** → runbook |
| 9   | `up()` against a seeded duplicate names the group and aborts; `down()` restores                                            | **manual** → runbook |
| 10  | The specs themselves; each confirmed red before green                                                                      | unit                 |
| 11  | `grep -rn "chartExists" src/` empty; `pnpm openapi:export` produces no diff                                                | **manual** → runbook |

The PL/pgSQL body is not reachable from Jest — `charts-upload.service.spec.ts` mocks
`callUploadFunction`, so the function's logic has no automated coverage and this change does
not invent a harness for it. AC-6 through AC-9 are genuinely manual, which is why the runbook
is not optional here.

## Risks

| Risk                                                                                                                                           | Mitigation                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Validation and `updateNode` compute different effective trios, so the check passes and the write duplicates                                    | One exported `resolveEffectiveEntity`, called by both. Refactoring `updateNode` onto it is part of the task, not a follow-up |
| Upload DB check compares the file's business code against `charts.entity_code` (an id) and never matches — a check that silently always passes | Called out explicitly in § AC-6/AC-7. The manual runbook step for AC-7 is what catches it; a green unit suite will not       |
| Rewriting the two `validateCreate` fixtures hides a real regression                                                                            | They are rewritten _first_, seen red against the current implementation, and only then is the rule changed                   |
| Removing `chartExists` breaks a frontend translation lookup or another caller                                                                  | `grep` both repos before deleting; the frontend follow-up is raised when the PR opens                                        |
| A duplicate is created between the audit and the deploy                                                                                        | The migration guard names the conflicts and aborts (AC-9); the runbook re-runs the check as a pre-deploy step                |
| The 23505 catch matches too broadly and swallows an unrelated unique violation as a chart duplicate                                            | Match on the index name as well as the SQLSTATE, never on SQLSTATE alone                                                     |

## Docs to update in this PR

- [ ] `docs/CONTEXT.md` § Business Rules — add the invariant: one active chart node per
      `(academic period, entity type, entity)`, entity-coded types only, global across schools.
      This section is explicitly for non-obvious rules the code enforces but does not explain,
      and the cross-school consequence is exactly that.
- [ ] No change to `docs/POLICIES.md` (read-only to skills) or `docs/adr/` (no ADR required).
- [ ] `openapi.json` — regenerate only if AC-11's no-diff assertion turns out false.
