# Design — Defer scraping-export language rendering to download time

**Slug**: `defer-export-language-to-download`
**Proposal**: `./proposal.md`

## Read first

- `docs/CONTEXT.md` § Database — the `core` schema row, the memory-cap note on scraper
  concurrency, and the single-replica constraints (Planner session, grades-RC single-flight,
  survey job registries) — the same shared-resource reasoning this design leans on.
- `docs/POLICIES.md` § Migrations, § Naming Conventions, § Raw SQL convention — every column/
  constraint name below follows these; `rows_data`'s jsonb keys follow the snake_case-at-every-depth
  rule.
- `docs/adr/ADR-002-persisted-pollable-scraping-export-generation.md` — the decision this design
  revises (now marked superseded by ADR-003 for its storage shape).
- `docs/adr/ADR-003-language-neutral-scraping-export-generation.md` — the decision this design
  implements. Read this first; it has the full context, alternatives, and named costs.
- `openspec/specs/scrape-retention-and-cached-exports/design.md` — prior art for
  `reconcileIfStale`, the `gradesRc` single-flight guard, and the "download-while-stale" philosophy
  this design preserves.
- `src/modules/admin/scraping-exports/` — the module being modified, all of it:
  `api/scraping-export-generation.service.ts`, `api/scraping-exports.service.ts`,
  `api/scraping-exports.controller.ts`, `core/scraping-export-run.repository.ts`,
  `core/grades-rc-export.repository.ts`, `core/scraping-exports.repository.ts`,
  `model/scraping-export-run.entity.ts`, `model/scraping-exports.types.ts`,
  `model/scraping-exports.labels.ts`.

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Datastore, broker or cache choice             | No — still Postgres, still the main datasource.                                                                                                                                                                                                                                                                                                                                                                          |
| Auth or payments provider                     | No                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Public API contract change or breaking change | Partially — assessed, not an ADR trigger. `status`/`download`/`regenerate`'s routes, methods and request params are unchanged; `ScrapingExportStatusResponse` drops its `lang` field (see AC-5 below) but no field's _type_ changes and no endpoint starts requiring something it didn't before. This is a shape change requiring an `openapi.json` regen (per `docs/POLICIES.md`), not a breaking one requiring an ADR. |
| New module boundary or cross-repo split       | No — same module, same repo.                                                                                                                                                                                                                                                                                                                                                                                             |
| Language, runtime or framework                | No                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Contradicting an existing ADR                 | **Yes** — revises ADR-002's decision to persist a fully-rendered file per `(exportType, period, lang)`. Resolved: [ADR-003](../../../docs/adr/ADR-003-language-neutral-scraping-export-generation.md), which supersedes ADR-002's storage shape (ADR-002's choice of Postgres over S3, and of persisted state over the prior `JobRegistry`, still stand).                                                                |

**Conclusion**: ADR required and written — see ADR-003, linked above.

## Approach

### AC-1 — gradesRc merge runs once per period regardless of language count

`ScrapingExportGenerationService.triggerForBannerRun`/`triggerForPlannerRun` currently loop
`for (const lang of SUPPORTED_EXPORT_LANGS)` around every `fireAndForgetGenerate` call, including
the `gradesRc` branch. That loop is deleted outright: each trigger method calls
`fireAndForgetGenerate('gradesRc', period, 'auto', ...)` **once**. `claimForGeneration` and
`runGeneration` drop `lang` from their signatures entirely — there is nothing left to loop over.
`ScrapingExportGradesRcRowRepository`'s ingestion path (below) confirms this at the data layer: one
`(exportType='gradesRc', period)` key maps to exactly one set of child rows per completed
generation, never per language.

### AC-2 — downloading a never-generated language serves from what's already there

`download(exportType, period, lang)` no longer looks up a row keyed by `lang` — it looks up the one
`ScrapingExportRunEntity` row for `(exportType, period)`, and if a completed result exists,
**renders** it for the requested `lang`:

- Sync exports read `row.rowsData` (already fetched, language-neutral) and apply
  `resolveLabels(<labels>, lang)` — the same labelling logic that exists today in
  `generateStaff`/`generateSections`/etc., just no longer gated behind a fresh raw-datasource query.
- `gradesRc` pages `ScrapingExportGradesRcRowRepository.readPage(runId, hasObservations, ...)` twice
  (clean sheet, then observations sheet) and feeds `writeGradesRcSheets`'s existing per-row logic,
  now parameterized only by `lang` — no `GradesRcExportRepository.openGradesRcExport` call, no
  `exports-raw` connection touched, no Banner+Planner merge.

Neither path re-runs the underlying query. `en` after `es` (or vice versa, in either order, any
number of times) costs one render, not one merge.

### AC-3 — retry after failure/staleness isn't blocked by another language's state

This is a direct consequence of AC-1: once there is no per-language claim, there is no per-language
state left to leak across. `claimForGeneration`'s per-key `'running'` check and
`isGradesRcMergeInFlight()`'s system-wide check are both evaluated against `(exportType, period)`
only. A `regenerate` call for a period whose own row just flipped to `failed`
(`staleGenerationDetected`) is blocked only by: (a) that same period's own row genuinely being
`'running'`, or (b) — for `gradesRc` only — a **different period's** merge genuinely holding the
system-wide guard right now. Neither condition can be caused by "some other language of my own
export," because that condition no longer exists.

### AC-4 — sync exports' raw query runs once per period, language rendered from one result

Each of `generateStaff`/`generateSections`/`generateEnrolledStudents`/`generateStudentSections` is
split into a fetch (language-neutral, unchanged query) and a render (language-specific, unchanged
labelling):

```
fetchStaffRows(academicPeriodId) → StaffExportRow[]          // was generateStaff's query half
renderStaffExcel(rows, lang) → GeneratedExcel                 // was generateStaff's label half
```

Generation calls only the fetch half, once, and persists the result to `rowsData`. Download calls
only the render half, once per request, off the persisted rows. Same split for the other three.

### AC-5 — status/download/regenerate contract

Routes, HTTP methods, and request params (`exportType` path param, `lang`/nothing query params) are
unchanged. `ScrapingExportStatusResponse.lang` is **removed** — once generation state is
per-period, a field that used to identify which language a row belonged to has nothing left to
report; keeping it and echoing back whatever the caller asked for would be more misleading than
removing it. `status` and `regenerate` stop reading a `lang` query param at all (NestJS ignores
unknown query params by default — a caller that still sends `?lang=es` on these two continues to
work). `download` keeps `lang` — it is the one place the parameter still means something, now "which
language to render," not "which cached row to fetch." `openapi.json` is regenerated in the same PR
regardless, since `ScrapingExportStatusResponse`'s shape changes and the endpoints' descriptions
change even where params don't.

`ScrapingExportStatusResponse.fileName` **stays**, but its meaning narrows: it is no longer the
name of a specific stored file (there is no longer a per-language file to name), it is a readiness
signal — always the default-language name (`getDefaultExportFileName`), non-null exactly when
`status === 'completed'`. This was caught during pre-PR audit as a frontend-breaking omission:
`FRONT-ACREDITACION-3.0`'s `canDownload`/`isScrapingExportDownloadable` both gate the download
action on `response.fileName !== null`, and the original version of this design dropped the field
outright alongside `lang` without checking that consumer. See the Risks table below.

### AC-6 — migration reconciles existing rows without orphaning/duplicating data

Per ADR-003 §6: the migration clears `core.scraping_export_runs` outright (these are pure
derived/cache rows) before reshaping the schema — there is no partial-collapse logic to get wrong,
and nothing is left to orphan or duplicate because nothing old survives the migration. See
`runbook.md` for the operational consequence this has at deploy time.

## Backend

### Entities / migrations

**`ScrapingExportRunEntity`** (`model/scraping-export-run.entity.ts`) — modify:

- Remove `lang` (column + its place in `@Unique(...)`).
- Remove `fileBytes` (`@BinaryColumn()`) and `fileName` (`@TextShortColumn()`).
- Add `rowsData: unknown[] | null` via `@JsonColumn({ nullable: true, withDefault: false })` — used
  only by the four sync export types; always `null` for `gradesRc`. Written/read only through the
  entity's normal repository methods (`save`/`find`), never raw SQL, so `@JsonColumn`'s own
  transformer handles camelCase ↔ snake*case automatically. Row \_contents* (e.g.
  `{ professorCode, lastName, ... }`) must still use snake_case keys **at rest** per
  `docs/POLICIES.md`'s jsonb rule — the transformer is exactly what makes that free.
- Replace `@Unique('UQ_scraping_export_runs_export_type_period_lang', ['exportType', 'period', 'lang'])`
  with `@Unique('UQ_scraping_export_runs_export_type_period', ['exportType', 'period'])`.

**New `ScrapingExportGradesRcRowEntity`** (`model/scraping-export-gradesrc-row.entity.ts`), table
`core.scraping_export_gradesrc_rows`, main datasource, extends `BaseEntity` (this is
application-owned generated data, not a raw mirror — the `admin/*/raw/model` `BaseEntity` exception
in `docs/POLICIES.md` does not apply):

- `scrapingExportRunId` — `@IntegerFKIDColumn()` + a real `@ManyToOne(() => ScrapingExportRunEntity)`
  `@JoinColumn({ name: 'scraping_export_run_id', foreignKeyConstraintName:
'FK_scraping_export_gradesrc_rows_scraping_export_run_id' })`, `onDelete: 'CASCADE'`. Unlike
  `sourceBannerRunId`/`sourcePlannerRunId` on the parent entity, this one is a real FK — both tables
  live on the main datasource.
- `generatedAt` — `@DateColumn({ withDefault: false })`. Tags which completed generation's batch a
  row belongs to; see "Retention" below.
- Columns mirroring `GradeRcExportRow` 1:1: `sectionCode`, `studentCode`, `gradeTypeCode`,
  `gradeTypePercentage`, `grade`, `qualificationStatusCode` (`@TextShortColumn()` each);
  `academicPeriod`, `courseCode`, `courseName`, `studentName`, `careerCode`, `gradeTypeName`,
  `qualificationStatusName`, `source`, `scrapedAt` (`@TextMediumColumn()` — course/student names are
  free text, `TextShortColumn`'s 100-char cap is too tight to trust blindly); `observations` —
  `@JsonColumn()` (a small jsonb array of `GRADE_RC_OBSERVATIONS` codes — plain strings, no
  snake_case concern since there are no object keys).
- `hasObservations` — `@BooleanColumn({ withDefault: false })`, precomputed from
  `observations.length > 0` at insert time (mirrors what `READ_GRADES_RC_PAGE_SQL` already computes
  server-side today). Turns the two-pass sheet read into an indexed `WHERE`, not a jsonb
  array-length scan — served by the composite index below, not a column-level one of its own.
- Composite index `IDX_scraping_export_gradesrc_rows_run_generated_observations` on
  `(scrapingExportRunId, generatedAt, hasObservations, id)` — covers `readPage`'s full WHERE (run
  id, generated-at batch, observation half) + `ORDER BY id` in one scan. Added during pre-PR audit
  in place of the two single-column indexes an earlier version of this design had planned
  (`scrapingExportRunId` alone, `hasObservations` alone) — both would have been redundant once every
  real query filters on all three columns together, and three indexes on an insert-heavy table cost
  write throughput for no matching read benefit.
- `@PrimaryGeneratedColumn` id doubles as the keyset-pagination cursor (`ORDER BY id`,
  `WHERE id > $lastId`), same shape as `READ_GRADES_RC_PAGE_SQL`'s `exportSeq` cursor today.

**Migrations** (run via `pnpm migration:create src/database/migrations/<name>` — CLI-stamped
timestamps, not hand-picked, per `docs/POLICIES.md`):

1. `reshape-scraping-export-runs-language-neutral` — `up()`: `DELETE FROM core.scraping_export_runs`
   (documented in the migration's own comment, per ADR-003 §6 — nothing here survives collapse);
   drop `UQ_scraping_export_runs_export_type_period_lang`; drop `lang`, `file_bytes`, `file_name`
   columns; add `rows_data jsonb`; add `UQ_scraping_export_runs_export_type_period`. `down()`:
   reverse column/constraint changes (data loss from the `DELETE` in `up()` is not reversible — the
   `down()` only needs to restore the _shape_, which is the existing convention for this kind of
   migration).
2. `add-scraping-export-gradesrc-rows-table` — creates `core.scraping_export_gradesrc_rows` with the
   FK, columns, and indexes above.

### Repository changes

**`ScrapingExportRunRepository`** (`core/scraping-export-run.repository.ts`) — `findByKey`/
`upsertByKey` drop the `lang` parameter; `upsertByKey`'s patch type drops `fileBytes`/`fileName`,
gains optional `rowsData?: unknown[] | null`.

**New `ScrapingExportGradesRcRowRepository`** (`core/scraping-export-gradesrc-row.repository.ts`),
main datasource, via the injected `Repository<ScrapingExportGradesRcRowEntity>`:

- `insertBatch(runId, generatedAt, rows)` — chunked insert (1,000 rows/statement) as the ingestion
  pass consumes `GradesRcExportRepository`'s reader; `ScrapingExportsService.materializeGradesRc`
  flushes each chunk as it streams rather than collecting the whole merge into memory first (a
  full-period buffer being read in whole before the first insert was the exact risk this table
  exists to remove — caught in pre-PR audit and fixed before merge).
- `readPage(runId, generatedAt, hasObservations, afterId, limit)` — keyset-paginated read, mirrors
  `READ_GRADES_RC_PAGE_SQL`'s shape. `generatedAt` pins the read to one specific completed batch —
  also added during pre-PR audit — so a `download` racing a `regenerate` reads one self-consistent
  generation instead of a torn mix of the old and new rows (the child table briefly holds both
  batches at once between insert and delete; see Retention below). Served by the composite index
  `IDX_scraping_export_gradesrc_rows_run_generated_observations` on
  `(scrapingExportRunId, generatedAt, hasObservations, id)`, which covers this method's full WHERE +
  ORDER BY in one scan — there is deliberately no separate single-column index on
  `scrapingExportRunId` alone, since it would be redundant with this one's leading columns.
- `deleteStaleBatches(runId, keepGeneratedAt)` — `DELETE ... WHERE scraping_export_run_id = $1 AND
generated_at <> $2`. Called only after a new generation's own rows are fully inserted **and** the
  parent row has flipped to `completed` — see Retention below. A failure here is caught and logged,
  not propagated: the parent row is already `completed` and correctly pinned to the new batch by
  this point, so letting the error bubble up would have `runGeneration`'s catch incorrectly flip a
  successful generation to `failed` while a valid new batch sits live and unreachable behind that
  status. The stale batch simply outlives its usefulness on disk until the next successful
  generation retries the delete.

**`GradesRcExportRepository`** (`core/grades-rc-export.repository.ts`) — `GradesRcExportHandle.rows`
narrows from `(withObservations: boolean) => AsyncGenerator<...>` (two separate filtered passes,
used today to build two worksheets directly) to a single unfiltered
`rows: () => AsyncGenerator<GradeRcExportRow & { hasObservations: boolean }>` — one pass over the
`TEMP` table, since the two-sheet split now happens at _download_ time against the permanent child
table, not at generation time against the session-scoped temp table. `openGradesRcExport`,
`buildGradesRcParams`, and the `TEMP`-table SQL (`MATERIALIZE_GRADES_RC_SQL` etc.) are otherwise
unchanged — the merge itself does not move.

### Service changes

**`ScrapingExportsService`** (`api/scraping-exports.service.ts`) — split fetch from render for the
four sync types (`fetchStaffRows`/`renderStaffExcel`, etc. — see AC-4). For `gradesRc`, replace
`prepareGradesRc`/`generateGradesRc` with:

- `materializeGradesRc(academicPeriodId, runId, generatedAt)` — opens the merge handle (unchanged),
  pages through it once via the new unfiltered `rows()`, batches into
  `gradesRcRowRepository.insertBatch(runId, generatedAt, ...)`, closes the handle (releasing the
  `exports-raw` connection) as soon as ingestion finishes — materially earlier than today, which
  holds that connection through the entire render.
- `renderGradesRc(runId, lang)` — pages `gradesRcRowRepository.readPage` twice
  (`hasObservations: false`, then `true`) into the existing `writeGradesRcSheets`-shaped
  `WorkbookWriter` logic, `collectToBuffer`'d exactly as `generateGradesRc` does today. No raw
  connection involved.

**`ScrapingExportGenerationService`** (`api/scraping-export-generation.service.ts`):

- `triggerForBannerRun`/`triggerForPlannerRun` — drop the `for (const lang of
SUPPORTED_EXPORT_LANGS)` loops (AC-1).
- `claimForGeneration`/`runGeneration`/`runGenerator` drop `lang` from every signature.
  `runGeneration` starts threading the claimed row's `id` through to `runGenerator`, since
  `materializeGradesRc` needs it as the child rows' FK.
- Success path for `gradesRc`: `const generatedAt = new Date();` → `materializeGradesRc(academicPeriodId,
runId, generatedAt)` → `runRepository.upsertByKey(..., status: 'completed', finishedAt:
generatedAt, ...)` → **only after that upsert commits**, `gradesRcRowRepository
.deleteStaleBatches(runId, generatedAt)`. This ordering is the retention mechanism: the previous
  batch (a different `generatedAt`) stays fully readable and servable by `download` for the entire
  duration of the new merge, and is deleted only once the new batch is confirmed complete and live —
  preserving the existing "serve stale while regenerating" behavior from
  `openspec/specs/scrape-retention-and-cached-exports` instead of a delete-then-insert that would
  briefly serve nothing mid-regeneration.
- `getStatus`/`download`/`regenerate` drop `lang` from their DB lookups (`findByKey`); `download`
  gains the render step described in AC-2; `reconcileIfStale` is otherwise unchanged (still keyed on
  the row's `status`/`updatedAt`, just no longer also keyed on `lang`).

### Controller / DTOs

`ScrapingExportsController` (`api/scraping-exports.controller.ts`) — `status` and `regenerate` stop
accepting `@Query('lang')`; `download` keeps it. `ScrapingExportStatusResponse`
(`model/scraping-exports.types.ts`) drops `lang` but keeps `fileName` — see AC-5 — now sourced from
`getDefaultExportFileName(exportType)` (`model/scraping-exports.labels.ts`) rather than a stored
column. Swagger descriptions on all three endpoints updated to describe the new semantics
(`download`'s `lang` docs get an explicit "selects the rendered language; does not affect whether
the export is ready" note, since that is the whole point of this change and worth saying to whoever
reads the spec next).

### i18n / validation

No new i18n keys. `error.scrapingExport.staleGenerationDetected` and
`error.scrapingExport.alreadyGenerating` keep their existing meaning — this change fixes _when_
they fire, not what they say.

## Testing strategy

| AC  | Covered by                                                                                                                                                                            | Kind                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | `scraping-export-generation.service.spec.ts` — `triggerForBannerRun`/`triggerForPlannerRun` call the gradesRc branch exactly once regardless of `SUPPORTED_EXPORT_LANGS.length`       | unit                      |
| 2   | `scraping-export-generation.service.spec.ts` — `download` for a language never explicitly generated renders from existing `rowsData`/child rows without invoking the fetch/merge path | unit                      |
| 3   | `scraping-export-generation.service.spec.ts` — `regenerate` after a `staleGenerationDetected`/`failed` row succeeds without any lang-scoped mock state involved                       | unit                      |
| 4   | `scraping-export-generation.service.spec.ts` + `scraping-exports.service.spec.ts` — sync-export fetch called once per generation; render called per download from `rowsData`          | unit                      |
| 5   | `scraping-exports.controller.spec.ts` (existing, updated) + manual `pnpm openapi:export` diff review                                                                                  | unit / manual             |
| 6   | Migration `up()`/`down()` run against a seeded pre-migration fixture (multiple `(exportType, period, lang)` rows)                                                                     | manual — see `runbook.md` |

## Risks

| Risk                                                                                                                                                                                                                                                                                                                 | Mitigation                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every download now re-renders the workbook, reintroducing per-request work ADR-002 removed                                                                                                                                                                                                                           | Rendering reads only already-persisted data (an in-memory array, or an indexed table read) — never re-queries the raw datasource or reruns the Banner+Planner merge. Materially cheaper than what ADR-002 eliminated; named and accepted in ADR-003.                                                                                                   |
| Migration deletes every existing cached export                                                                                                                                                                                                                                                                       | Documented deploy step in `runbook.md`; regenerating is a normal, already-existing, self-service action — no data is lost that isn't trivially reproducible.                                                                                                                                                                                           |
| `core.scraping_export_gradesrc_rows` grows the main DB with a full period's grade lines, and briefly holds two generations' worth during a regenerate                                                                                                                                                                | Old batch deleted immediately after the new one completes (never before) — bounded to ~2x one period's rows at any moment, never unbounded.                                                                                                                                                                                                            |
| `lang`'s meaning silently changes on `regenerate`, and disappears from `ScrapingExportStatusResponse`, without a version bump                                                                                                                                                                                        | `openapi.json` regenerated in the same PR; `lang` is additive-safe at the transport level (unknown query params are ignored, a removed response field only matters if read) — flagged here rather than requiring a coordinated frontend PR. Confirm during implementation that the frontend does not read `.lang` off `status`/`regenerate` responses. |
| `fileName` dropping from `ScrapingExportStatusResponse` breaks `FRONT-ACREDITACION-3.0`'s Download button (`canDownload`/`isScrapingExportDownloadable` both gate on `response.fileName !== null`, which the response would never send again) — caught in pre-PR audit, not assessed when `lang` was first evaluated | `fileName` is kept as a readiness signal (see AC-5): always the default-language name, non-null exactly when `status === 'completed'`. No frontend PR required for this specific regression; the frontend still needs its own migration off reading `.lang`.                                                                                           |
| `GradesRcExportHandle.rows` signature change (`(withObservations) => ...` → `() => ...`) is a breaking change to an internal interface                                                                                                                                                                               | Contained entirely within `scraping-exports` module; no external consumer.                                                                                                                                                                                                                                                                             |

## Docs to update in this PR

- [ ] `docs/CONTEXT.md` § Database, `core` schema row — replace the ADR-002 reference with ADR-003,
      and mention `scraping_export_gradesrc_rows` alongside `scraping_export_runs`.
- [ ] `docs/CONTEXT.md` § Business Rules — add a short bullet recording the gradesRc child-row
      retention rule (delete the previous batch only once the new one completes), naming it as the same
      pattern as the existing Banner/Planner "latest completed run only" rule, per ADR-003 §5.
- [ ] `openapi.json` — regenerated (`pnpm openapi:export`) once the controller/DTO changes land.
