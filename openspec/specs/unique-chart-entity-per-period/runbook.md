# Runbook — Unique chart entity per academic period

**Slug**: `unique-chart-entity-per-period`

Covers AC-6 through AC-9 and AC-11, which have no automated coverage: the PL/pgSQL body is not
reachable from Jest (`charts-upload.service.spec.ts` mocks `callUploadFunction`), and the index
and migration guard are schema-level.

## ⚠️ Deploy prerequisite

**Run the duplicate check against the target database before deploying.** Production was audited
clean on 2026-08-02, but writes continued after that and nothing prevents a new duplicate until
this change ships. If this returns rows, the migration will abort the deploy.

```sql
-- expected: 0 rows. Anything returned must be resolved by hand before deploying.
SELECT academic_period_id, entity_type_id, entity_code,
       count(*) AS nodes, array_agg(id ORDER BY id) AS chart_ids
FROM   organization.charts
WHERE  entity_code IS NOT NULL AND is_active = true
GROUP  BY 1, 2, 3
HAVING count(*) > 1;
```

If it returns rows, **stop and take it to the team.** Do not clear them to unblock a release —
which duplicate survives decides which node owns the IFCs and who gets notified. Re-parent the
loser's children onto the keeper _before_ deactivating it, or
`ChartRepository.getMaintenanceBranch` drops the whole branch from the tree endpoint (its
recursive walk requires `is_active = true` at every step) with no error.

Then, at deploy:

```bash
pnpm migration:run
```

No seed sync and no backfill. The migration is schema plus one function replacement.

## Manual validation

Scope headers throughout: `X-School-Id`, `X-Academic-Period-Id`. Use a period with an existing
School chart node, since the upload requires one.

| #   | Step                                                                                             | Expected                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Maintenance UI: add a node for a course that already has one in this period                      | `400`, message `error.chart.maintenanceCreateFailed`, `data` contains `error.chart.entityAlreadyAssigned`. No node appears in the tree                                          |
| 2   | Add two Area nodes and two untagged nodes under the same parent                                  | Both accepted — the rule never fires on a null entity code (AC-5)                                                                                                               |
| 3   | Edit an existing node changing only its title or staff                                           | Accepted. A node must not collide with itself (AC-2)                                                                                                                            |
| 4   | Edit a node so its entity type + code match another node in the period                           | `400` with `error.chart.entityAlreadyAssigned`                                                                                                                                  |
| 5   | Edit a node sending **only** `entityCode`, leaving `entityTypeId` absent                         | Resolved against the node's existing type; rejected only if that trio is taken. Confirms validation and `updateNode` agree (AC-2)                                               |
| 6   | Upload a template with two rows carrying the same course code                                    | `success: false`, no rows written, **both** rows annotated in the returned Excel with the localized duplicate message — not the raw code `duplicateEntityInFile` (AC-6)         |
| 7   | Create a course node via the maintenance UI, then upload a file containing that same course      | Row rejected with the localized "already exists in this period" text; nothing written (AC-7)                                                                                    |
| 8   | Upload for School B a file containing a course that School A already has a node for, same period | Rejected. **This is the case the change was requested for** — confirm it explicitly, it is not covered by `chartsLoadedForSchoolPeriod`, which only guards one school at a time |
| 9   | Repeat step 6 with `lang=en` and `lang=es`                                                       | Message localized in both; no raw error code in either file                                                                                                                     |

## Data validation

```sql
-- 1. the index exists and is unique + partial
SELECT indexdef
FROM   pg_indexes
WHERE  schemaname = 'organization'
  AND  indexname  = 'UQ_charts_academic_period_entity_type_entity_code';
-- expected: CREATE UNIQUE INDEX ... WHERE entity_code IS NOT NULL AND is_active = true

-- 2. it rejects a duplicate (AC-8). Run inside a transaction and ROLLBACK.
BEGIN;
INSERT INTO organization.charts
       (staff_id, academic_period_id, root_chart_id, title, entity_type_id, entity_code,
        is_active, created_at, updated_at)
SELECT staff_id, academic_period_id, root_chart_id, title, entity_type_id, entity_code,
       true, NOW(), NOW()
FROM   organization.charts
WHERE  entity_code IS NOT NULL AND is_active = true
LIMIT  1;
-- expected: ERROR duplicate key value violates unique constraint
ROLLBACK;

-- 3. null entity codes are still free to repeat (AC-5 / AC-8)
SELECT entity_type_id, count(*)
FROM   organization.charts
WHERE  entity_code IS NULL AND is_active = true
GROUP  BY 1;
-- expected: counts > 1 are fine and must not have been blocked

-- 4. the invariant holds after deploy
SELECT count(*) FROM (
  SELECT 1 FROM organization.charts
  WHERE entity_code IS NOT NULL AND is_active = true
  GROUP BY academic_period_id, entity_type_id, entity_code
  HAVING count(*) > 1
) q;
-- expected: 0
```

Also confirm AC-11 on the branch, before the PR:

```bash
grep -rn "chartExists" src/          # expected: no output
pnpm openapi:export && git diff --stat openapi.json   # expected: no diff
```

## Symptom → diagnosis

| Symptom                                                           | Likely cause                                                                                                                            | Check                                                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Migration aborts naming `(period, type, code)` groups             | Duplicates appeared after the pre-deploy check                                                                                          | This is the guard working as designed (AC-9). Resolve the groups, then re-run                                      |
| Upload accepts a row that duplicates an existing node             | The DB check compares the file's business code against `charts.entity_code`, which holds an internal id — it compiles and never matches | Re-read design § AC-6/AC-7. Confirm the function resolves `programs.code`/`courses.code` to an id first            |
| A branch vanishes from the maintenance tree after a manual dedup  | A node was deactivated while its children still pointed at it                                                                           | `getMaintenanceBranch` requires `is_active = true` at every recursive step. Re-parent the children onto the keeper |
| `500 error.internalServer` instead of a `409` on a duplicate      | The 23505 translation is not matching — wrong index name, or matching SQLSTATE only                                                     | `ChartRepository`, Task 1.4. Confirm it matches both the SQLSTATE and the index name                               |
| Raw code like `entityAlreadyInPeriod` appears in the user's Excel | Missing entry in `chartsErrorMessages` for that language                                                                                | `charts-template.labels.ts` — `annotateErrors` falls back to the raw code                                          |
| Validation passes but the write duplicates                        | Validation and `ChartService.updateNode` compute different effective trios                                                              | Both must call `resolveEffectiveEntity` (Task 1.2)                                                                 |

## How to revert

Reverting the code alone is **not** sufficient — the migration creates an index and replaces a
PL/pgSQL function.

```bash
pnpm migration:revert   # drops the index and restores the prior fn_upload_charts body
```

Reverting is safe and loses no data: the migration never writes to or deletes from
`organization.charts`. Duplicates created while the change was reverted must be cleared before
it can be applied again.

## Do NOT

- **Do not delete chart nodes to make the migration pass.** A node may own IFCs and drive
  notification routing. Deactivate the loser after re-parenting its children, and only once the
  team has chosen which node survives.
- **Do not drop the index to unblock an upload.** If the upload is being rejected, the file
  contains a duplicate — that is the feature. Fix the file.
- **Do not add `is_active` to the index predicate's opposite sense**, or make the index
  non-partial, to "catch more". A non-partial index blocks multiple Area/Subarea nodes, which
  is decision 2 in the proposal and would break every real org chart.
- **Do not run `pnpm migration:run` against production from a developer machine.** It goes
  through the deploy path.
