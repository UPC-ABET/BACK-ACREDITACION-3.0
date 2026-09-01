# ADR-005 — Treat Planner as the sole grades source; retire Banner's grades scraping

- **Status**: Proposed
- **Date**: 2026-08-31
- **Deciders**: Leonardo Ferreyra
- **Tags**: scraping, exports, data-quality, banner, planner

<!-- Status lifecycle: Proposed → Accepted → (Deprecated | Superseded by ADR-NNN).
     Once Accepted, everything below is immutable. To change the decision, write a new
     ADR that supersedes this one and edit only the Status line here.
     Use "Proposed (retroactive)" when documenting a decision already live in production. -->

## Context

`GRADES_RC_SQL` (`src/modules/admin/scraping-exports/core/grades-rc-export.sql.ts`) has, since
its introduction, merged grades from two independent upstream scrapes — Banner
(`raw_notas`) and Planner (`raw_planner_nota`) — reconciling disagreements by data quality
and recency (`merged`'s `ORDER BY status_is_course_level DESC, is_numeric DESC, has_grade
DESC, scraped_at DESC`; `source` itself is not part of that ordering).

This was investigated after a Banner scrape run (`ScraperService.execute()`) finished
`'partial'` and — per the retention rule this project already made deliberately (see
`openspec/specs/scrape-retention-and-cached-exports/`) — had its otherwise-fully-successful
schedule (2,827 rows), enrollment (60,938 rows) and student (20,487 rows) data
cascade-deleted along with it, solely because the grades phase (`scrapeGrades`, calling
`/alumno/notaactual/notas/{studentCode}/{level}-{period}/{courseCode}`) failed. Reproducing
the failing requests live against the running backend's own token/HTTP client
(`BannerTokenService` + `BannerHttpClient`, unmodified) confirmed the 500s were a transient
Banner-side outage on that one endpoint, not a bug in this codebase — the same token was
authenticating the schedule/enrollment/student calls without issue throughout.

That investigation surfaced two structural problems with Banner as a grades source that are
independent of the outage itself:

1. **Banner's grades endpoint only exposes the currently-active academic period's notes.**
   It cannot be used to see or reconcile grades for any other period, which the export's own
   period-scoped generation otherwise assumes is possible for whichever period is requested.
2. **Banner is the less complete and less detailed of the two sources already being merged.**
   Planner's `raw_planner_nota` covers more periods and carries materially more detail per
   grade — a `evalComponentCode`/`percentage`/`weight` per evaluation, and explicit
   submission/status fields (`isSubmitted`, `statusName`, `markType`, `isSanctioned`) that
   Banner's flat `notas` array does not have. `GRADES_RC_SQL`'s own reconciliation rule
   already reflects this asymmetry structurally: Banner has no status field of its own
   (`banner_grades.status_raw` is hard-coded `NULL`) and no notion of an open evaluation
   (`is_submitted` hard-coded `true`), while Planner has both.

Continuing to scrape and store Banner grades data is what turned a transient outage in a
lower-value integration into total data loss for an otherwise-successful run. Retiring it
removes that failure mode at the source, rather than working around its symptom (see
Alternatives considered).

## Decision

We will treat Planner (`raw_planner_nota`) as the sole grades source for the `gradesRc`
export, and retire Banner's grades scraping entirely: `ScraperService` stops calling
`/alumno/notaactual/notas/...`, `raw_notas` (table, entity, repository) is removed, and
`GRADES_RC_SQL`'s Banner leg (`banner_grades`, `banner_sections`, `banner_legs`) is removed
in favor of `planner_legs` alone. The export's `careerCode` column — the one other thing
`banner_legs` was load-bearing for, via its join to `raw_alumno` — is preserved by a new,
standalone `raw_alumno`-based CTE, decoupled from grades data entirely, since `raw_alumno`
stays populated by `scrapeStudents` independent of this change.

## Consequences

### Positive

- A transient (or permanent) outage on Banner's grades endpoint can no longer turn an
  otherwise-successful Banner scrape run into a `'partial'` run that cascade-deletes its own
  schedule/enrollment/student data. That entire failure mode is removed, not mitigated.
- `gradesRc` generation drops one of its two upstream dependencies, simplifying
  `GRADES_RC_SQL` (removing three of its ~30 CTEs) and removing one of the two systems whose
  scrape has to succeed before the export can be generated for a period.
- The export stops silently preferring or blending data from the source that is
  structurally worse at this specific job (single-period visibility, no status/submission
  fields, no per-evaluation detail) whenever it happens to win the recency/quality tiebreak
  against Planner.

### Negative

- **Any grade that currently exists only in Banner, and was never also captured by Planner,
  will no longer appear in `gradesRc` after this change.** This has not been measured as of
  this ADR — no live diff of the old (Banner+Planner) versus new (Planner-only) query output
  has been run against real production data. The sibling change's implementation phase
  (`openspec/changes/retire-banner-grades-scraping/tasks.md`) is required to run that diff
  for at least one real period before this ships, specifically to know what, if anything, is
  actually lost — this ADR does not claim the loss is zero or negligible, only that it is
  judged an acceptable, quantifiable risk given Planner's already-broader period coverage and
  detail.
- Banner's grades data is not backfilled or archived before `raw_notas` is dropped; per the
  existing retention rule, only the latest completed run's rows exist at any given time
  regardless, so there is no larger historical archive being discarded beyond what a normal
  re-scrape would already have superseded.
- If a future period or edge case turns up where Planner's scrape genuinely cannot reach data
  Banner could, there is no fallback path left — this decision has no runtime toggle back to
  the old merge; reversing it means writing a new ADR and restoring the removed code from
  version control.

### Neutral

- Does not change Planner's own scraping, storage, or `GRADES_RC_SQL`'s reconciliation logic
  for Planner-sourced rows (`merged`'s `ORDER BY`) — only the Banner leg is removed.
- Does not change `raw_horario`, `raw_matricula`, or `raw_alumno` scraping/storage, or their
  continued use by the Secciones, Alumnos Matriculados, and Alumnos-Secciones exports — only
  `raw_notas` and the grades-scraping call are removed from the Banner scrape; the rest of it
  (schedule, enrollment, students) is untouched, including `raw_alumno`'s continued role in
  resolving `careerCode` under its new standalone CTE.
- Does not touch `openspec/specs/gradesrc-export-performance-and-storage`'s already-shipped
  Planner-side performance fixes (`scoped_planner_sections`, the conditional `e_nm` join,
  `section_designated MATERIALIZED`, `enable_nestloop`) — that change explicitly scoped
  Banner's leg as a non-goal at the time ("Banner's raw row count scales with the period the
  same ~2.9x rate everything else does, unlike Planner's 5.7x" — i.e. it was not the slow
  path being fixed), which is a separate concern from this trust decision.
- Does not change the public `ScraperPhase` enum value `'studentsAndGrades'` or the
  `RunSummary.counts` shape (`{ schedule, enrollment, students, grades }`) — `grades` stays
  in the shape, structurally always `0`, to avoid an unannounced response-shape change for
  the frontend.

## Alternatives considered

- **Keep both sources (status quo).** Rejected — this is exactly the reliability problem
  this decision fixes: a transient failure in the structurally weaker source (single-period
  visibility, less detail) was capable of discarding an entire otherwise-successful scrape
  run's data.
- **Keep `raw_notas`, but make grades scraping best-effort/non-fatal to the run's overall
  status.** Rejected as treating the symptom, not the cause: this would stop a Banner grades
  outage from cascading into data loss for the _other_ phases, but Banner's grades data would
  still be scraped, stored, and merged into the export despite being the less complete and
  less reliable of the two sources — the export would still silently prefer or blend an
  inferior source whenever it happened to win the recency/quality tiebreak.
- **Keep Banner as a fallback for periods Planner cannot cover, if any exist.** Not
  investigated — whether such periods exist is unknown at decision time. Left as an open
  question resolved by the mitigation diff required in Consequences (Negative): if that diff
  surfaces real, non-trivial grade loss for specific periods once implemented, that finding
  would warrant revisiting this decision via a new ADR. The decision proceeds now on the
  strength of Planner's already-broader period coverage and detail, not on a claim that the
  loss is proven to be zero.

## References

- `openspec/changes/retire-banner-grades-scraping/proposal.md` — the change this ADR
  supports, including the `'partial'`-run investigation that motivated it.
- ADR-004 — Store `gradesRc` rows in the shared `rows_data` jsonb storage. An adjacent
  decision about the same export's storage shape; its own "Neutral" section already noted it
  "does not touch `GRADES_RC_SQL` or the Planner-side merge's own performance work" — this ADR
  is the first to touch that query's _source_ composition rather than its storage or
  performance.
- `openspec/specs/gradesrc-export-performance-and-storage/proposal.md` — explicitly scoped
  Banner's leg (`banner_legs`/`banner_sections`) as a non-goal at the time, on performance
  grounds unrelated to this trust decision.
- `openspec/specs/scrape-retention-and-cached-exports/` — defines the `'partial'`/`'completed'`
  run retention and cascade-delete behavior this ADR's Context is about; this decision does
  not change that behavior, only removes the failure mode's trigger.
