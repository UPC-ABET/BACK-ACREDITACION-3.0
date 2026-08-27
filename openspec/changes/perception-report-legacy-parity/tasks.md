# Tasks

## 1. Single-line report header

- [x] Add `fitFontSizePt` to `src/libs/reporting/report.utils.ts`
- [x] Apply it to the organization name and the report title in `ReportHtmlService`
- [x] Pin `white-space: nowrap` on both header headings in `report.theme.ts`
- [x] Cover the shrink in `report-html.service.spec.ts`

## 2. Results table parity

- [x] Label band columns with the band names instead of `N Punto(s)`
- [x] Show only the outcome number in the chart categories and the `Outcome` column, with a
      full-code fallback when shortening collides inside a section
- [x] Add the `Promedio` column (weighted mean of the raw scores)
- [x] Take the total column label from the caller (`totalLabel`) and drop the
      `Modalidad de Estudio` column
- [x] Render section headings black

## 3. PPP first vs second internship

- [x] Select and group by `s.survey_number` in `PerceptionReportRepository.getScoreRows`
- [x] Add `surveyNumberSplit` to the request and partition documents by survey number
- [x] Name the practice in the header metadata and in the filename
- [x] PPP passes the split; GRA and LCFC do not

## 4. Per-survey-type labels

- [x] PPP `Total de alumnos`, GRA `Total de graduandos`, LCFC `Total de estudiantes`

## 5. Verification

- [x] `npx tsc --noEmit` clean (pre-existing `planner-scraper.service.spec.ts` errors aside)
- [x] `npx jest src/modules/survey src/libs/reporting` — 153 passed
- [x] `npx eslint src/libs/reporting src/modules/survey --max-warnings=0` clean
- [x] Rendered GRA and PPP reports through Chromium and inspected the output (see runbook)
