# Perception report — parity with the legacy system

## Problem

The PPP / GRA / LCFC "Percepción por Outcome" PDF was meant to be a like-for-like
replacement of the legacy report, but a side-by-side comparison shows it is not:

- The report title wraps onto two lines because the font size is fixed at 17pt regardless
  of how long `reportName — programName` turns out to be.
- Chart categories and the `Outcome` column print the full namespaced outcome code
  (`EAC-BIO-1`) where the legacy report prints only the outcome number (`1`).
- The band columns are labelled `1 Punto` / `2 Puntos` / `3 Puntos`. Scores run 1..5, so
  those headers are simply wrong — they are band ordinals, not points.
- There is no average column, the total column is labelled a bare `Total`, and a
  `Modalidad de Estudio` column repeats the header value once per row.
- Section headings are brand red; the legacy report prints them black.
- PPP cannot tell a first internship from a second one anywhere in the output, even though
  `evidence.surveys.survey_number` records it.
- The header always shows `MODALIDAD DE ESTUDIO: TODOS` because no caller ever sends
  `modalityLabel`.

## What already exists

- `PerceptionReportService` (`src/modules/survey/shared/`) builds the document for all
  three survey types; PPP, GRA and LCFC each call it with their own labels.
- `PerceptionReportDto` already accepts `surveyNumbers` and `modalityLabel`.
- `evidence.surveys.survey_number` already stores the PPP practice number (1 or 2), set on
  both the manual and bulk-upload paths, with duplicates rejected at upload time.
- `ReportHtmlService` builds the shared header/shell every report renders into.

## Goals

1. Title and organization name always render on a single line.
2. Chart categories and the `Outcome` column show the outcome number only.
3. Band columns are labelled with the configured band names.
4. Results table gains a `Promedio` column, uses a per-survey-type total label, and drops
   the `Modalidad de Estudio` column (the header already carries it).
5. Section headings render black.
6. PPP produces one PDF per practice, each naming its practice in the header and filename.
7. The header shows the study modality actually selected in the top bar.

## Non-goals

- Changing how the practice number is assigned at upload time. It stays an Excel column
  with duplicate rejection; only the report consumes it.
- Fixing missing accents in program names — those come from `academic.programs.name` in
  the database, so they are a data problem, not a report problem.
- The LCFC / GRA "program summary" PDF returned when no filters are selected.

## Acceptance criteria

- A GRA report for a career whose title runs ~80 characters renders on one line, untruncated.
- The GRA results table reads `Outcome | <band names…> | Promedio | Total de graduandos`.
- PPP with both practices in scope returns two PDFs, one per practice, each with a
  `PRÁCTICA` header field, plus a zip.
- LCFC and GRA headers show the top bar's modality rather than `TODOS`.
- `npx tsc --noEmit` and `npx jest src/modules/survey src/libs/reporting` are clean.
