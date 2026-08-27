# Runbook

## Manual validation performed

The report HTML was built through the real `PerceptionReportService` + `ReportHtmlService`
with a stubbed repository (7 outcomes, 32 responses each, 3 acceptance bands), then
rendered in Chromium at A4 width and inspected.

Checked and confirmed on the rendered output:

- `UNIVERSIDAD PERUANA DE CIENCIAS APLICADAS` and
  `Informe de Encuesta de Graduandos — Ingeniería de Gestión Minera` each on one line.
  Re-run with an 82-character title (`… y Metalúrgica Aplicada`): still one line, not
  truncated.
- Chart categories and the `Outcome` column read `1..7`.
- Table header reads `Outcome | Necesita mejora | Esperado | Sobresaliente | Promedio |
  Total de graduandos` (`Total de alumnos` on the PPP run). No `Modalidad de Estudio`
  column.
- `Promedio` = 4.56 for a 2/8/22 split across scores 2/4/5 — matches
  `(2x2 + 4x8 + 5x22) / 32`.
- `Resultados por Outcome` and `Niveles de aceptación` headings render black.
- The PPP run emits `PRÁCTICA: Primera Práctica Preprofesional` in the header and
  `Reporte_PPP_Percepcion_Por_Outcome_TODAS_Primera_Practica_Preprofesional_<date>.pdf`
  as the filename.

## Post-merge check against real data

1. Pick a career/period that has both PPP practices loaded.
2. Generate the PPP perception report with survey numbers 1 and 2 selected — expect two
   PDFs plus a zip, each PDF scoped to its own practice.
3. Switch the top bar modality between Regular and EPE and regenerate a GRA report — the
   `MODALIDAD DE ESTUDIO` header value must follow the selection instead of showing
   `TODOS`.
