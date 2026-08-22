# Runbook — Defer scraping-export language rendering to download time

**Slug**: `defer-export-language-to-download`

## ⚠️ Deploy prerequisite

The `reshape-scraping-export-runs-language-neutral` migration (Task 1.1) **deletes every row** in
`core.scraping_export_runs` before reshaping the table — per ADR-003 §6, these are pure derived
cache rows with no audit value, and there is no lossless way to collapse the old
`(exportType, period, lang)` rows into the new per-`(exportType, period)`, language-neutral shape.

**Before this deploys**, tell whoever owns scraping-export usage: every generated export (staff,
sections, enrolled students, student-sections, gradesRc) will show `notGenerated` immediately after
the migration runs, for every period, until either the next Banner/Planner scrape completes for that
period or someone hits `regenerate` by hand. If a period's next scheduled scrape is not imminent,
regenerate the exports that matter (typically the current academic period's) right after deploy
rather than waiting.

```bash
pnpm migration:run
# then, per period that needs an export available immediately:
# POST /scraping/exports/gradesRc/regenerate  (and the other four exportTypes)
```

## Manual validation

| #   | Step                                                                                                                                                                                                                                               | Expected                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Trigger (or wait for) a completed Banner+Planner scrape pair for a test period                                                                                                                                                                     | `gradesRc` generation fires **once** — check logs for exactly one "materializing gradesRc" line, not one per language                                |
| 2   | `GET /scraping/exports/gradesRc/status` for that period                                                                                                                                                                                            | `status: 'completed'`, no `lang` field in the response                                                                                               |
| 3   | `GET /scraping/exports/gradesRc/download?lang=es`                                                                                                                                                                                                  | Downloads with Spanish headers/observations                                                                                                          |
| 4   | `GET /scraping/exports/gradesRc/download?lang=en` immediately after step 3, with no `regenerate` in between                                                                                                                                        | Downloads with English headers/observations, **without** a new merge running (check logs: no new "materializing gradesRc" line)                      |
| 5   | Repeat steps 1–4 for one of the four sync exports (e.g. `staff`)                                                                                                                                                                                   | Same behavior: one fetch, both languages downloadable from it                                                                                        |
| 6   | Force a `gradesRc` row into `staleGenerationDetected` (e.g. manually set `updated_at` back >20 minutes while `status='running'` in a test DB, or wait out `GENERATION_STALE_TIMEOUT_MS`), then immediately `POST regenerate` for the _same_ period | Succeeds (200, `status: 'running'`) — not blocked by `alreadyGenerating`                                                                             |
| 7   | While a `gradesRc` regenerate for period A is genuinely running, `POST regenerate` for `gradesRc`/period B                                                                                                                                         | 409 `alreadyGenerating` — the cross-period single-flight guard is intentionally unchanged (see ADR-003 § Neutral)                                    |
| 8   | While a `gradesRc` regenerate is running for a period that already has a completed prior batch, `download` that period in either language                                                                                                          | Serves the **prior** batch's file, not an error and not an empty file — confirms retention doesn't delete the old batch before the new one completes |

## Data validation

```sql
-- After the migration (Task 1.1), before anything regenerates: expect 0 rows.
SELECT count(*) FROM core.scraping_export_runs;

-- After a gradesRc generation completes: exactly one generated_at value's worth of rows
-- for that run — never two (that would mean retention's delete-after-success didn't run).
SELECT generated_at, count(*)
FROM core.scraping_export_gradesrc_rows
WHERE scraping_export_run_id = :runId
GROUP BY generated_at;
-- expected: exactly 1 row in this result set

-- No gradesRc child rows should ever outlive their parent run row.
SELECT r.id
FROM core.scraping_export_gradesrc_rows r
LEFT JOIN core.scraping_export_runs p ON p.id = r.scraping_export_run_id
WHERE p.id IS NULL;
-- expected: 0 rows (the FK's ON DELETE CASCADE should make this structurally impossible,
-- but check once after the first real regenerate cycle)
```

## Symptom → diagnosis

| Symptom                                                                                              | Likely cause                                                                                                                                                  | Check                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Every export shows `notGenerated` right after deploy                                                 | Expected — see Deploy prerequisite above                                                                                                                      | Confirm the migration ran; regenerate or wait for the next scrape                                                                             |
| `download` for a language returns stale/wrong content                                                | `renderStaffExcel`/`renderGradesRc` reading the wrong `lang`, or `resolveLabels` fallback silently defaulting to `es`                                         | Check the `lang` query param actually reached the render call; check `DEFAULT_TEMPLATE_LANGUAGE` fallback isn't masking a typo'd `lang` value |
| Two `generated_at` batches coexist for the same `scraping_export_run_id` for more than a few seconds | `deleteStaleBatches` didn't run, or ran before the parent row's upsert committed                                                                              | Check `runGeneration`'s gradesRc success path ordering (design.md § Backend, Service changes) — insert → flip parent → delete, in that order  |
| `alreadyGenerating` on a period whose own row already shows `failed`/stale                           | The **cross-period** single-flight guard is genuinely held by a different period's `gradesRc` merge — this is intentional (unchanged from before this change) | `GET status` for other periods' `gradesRc` to find which one is `running`                                                                     |

## How to revert

```bash
pnpm migration:revert   # reverts add-scraping-export-gradesrc-rows-table
pnpm migration:revert   # reverts reshape-scraping-export-runs-language-neutral
```

Reverting the code without reverting the migrations leaves the old code querying columns
(`lang`, `file_bytes`, `file_name`) that no longer exist — always revert migrations before or
together with rolling back the deploy, never after.

Reverting the migrations does **not** restore the deleted `scraping_export_runs` rows (the
`up()`'s `DELETE` is not reversible — see Deploy prerequisite). A revert returns the schema to the
old shape with an empty table; every export is `notGenerated` again until regenerated under the old
code, same as after the forward migration.

## Do NOT

- Do not attempt to hand-write `INSERT`s to "restore" pre-migration `(exportType, period, lang)`
  rows after the fact — there is no source to restore them from; regenerate instead.
- Do not delete rows from `core.scraping_export_gradesrc_rows` directly to "fix" a stuck generation
  — this bypasses the FK/retention invariant the service maintains and can leave `download` serving
  nothing for a period that still shows `completed`. Use `regenerate` instead.
- Do not relax the cross-period `gradesRc` single-flight guard as a "fix" for the 409 in symptom
  row 3 above — it is protecting the pooled-connection/memory-cap constraint documented in
  `docs/CONTEXT.md`, unrelated to what this change fixed. See ADR-003 § Neutral.
