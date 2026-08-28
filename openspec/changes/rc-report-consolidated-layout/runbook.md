# Runbook — RC report consolidated layout

No migration, no seed, no config. The whole change is presentation plus one request-validation
rule, so the only manual step is looking at the output.

## Validate the RC PDF against the models

`POST evaluation/semaphore-reports/rc/pdf`, header `x-academic-period: <a period with RC grades>`,
body `{ "programCommissionId": <id>, "campusIds": [<one campus id>] }`.

Compare against `reports/rc-modelo-1.pdf` / `reports/rc-modelo-2.pdf`:

- [ ] Header row reads `ACREDITADOR · COMISIÓN · CICLO · SEDE`, with the campus's own name in
      `SEDE`.
- [ ] Order is chart → **Interpretación de Indicadores** → Resumen por Outcome → Detalle de
      Cursos por Outcome.
- [ ] The scale has one segment per RC performance level, ascending, each labelled
      `<name>` over `[min - upper>` — and the last one closed, `[16 - 20]`. Cross-check the
      names, colours and cut points against
      `POST performance-levels/get-by-filters` `{ "instrumentTypeId": <the RC type id> }`.
- [ ] Segment widths are proportional to each level's span (the red band is the widest).
- [ ] The consolidated table's three level headers carry the level colours; the yellow header's
      text is dark, the red and green headers' text is white.
- [ ] Each level cell reads `(count) percentage%`; each outcome ends with a `TOTALES` row.
- [ ] The three "Listado de Cursos con Nivel …" tables are gone.
- [ ] Filename is `Reporte_Control_RC_<CAMPUS CODE>.pdf`.

Then repeat with no `campusIds`:

- [ ] `SEDE` reads `TODAS`, the report covers every campus, filename has no campus suffix.
- [ ] A course taught at several campuses appears **once** per outcome, with the campuses'
      counts summed.

## Validate the single-campus rule

- [ ] `{ "campusIds": [<a>, <b>] }` on all four download endpoints (`rc/pdf`, `rc/excel`,
      `rv/pdf`, `rv/excel`) → `400`, `errors: ["error.semaphoreReport.singleCampusRequired"]`.
- [ ] The same body on the JSON screen endpoints (`rc`, `rv`) still returns combined data — the
      rule is download-only.
- [ ] `{ "campusIds": [<an id that is not an active campus>] }` → `404`
      `error.semaphoreReport.noData`.

## Validate nothing else moved

- [ ] `rv/pdf` renders exactly as before apart from the new `SEDE` header field: the dotted
      "Niveles de Aceptación" line, the chart, the summary, and the three per-level tables.
- [ ] `rc/excel` and `rv/excel` open with the same four sheets and the same columns as before.

## Frontend

The campus picker on the RC/RV download buttons must become single-select. Until it does, a
user who ticks two campuses gets a `400` instead of a zip — the key to surface is
`error.semaphoreReport.singleCampusRequired`.
