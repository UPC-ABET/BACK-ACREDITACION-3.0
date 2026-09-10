# Importancia por Outcome (GRA)

## Problem

GRA's reporting tab has one report ("Dashboard — Graduandos") and lays it out differently from
LCFC: the title and description sit _below_ the filters instead of heading the card. Beyond the
inconsistency, GRA has no way to answer the question the accreditation commissions actually ask
of a graduating-students survey — _how important did graduates rate each outcome, on average?_
The perception report answers "how many responses fell in each acceptance band", not "what is
the mean per outcome".

## What already exists

- `PerceptionReportRepository.getScoreRows` already returns, per outcome and campus, the number
  of responses at each raw score. Mean, min, max and respondent count are all derivable from it;
  no new SQL is needed.
- `PerceptionReportRepository.getAcceptanceLevels` returns the period's performance levels
  (Deficiente / Esperado / Óptimo and their score ranges) — the colour key for the chart.
- `ReportChartService.buildGroupedBarChart` has a `singleBarPerCategory` mode that draws one bar
  per category taking that series' value and colour, which is exactly "one bar per outcome,
  coloured by the band its average falls into".
- `PerceptionReportService.generate` already splits a report into one PDF per sede plus a
  combined one, and zips them. The new report follows the same shape.
- LCFC's "Percepción por Outcome" card (`LCFCReports.tsx`) is the layout the GRA tab is being
  aligned to.

## Goals

- GRA's existing report gets the LCFC card layout: title and description above the filters.
- A new GRA report, "Importancia por Outcome", filtered by Carrera + Comisión + Outcome
  (outcome optional; empty means every outcome of that commission).
- Its PDF carries the established report shell (banner, metadata row, acceptance-level table)
  plus a bar chart of the mean per outcome, each bar coloured by the acceptance band its mean
  falls into, and a table of outcome / valor mínimo / valor máximo / promedio / cantidad de
  alumnos.
- One PDF per sede plus a combined "TODAS" one, zipped when there is more than one.

## Non-goals

- No change to the perception reports themselves.
- No new Excel export for the new report.
- Not offered for PPP or LCFC — the service is written to be survey-type agnostic, but only GRA
  wires a route to it.

## Acceptance criteria

- `POST gra/report/importance` returns `{ reports[], zip }` for a program + commission, with an
  optional `outcomeId` narrowing it to a single outcome.
- `POST gra/report/outcomes` lists the outcomes of a program + commission for the filter.
- An outcome configured but with no responses appears in the table with `—` for min/max/promedio
  and 0 students, rather than disappearing.
- A bar's colour matches the band containing its average; a mean equal to a band boundary lands
  in the lower band, the same rule `bandIndexForScore` already applies.
- The GRA tab shows both cards, each with its title and description above its filters.
