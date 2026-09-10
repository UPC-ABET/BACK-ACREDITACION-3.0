# Design — Importancia por Outcome (GRA)

**Slug**: `gra-outcome-importance-report`
**Proposal**: `./proposal.md`

## Read first

- `docs/POLICIES.md` § Database Access (Repository Boundary), § i18n Key Convention,
  § Validation Pattern, § Auth & Guards, § Scope Headers, § Swagger/Routes Pattern
- `src/modules/survey/shared/perception-report.service.ts` — the sibling report service this one
  mirrors: band loading, sede split, render throttling, zipping, the acceptance-level table
- `src/modules/survey/shared/core/perception-report.repository.ts` — every query this change
  needs already exists here; no new SQL, no schema change
- `src/libs/reporting/report-chart.service.ts` — `singleBarPerCategory`
- `src/modules/survey/lcfc/api/lcfc.service.ts` + `lcfc.controller.ts` — the route/DTO/Swagger
  shape for a program+commission+outcome report, copied for GRA
- `FRONT-ACREDITACION-3.0/src/modules/surveys/components/lcfc/LCFCReports.tsx` — the card layout
  GRA's tab is aligned to

## ADR gate (walked, not skipped)

| Trigger                                       | Hit?                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------- |
| Datastore, broker or cache choice             | No                                                                    |
| Auth or payments provider                     | No                                                                    |
| Public API contract change or breaking change | No — purely additive: two new POST routes, no existing shape changes  |
| New module boundary or cross-repo split       | No — a new service inside the existing `survey/shared` + `survey/gra` |
| Language, runtime or framework                | No                                                                    |
| Contradicting an existing ADR                 | No                                                                    |

**Conclusion**: no ADR required.

## Approach

### Where the service lives

`survey/shared/outcome-importance-report.service.ts`, beside `perception-report.service.ts`.
It is survey-type agnostic (it takes a `surveyTypeCode`), because it reads the shared
`PerceptionReportRepository` and nothing in the aggregation is GRA-specific — but only GRA
wires a route to it. Extending `PerceptionReportService` instead was rejected: that file is
already ~1150 lines covering three distinct report shapes, and the two share data access, not
behaviour.

### Aggregation

`getScoreRows` returns `(outcome, campus, score, count)`. Per outcome:

- `students` = Σ count — one score row per student per outcome, so the count _is_ the
  respondent count.
- `min` / `max` = the lowest and highest `score` present.
- `average` = Σ(score × count) / students.

Outcomes are seeded from `getConfiguredOutcomes` so a configured outcome with no responses
stays in the table (`—` for min/max/promedio, 0 students) instead of vanishing — the same
reason `PerceptionReportService` seeds its own table that way.

### Colour

The bar takes the colour of the band containing its average, using the `score <= maxScore`
walk `bandIndexForScore` already applies, so a mean sitting exactly on a boundary falls in the
lower band consistently with every other report. The chart is one series per band with
`singleBarPerCategory`, which draws one bar per outcome carrying that series' colour, and keeps
the band legend as the colour key. An outcome with no responses has no bar.

### Sede split

`campusId` is not a filter on this report. Rows are split into a combined "TODAS" section plus
one per campus present, mirroring `buildCampusSections`; each section renders its own PDF, and
more than one PDF is zipped. Renders go through `createConcurrencyLimiter(3)` for the same
reason the perception reports do — one request can fan out to a dozen PDFs and flood the shared
render gate.

### Routes

- `POST gra/report/importance` → `GraImportanceReportDto` (`programId`, `commissionId`,
  optional `outcomeId`, optional `lang`).
- `POST gra/report/outcomes` → `ListGraReportOutcomesDto`, delegating to the existing
  `PerceptionReportService.listOutcomes`. GRA's existing `gra/outcomes/list` is a different
  thing (the survey _configuration_ selector), so it cannot be reused for this filter.

### Frontend

`GRAReports.tsx` gains the LCFC structure: each report is a `Card` whose title/description head
the card, filters in a grid below, actions right-aligned, then the shared
`PerceptionReportPanel` in `hideGenerateButton` + `externalFilters` mode. The new card reuses
that panel as-is — it already supports `requireCommission` and an `outcomeId` external filter.
