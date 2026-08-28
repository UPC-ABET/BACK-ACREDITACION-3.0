### Task 1 — Single-campus downloads ✅ DONE (2026-08-28)

- [x] Task complete

**Files**

- `src/modules/evaluation/semaphore-reports/config/strings/semaphore-reports.validation.ts`
  (modify — `singleCampusRequired`)
- `src/modules/evaluation/semaphore-reports/model/semaphore-reports.dtos.ts` (modify —
  `campusIds` description)
- `src/modules/evaluation/semaphore-reports/api/semaphore-reports.service.ts` (modify —
  `SemaphoreCampusPlan` loses `zip`; `resolveCampusPlan` rejects >1; delete
  `fetchPerCampusRenderData`, `groupByCampusId`, `buildZipFilename`; both download paths
  collapse to one report)
- `src/modules/evaluation/semaphore-reports/api/semaphore-reports.service.spec.ts` (test)

**Steps (TDD)**

1. Replace the `resolveCampusPlan` / zip specs with the new contract: `all` for none, `single`
   for one, `400` `singleCampusRequired` for more than one (asserting `getCampuses` is never
   called), `404` `noData` for an unknown id.
2. Collapse the `generatePdfDownload` / `generateExcelDownload` dispatch specs to the two
   surviving modes.
3. `npx jest src/modules/evaluation/semaphore-reports` → green.

**Commit**: `feat(semaphore-reports): restrict report downloads to a single campus`

### Task 2 — Sede in the report header ✅ DONE (2026-08-28)

- [x] Task complete

**Files**

- `src/modules/evaluation/semaphore-reports/api/semaphore-pdf.theme.ts` (modify —
  `allCampuses` label)
- `src/modules/evaluation/semaphore-reports/api/semaphore-reports.service.ts` (modify —
  `buildDocument` takes `campusName`, appends the `Sede` metadata item)

**Steps**

1. `generatePdfDownload` resolves the campus label from the plan (`plan.campus.name`, else
   `L.allCampuses`) and passes it to `buildDocument`.
2. `npx jest src/modules/evaluation/semaphore-reports` → green.

**Commit**: `feat(semaphore-reports): show the campus in the report header`

### Task 3 — "Interpretación de Indicadores" scale (RC PDF) ✅ DONE (2026-08-28)

- [x] Task complete

**Files**

- `src/modules/evaluation/semaphore-reports/api/semaphore-pdf.theme.ts` (modify — labels +
  `.indicator-scale` styles)
- `src/modules/evaluation/semaphore-reports/api/semaphore-reports.service.ts` (modify —
  `formatLevelRange`, `contrastText`, `buildIndicatorScale`, RC/RV body split)
- `src/modules/evaluation/semaphore-reports/api/semaphore-reports.service.spec.ts` (test)

**Steps (TDD)**

1. Spec `formatLevelRange`: `[0 - 13>` / `[13 - 16>` / `[16 - 20]` from the real
   `12.999999`-style rows; `contrastText`: dark on `#f4c20d`, white on `#e30613`.
2. Implement, wire into `buildRcBody` right after the chart; `buildRvBody` keeps the previous
   body verbatim.
3. `npx jest src/modules/evaluation/semaphore-reports` → green.

**Commit**: `feat(semaphore-reports): add the indicator scale to the RC report`

### Task 4 — Consolidated course table (RC PDF) ✅ DONE (2026-08-28)

- [x] Task complete

**Files**

- `src/modules/evaluation/semaphore-reports/model/semaphore-reports.dtos.ts` (modify —
  `SemaphoreConsolidatedRowDto`, `SemaphoreConsolidatedGroupDto`)
- `src/modules/evaluation/semaphore-reports/api/semaphore-pdf.theme.ts` (modify — labels +
  table styles)
- `src/modules/evaluation/semaphore-reports/api/semaphore-reports.service.ts` (modify —
  `buildConsolidatedGroups`, consolidated table in `buildRcBody`, drop the three per-level
  blocks from the RC body)
- `src/modules/evaluation/semaphore-reports/api/semaphore-reports.service.spec.ts` (test)

**Steps (TDD)**

1. Spec `buildConsolidatedGroups`: sums a course across campuses, percentages from the summed
   counts, one `TOTALES` per outcome, groups and rows sorted naturally.
2. Implement and render.
3. `npx jest src/modules/evaluation/semaphore-reports` → green; `npx tsc --noEmit` clean.

**Commit**: `feat(semaphore-reports): replace the RC per-level tables with a consolidated table`

### Task 5 — Visual check against the models ✅ DONE (2026-08-28)

- [x] Task complete — rendered with rc-modelo-1's own numbers; the consolidated table and
      TOTALES row reproduce it exactly (156 / 783 / 806 / 1745). RV and the workbooks unchanged
      apart from the Sede header. Still to do against real data: `runbook.md`.

**Steps**

1. Generate an RC PDF for one campus and one for all campuses; compare against
   `reports/rc-modelo-1.pdf` / `rc-modelo-2.pdf`.
2. Confirm the RV PDF and both Excel workbooks are unchanged apart from the `Sede` header.

See `runbook.md`.
