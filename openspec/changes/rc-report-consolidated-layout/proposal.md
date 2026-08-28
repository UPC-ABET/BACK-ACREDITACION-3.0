# RC report: indicator scale, consolidated course table, single-campus downloads

## Problem

The RC semaphore PDF (`POST evaluation/semaphore-reports/rc/pdf`) does not match the layout the
accreditation team actually uses (`reports/rc-modelo-1.pdf`, `reports/rc-modelo-2.pdf`):

- It has no **"Interpretación de Indicadores"** scale — the reader cannot see which score range
  each colour stands for without decoding the dotted legend line above the chart.
- It splits the course breakdown into **three tables, one per performance level** ("Listado de
  Cursos con Nivel …"). The same course therefore appears in up to three places and the reader
  cannot compare a course's three level counts side by side.
- The **campus** is a column repeated on every row of every table instead of a header field,
  even though a download is normally scoped to one campus.
- A download may request **several campuses at once**, which the previous change answered with a
  zip of one report per campus. With the outcome filter left open, that multiplies
  `#outcomes × #campuses` tables into a single download and is what the team asked to stop.

## What already exists

- `SemaphoreReportsService.buildDocument` renders the shared RC/RV body: legend line, grouped
  bar chart, "Resumen por Outcome" (critical outcomes only), then the three per-level tables.
- `SemaphoreReportsRepository.getLevelsLegend` already returns exactly the rows the
  `performance-levels/get-by-filters` endpoint returns for the RC instrument type
  (`TG206-T003`): `name`, `minScore`, `maxScore` and `extra.color`. No new query is needed to
  colour the scale or the table headers.
- `getRcScreen` already returns, per `(course, outcome, campus)`, `totalStudents` and the
  `studentsRed` / `studentsYellow` / `studentsGreen` counts — the exact shape the consolidated
  table needs. It is already fetched for the PDF (it feeds the chart).
- `resolveCampusPlan` resolves a campus selection into `all` / `single` / `zip`, and
  `fetchPerCampusRenderData` + `ReportGeneratorService.generateZip` implement the zip path.

## Goals

- The RC PDF renders, in order: chart → **Interpretación de Indicadores** → Resumen por Outcome
  → one **consolidated** course table.
- **Interpretación de Indicadores** is a horizontal colour bar, one segment per RC performance
  level, each segment labelled with the level name and its score range (`Necesita Mejora`
  `[0 - 13>`). Colours, names and ranges come from `academic.performance_levels` for the RC
  instrument type — the same data `performance-levels/get-by-filters` serves.
- The consolidated table has columns `Outcome | Código | Curso | <level 1> | <level 2> |
<level 3> | Total de Alumnos`. Only the three level headers are coloured, with the level's own
  colour. Each level cell reads `(count) percentage%`. Each outcome group closes with a
  `TOTALES` row.
- **Sede** moves out of the tables and into the report header, alongside Acreditador, Comisión
  and Ciclo.
- A download accepts **at most one campus**. More than one is a `400`
  (`error.semaphoreReport.singleCampusRequired`). No campus still means one consolidated report
  over every campus, with `Sede: TODAS` in the header.

## Non-goals

- Changing the RV PDF body, or either Excel workbook. The single-campus rule applies to all four
  download endpoints (they share `resolveCampusPlan`), but the new layout is RC PDF only.
- Changing the JSON screen endpoints (`/rc`, `/rv`). They keep accepting several campuses —
  the grid is not a paginated document and does not have the overload problem.
- Removing the "Resumen por Outcome" table. It stays, between the scale and the consolidated
  table.
- Touching the report SQL. Every value the new layout needs is already returned.

## Acceptance Criteria

- `POST evaluation/semaphore-reports/rc/pdf` with `campusIds: [3]` returns one PDF whose header
  shows that campus's name and whose filename carries its code.
- The same call with `campusIds: [3, 7]` returns `400` with
  `errors: ['error.semaphoreReport.singleCampusRequired']`, and issues no report query.
- The same call with no `campusIds` returns one PDF covering every campus, header `Sede: TODAS`.
- The RC PDF contains an "Interpretación de Indicadores" section between the chart and
  "Resumen por Outcome", with one colour segment per RC performance level, in ascending score
  order, each showing the level name and its range.
- The RC PDF contains exactly one course table, with a row per `(outcome, course)` and a
  `TOTALES` row per outcome; the three per-level tables are gone.
- The RV PDF and both Excel workbooks render exactly as before, except that they too reject a
  multi-campus selection.
