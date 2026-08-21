# Multi-Campus Semaphore Report Downloads + RC Query Perf

**Slug**: `semaphore-reports-campus-download`
**Branch**: `fix/semaphore-reports-campus-download`
**Repos affected**: backend only
**Created**: 2026-08-20 (retroactive — written after implementation, per PR #118 review feedback)

> This proposal is retroactive: the change was implemented and reviewed as a one-shot fix
> before a change folder was added. It documents what shipped, for the record and for anyone
> picking up related work later.

## Problem

The semaphore report download endpoints (RC/RV PDF and Excel) accepted a single
`campusId` filter, so a caller needing several campuses' reports had to issue one request
per campus. Separately, the RC report queries (`SEMAPHORE_RC_*_SQL`) had no supporting
indexes for several of their join/filter predicates — one `detail` query alone measured
~100s against local seed data (2.8k `course_sections`, 44k `student_course_grades`), with
a single JSONB expression predicate (`study_plan_courses.extra->>'grade_type_id'`)
responsible for a 43.5-million-row intermediate join result.

## What changed

- `SemaphoreFilterDto.campusId` (single) → `campusIds` (array), validated with
  `@IsArray`/`@IsNumber({}, { each: true })`/`@ArrayMaxSize(50)`.
- `SemaphoreReportsService.resolveCampusPlan` decides, from the requested `campusIds`
  against the active campus catalog, whether a download is `'all'` (no filter, or the
  selection covers every active campus), `'single'` (exactly one campus), or `'zip'` (a
  proper subset of more than one) — the zip case bundles one PDF/XLSX per selected campus
  via `ReportGeneratorService.generateZip`/`archivePdfFiles`.
- `fetchPerCampusRenderData` fetches every selected campus's detail/summary/screen rows in
  ONE call to the underlying report queries (not one call per campus), then splits the
  result in memory by each row's own `campusId` — eliminating the N+1 that a naive
  per-campus loop would have introduced.
- New migration `AddSemaphoreReportIndexes` adds four indexes backing the RC/RV report
  queries; the dominant one (`study_plan_courses (course_id, (extra->>'grade_type_id')::int)`)
  took the ~100s `detail` query to ~2.7s in local `EXPLAIN ANALYZE` measurement.
- `openapi.json` regenerated for the six affected endpoints' `campusId` → `campusIds`
  contract change.

## Non-goals

- Not changing the JSON screen endpoints' response shape — they already return one combined
  result regardless of campus selection.
- Not adding a school-scoped campus catalog — `organization.campuses` is confirmed global
  (no `school_id` anywhere in that module).

## Acceptance criteria

1. **AC-1** — Given a download request with no `campusIds` (or one covering every active
   campus), when resolved, then one consolidated report is generated covering every campus.
2. **AC-2** — Given a download request with exactly one `campusIds` entry, when resolved,
   then one report scoped to that campus is generated, and its filename carries the
   campus's code.
3. **AC-3** — Given a download request with more than one but not all active campuses in
   `campusIds`, when resolved, then a zip containing one report per selected campus is
   generated, from a single shared query pass (not one query per campus).
4. **AC-4** — Given two campuses selected together in one zip download, when their reports
   are computed, then each campus's numbers (critical-course selection, percentages) are
   identical to what a single-campus request for that same campus would produce — i.e. the
   window functions computing "is this campus+outcome critical" partition by `campus_id`,
   not the campus display name (which carries no uniqueness guarantee).
5. **AC-5** — Given the new indexes are applied, when the RC detail query runs against
   representative seed data, then it completes in low single-digit seconds rather than
   ~100s.

### Traceability

| AC  | Satisfied by                                                                                    |
| --- | ----------------------------------------------------------------------------------------------- |
| 1   | `SemaphoreReportsService.resolveCampusPlan` (`mode: 'all'` branch)                              |
| 2   | `resolveCampusPlan` (`mode: 'single'`), `buildFilename`/`buildExcelFilename` campus-code suffix |
| 3   | `fetchPerCampusRenderData`, `generatePdfDownload`/`generateExcelDownload` zip branches          |
| 4   | `semaphore-reports.sql.ts` `windowed` CTEs partition by `campus_id` (RC/RV detail and summary)  |
| 5   | `1787285781432-add-semaphore-report-indexes.ts`                                                 |

## Dependencies

- `organization.campuses` (global catalog, no school scoping).
- `SemaphoreReportsRepository.getCampuses`, backing `resolveCampusPlan`.

## Risks

| Risk                                                                                                                                                       | Impact | Mitigation                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Window functions partitioned by campus display name instead of `campus_id` would silently merge two same-named campuses' numbers in a multi-campus zip.    | Medium | Fixed — partitioned by `campus_id` in all four detail/summary queries (RC and RV), per PR #118 review. |
| `resolveCampusPlan` checked "selected everything" before "selected nothing", which would resolve an empty active-campus catalog to `'all'` instead of 404. | Low    | Fixed — the empty-selection check now runs first.                                                      |

## Open questions

None — scope was the PR as reviewed and merged; see PR #118 for full review history.
