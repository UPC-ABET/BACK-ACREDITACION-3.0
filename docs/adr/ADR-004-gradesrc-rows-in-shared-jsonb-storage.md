# ADR-004 — Store gradesRc rows in the shared `rows_data` jsonb column, not a dedicated child table

- **Status**: Proposed
- **Date**: 2026-08-22
- **Deciders**: Leonardo Ferreyra
- **Tags**: scraping, exports, storage, database

<!-- Status lifecycle: Proposed → Accepted → (Deprecated | Superseded by ADR-NNN).
     Once Accepted, everything below is immutable. To change the decision, write a new
     ADR that supersedes this one and edit only the Status line here.
     Use "Proposed (retroactive)" when documenting a decision already live in production. -->

## Context

[ADR-003](./ADR-003-language-neutral-scraping-export-generation.md) gave the four sync export
types (`staff`, `sections`, `enrolledStudents`, `studentSections`) a shared `rows_data jsonb`
column on `core.scraping_export_runs`, but deliberately gave `gradesRc` its own table,
`core.scraping_export_gradesrc_rows`, with keyset-paginated reads. Its "Alternatives considered"
section is explicit about why: _"Store `gradesRc`'s rows as a single `jsonb` blob... Rejected —
`prepareGradesRc`'s own comment records that holding a full period in memory at once already
OOM-crashed the process... A single `jsonb` column necessarily loads its full value on read,
reintroducing that risk."_ That decision was made without real row-count or byte-size data for
`gradesRc` specifically — it generalized from a past incident, not from a measurement.

A live investigation against the real production database (SSH + `psql`, read-only, against
`db_sys_acc` and the raw scraping DB `db_scrape_raw`), carried out while implementing
`defer-export-language-to-download` (the change ADR-003 designed; now merged and archived at
`openspec/specs/defer-export-language-to-download/`), has since produced that measurement. The
largest known period on the server, 202610, materializes to 52,387 `gradesRc` rows —
**20.5MB of uncompressed row content**, measured by pulling the real generated `.xlsx` file and
inspecting the unzipped XML directly (the `.xlsx`'s own 2.1MB is compressed at a ~9.2x ratio and
badly understates the real in-memory size). Against the 640MB container memory ceiling documented
in `docs/CONTEXT.md`, one JSON array of that size — even accounting for `JSON.parse` and
`BaseService.normalizeJsonbColumns`'s `camelizeKeys` pass materializing a second, camelCase copy of
every object in memory — is a small, bounded cost, not the unbounded one ADR-003 assumed when no
real number was available.

The `gradesrc-export-performance-and-storage` proposal
(`openspec/specs/gradesrc-export-performance-and-storage/proposal.md`) asks to re-open this
specific tradeoff with that number in hand, as part of unifying all five export types onto one
storage shape and deleting the dedicated table as complexity no longer earning its cost.

## Decision

We will store `gradesRc`'s materialized rows in the same `core.scraping_export_runs.rows_data`
jsonb column the other four export types already use, and delete
`core.scraping_export_gradesrc_rows` (table, entity, repository) entirely.

## Consequences

### Positive

- All five export types share one storage shape, one read path, and one write path — a new export
  type no longer has to decide between two established patterns.
- Deletes a table, an entity, a repository, the batch-insert helper, and the "insert new batch,
  flip status, delete stale batch" retention dance that existed solely to make a multi-row write
  behave atomically from a concurrent reader's point of view. A single `rows_data` column update is
  already one row, so Postgres's own MVCC gives that atomicity for free — a concurrent `download`
  sees either the whole old array or the whole new one, never a torn mix, with no `generatedAt`
  batch-tagging column required to enforce it.
- `gradesRc` generation releases its `exports-raw` pooled connection sooner: it now does one
  DB-to-DB batch read plus one final-array write to the main datasource, instead of that plus a
  second table's worth of per-batch inserts.

### Negative

- This reintroduces, by deliberate choice, exactly the class of risk ADR-003's rejection named: a
  future period whose `gradesRc` merge grows meaningfully past 202610's 52,387 rows / 20.5MB could
  still OOM the process the way the original incident (recorded only as an inline code comment, not
  measured) did. There is no per-row streaming safety net once the rows live in one jsonb value —
  only the empirical evidence that today's real, largest-known scale is comfortably within the
  640MB ceiling.
- `JSON.parse` of a ~20MB jsonb value, followed by `camelizeKeys` walking and rebuilding every one
  of ~52,000 objects, is a real CPU and transient-memory spike on every `download` request that the
  child table's keyset-paginated `readPage` calls did not have — that table only ever held one page
  of rows in memory at a time, by construction.
- Nothing in this column enforces or alerts on that growth. A larger future period fails silently
  (or crashes the process) with no earlier warning signal, unlike a dedicated table, which would
  have kept working — just more slowly — as row counts grew.

### Neutral

- Does not change how `gradesRc` generation is keyed (`(exportType, period)`, unchanged from
  ADR-003) or the system-wide single-flight guard around the Banner+Planner merge.
- Does not touch the other four export types, which were already on `rows_data`.
- Does not touch `GRADES_RC_SQL` or the Planner-side merge's own performance work, which this same
  proposal addresses independently — the query-shape fix and the storage-shape change are
  orthogonal, and this ADR covers only the latter.
- `es`/`en` rendering, ADR-003's language-neutral-generation model, and the `download`-time render
  step are unaffected — only where the language-neutral rows live between generation and render
  changes.

## Alternatives considered

- **Keep the dedicated child table, as ADR-003 decided.** Rejected: now that real production data
  bounds the risk it was written to avoid, the table's complexity — a second entity, repository,
  migration, and the batch-insert/stale-delete retention logic — is a cost with no longer-justified
  benefit, and it stands directly against this proposal's explicit goal of one shared storage shape
  across all five export types.
- **Keep the child table today, and only migrate to `rows_data` if a future period's row count
  approaches a size that would concern the 640MB ceiling.** Rejected as premature optimization in
  reverse: the child table's upkeep cost (a second read/write path, the retention dance) is paid
  continuously starting now, against a risk that is not real at any presently known scale. If a
  future period's real measured size approaches the ceiling, the risk can be reintroduced
  deliberately then, informed by that period's own numbers — the same discipline this ADR is itself
  applying to ADR-003's original, unmeasured assumption.
- **Keep the child table, but change only its access pattern (e.g. read the whole table into memory
  at once instead of paginating).** Rejected — this would take on the same OOM exposure this ADR
  already accepts, while keeping every cost of maintaining a second table and giving up the one
  advantage (paginated reads) it has left.

## References

- ADR-003 — Persist scraping exports as one language-neutral dataset per (exportType, period),
  rendered at download time. Superseded by this ADR on the `gradesRc` storage-shape point only —
  its language-neutral generation model, the `(exportType, period)` key, and the single-flight
  guard all stand unchanged.
- `openspec/specs/defer-export-language-to-download/` — the archived change ADR-003 designed and
  that implemented the `rows_data` column and the current `scraping_export_gradesrc_rows` table.
- `openspec/specs/gradesrc-export-performance-and-storage/proposal.md` — the proposal this ADR
  supports, including the real production measurements (52,387 rows / 20.5MB for period 202610)
  that motivate revisiting ADR-003's assumption.
- `src/modules/admin/scraping-exports/` — current implementation.
