# LCFC results report: NRC-level granularity

## Problem

The LCFC results PDF (`GET lcfc/report-pdf`, built by `LcfcReportService.generateResultsPdf`)
already breaks its "by course" table down to one row per course section (NRC), but it is
missing three fields a reviewer needs from that report: the course code, the assigned
professor, and the true enrolled-student count ("Alumnos Matriculados") — distinct from the
survey count, since LCFC surveys are only generated for a subset of enrolled students (see
Design). The endpoint was also never wired to any button in the frontend.

## What already exists

- `LcfcSurveyRepository.getDashboardData` (`core/lcfc-survey.repository.ts`) already
  produces one row per `(course, course_section)` pair for `byCourse`, aggregating survey
  completion counts. It lacked course code, professor, and enrollment count.
- `LcfcReportService.generateResultsPdf` renders that data as a single flat table. It had no
  concept of "aggregate by course" vs "break down by section".
- The frontend's `downloadLCFCReportPdf` (`lcfcService.ts`) called this endpoint but was
  never invoked from any component — dead code.

## Goals

- The by-course table in the LCFC results PDF can be rendered at two granularities:
  - **NRC (section)** — default. One row per course section: course, code, **professor**,
    section, matriculados, encuestados (completed), pending, total, completion rate.
  - **Course** — one row per course, sections summed together. Professor and section columns
    are omitted (a course can span several NRCs, each with a different professor).
- "Alumnos Matriculados" reflects real enrollment (`academic.student_section_enrollments`),
  not the LCFC survey count, which can be lower.
- The frontend's LCFC reports tab lets the user pick the granularity and download the PDF.

## Non-goals

- Changing the outcome-perception PDF (`PerceptionReportService` / `lcfc/report/perception`)
  — that report is unrelated; this change only touches the results/completion report.
- Adding a courseSectionId filter to scope the report to a single section — the whole point
  is a full breakdown table, not a single-section lookup.

## Acceptance Criteria

- `GET lcfc/report-pdf?groupBy=section` (default) includes course code, professor name, and
  enrolled-student count columns per NRC.
- `GET lcfc/report-pdf?groupBy=course` sums enrolled/completed/pending/total per course and
  omits professor and section columns.
- The frontend's LCFC reports view has a toggle to switch granularity and a button to
  download the PDF.
