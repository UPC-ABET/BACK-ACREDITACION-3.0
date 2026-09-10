# Tasks — Importancia por Outcome (GRA)

**Slug**: `gra-outcome-importance-report` · **Proposal**: `./proposal.md` · **Design**: `./design.md`

## Goal

A second GRA report, "Importancia por Outcome": mean score per outcome, charted with each bar
coloured by its acceptance band and tabled as outcome / mínimo / máximo / promedio / alumnos,
split one PDF per sede. Plus the GRA reporting tab realigned to LCFC's card layout.

## Milestone 1 — backend

- [x] 1. `OutcomeImportanceReportService` — aggregation (min/max/average/students per outcome,
     seeded from configured outcomes), band colouring, sede split, zip.
- [x] 2. Unit tests: aggregation, zero-response outcome, band boundary, sede split.
- [x] 3. DTOs, routes, Swagger and controller wiring for `gra/report/importance` and
     `gra/report/outcomes`.

## Milestone 2 — frontend

- [x] 4. `graService`: `listGRAReportOutcomes`, `generateGRAImportancePdf`.
- [x] 5. `GRAReports.tsx`: dashboard card (title/description above filters) + the new
     "Importancia por Outcome" card.
- [x] 6. es/en locale keys.
