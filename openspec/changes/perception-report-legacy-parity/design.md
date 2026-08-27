# Design

## Single-line header titles

There are no font metrics at HTML-build time, so `fitFontSizePt` in `report.utils.ts`
approximates rendered width as `characters x glyphRatio x fontSize` and returns the largest
size that still fits the available width. `ReportHtmlService` applies it to both header
lines, and `report.theme.ts` pins `white-space: nowrap` so a bad estimate degrades to an
ellipsis rather than silently reflowing to two lines.

The estimate is deliberately conservative (`glyphRatio` 0.55 mixed-case / 0.6 uppercase
against Arial's ~0.5 average), so titles land slightly smaller than strictly necessary.
Trading a little size for a guaranteed single line is the point of the change.

## Outcome labels

Outcome codes are namespaced per commission (`EAC-BIO-1`). The label is the trailing digit
group; codes with no trailing number keep the full code.

A campus-only request splits by commission, and its "all commissions" section can hold
`EAC-BIO-1` and `CAC-BIO-1` at once — both shorten to `1`. `aggregateOutcomes` detects the
collision per section and falls back to full codes for that whole section: an ambiguous
axis is worse than a long one.

## Per-practice PPP reports

`PerceptionReportRequest.surveyNumberSplit` is opt-in and PPP-only. When set,
`buildSurveyNumberGroups` partitions the score rows by `survey_number` and each group runs
through the existing campus/commission section pipeline, so the split composes with the
splits already there instead of replacing them. Rows with no survey number (or a survey
type that did not opt in) collapse to a single unsplit group, which is what GRA and LCFC
get.

The repository now selects and groups by `s.survey_number`; grouping by it is what makes
the partition possible without a second query.

## ADR gate

| Question                                | Answer                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| New dependency?                         | No.                                                                                             |
| New database object or migration?       | No — `evidence.surveys.survey_number` already exists.                                           |
| Cross-module coupling introduced?       | No — PPP/GRA/LCFC already depend on the shared perception service.                              |
| Breaking API change?                    | No. `modalityLabel` and `surveyNumbers` were already on the DTO; response shape is unchanged.   |
| Behaviour change visible to clients?    | Yes — PPP now returns one report per practice, so callers must keep handling a list plus a zip. |

No ADR required.
