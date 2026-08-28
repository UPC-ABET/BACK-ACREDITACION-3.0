# Design — backend

## Where the scale's data comes from

The team pointed at `POST performance-levels/get-by-filters` with `{ instrumentTypeId: 28 }` as
the source for the colours and ranges. That endpoint reads `academic.performance_levels` filtered
by instrument type — which is exactly what `SEMAPHORE_LEVELS_LEGEND_SQL` already does for the RC
instrument code `TG206-T003`, scoped to the report's academic period and already fetched for
every RC PDF (`fetchLegendAndMetadata`). So the scale reuses `data.legend`; no second query, no
hardcoded instrument-type id (28 is a per-environment `core.types` PK — the report must not
depend on it).

## Rendering the range labels

`performance_levels` rows are half-open in practice but stored closed: RC is
`[0, 12.999999]`, `[13, 15.999999]`, `[16, 20]`. Printing `maxScore` verbatim gives
`[0 - 12.999999]`, which is unreadable, and the model PDFs are internally inconsistent
(`[ 0 - 13 >`, `[13 - 16]`, `< 16 - 20 ]`).

`formatLevelRange` therefore derives the upper bound from the **next** level's `minScore`,
which is the real boundary, and closes only the top level on its own `maxScore`:

| level | rendered    |
| ----- | ----------- |
| 1     | `[0 - 13>`  |
| 2     | `[13 - 16>` |
| 3     | `[16 - 20]` |

This matches the example given (`"[0 - 13>"`) and stays correct if the period is configured with
a different number of levels or different cut points.

## Segment widths and label contrast

Each bar segment's `flex-grow` is its span (`upper − min`), so the bar reads as a real 0–20
scale rather than three equal thirds. A non-positive span falls back to `1` so a misconfigured
level still renders.

Label text is white or near-black depending on the segment's perceived luminance
(`contrastText`), because the middle level is normally yellow (`#f4c20d`), where white text is
unreadable. The same helper colours the three level headers in the consolidated table.

## Consolidated table source

The table needs, per `(outcome, course)`, all three level counts on one row — which is
`SemaphoreCourseOutcomeRow` (`getRcScreen`), already fetched for the PDF because it feeds the
chart. The three per-level tables it replaces came from `getRcDetail`, whose window functions
keep only the _representative_ course per campus+outcome+level; that filtering is what made a
side-by-side comparison impossible. `getRcDetail` is still fetched — "Resumen por Outcome"
(`getRcSummary`) and the RV body still depend on it.

`getRcScreen` returns one row per `(course, outcome, campus)`, so the consolidated case (no
campus filter) yields the same course several times. `buildConsolidatedGroups` sums those
across campuses keyed by `(outcomeCode, courseCode)` before computing percentages — a plain
`Σcount / Σtotal`, not an average of per-campus percentages. This is presentation-layer
aggregation with no DB access, so it lives in the service per the repository-boundary rule.

Level cells stay a fixed three columns: the report SQL buckets `level_rank` into exactly
`1|2|3`. Header labels come from `legend[0..2]` with the existing `redDetail`/`yellowDetail`/
`greenDetail` strings as fallback, so a period with a missing legend row still renders.

A student whose grade falls outside every configured level counts in `totalStudents` but in no
level bucket (the `LEFT JOIN levels` in the SQL), so the three level counts can sum to less than
the total. That is pre-existing behavior, unchanged, and visible in the `TOTALES` row.

## RC and RV share `buildDocument`, so the body splits

`buildDocument` stays the single entry point (header, metadata, styles, filename) and delegates
the body to `buildRcBody` or `buildRvBody`. `buildRvBody` is the previous body verbatim — legend
line, chart, summary, three per-level tables — so the RV PDF is byte-identical apart from the new
`Sede` header field. `buildRcBody` drops the dotted legend line, since "Interpretación de
Indicadores" is the same data rendered better and printing both would be a defect.

## Campus plan collapses to `all | single`

`SemaphoreCampusPlan` loses its `zip` arm. `resolveCampusPlan` now rejects a selection of more
than one id with a `400` **before** touching the campus catalog, so the invalid request costs no
query. The previous "selection covers every active campus ⇒ treat as all" rule is gone: with at
most one campus allowed, it can no longer be reached, and keeping it would mean a single-campus
tenant silently getting the consolidated header (`TODAS`) instead of its own name.

Deleted with the zip path: `fetchPerCampusRenderData`, `groupByCampusId`, `buildZipFilename`.
`ReportGeneratorService.generateZip` keeps its place in the reporting lib — it is a generic
capability there, and `archivePdfFiles` (the Excel/IFC/perception path) is unaffected.

## ADR gate

| Gate                       | Verdict                                                       |
| -------------------------- | ------------------------------------------------------------- |
| New architectural pattern? | No — presentation change inside an existing service.          |
| Schema change / migration? | No — every value is already returned by the existing queries. |
| New external dependency?   | No.                                                           |
| Accepted risk / trade-off? | No.                                                           |

Doesn't warrant an ADR.

## API surface (openapi.json is the contract — sequential mode)

- `SemaphoreFilterDto.campusIds` keeps its type (`number[]`) and stays optional. Its description
  now states that the four download endpoints accept at most one id; the JSON screen endpoints
  are unchanged.
- New error key `error.semaphoreReport.singleCampusRequired`, returned as `400` from the four
  download endpoints.
- No route, verb or response-shape change.
