# Runbook — Course chart nodes always resolve to a pre-configured program

**Slug**: `chart-program-ancestry`

## Before deploy — production audit (do this first)

This change does not retroactively fix existing chains (proposal § Non-goals). Before
deploying, run this query against production to know the size of what already violates the
new rule, so a large result is a conscious decision to ship anyway, not a surprise:

```sql
-- Active Area/Subarea/Course chart nodes whose ancestry never reaches a Program node
-- before the School root, per academic period.
WITH RECURSIVE up AS (
	SELECT c.id, c.root_chart_id, c.entity_type_id, c.academic_period_id
	FROM organization.charts c
	WHERE c.is_active = true
	UNION ALL
	SELECT c.id, p.root_chart_id, p.entity_type_id, c.academic_period_id
	FROM up c
	INNER JOIN organization.charts p ON p.id = c.root_chart_id AND p.is_active = true
)
SELECT c.id AS "chartId", c.academic_period_id AS "academicPeriodId", et.code AS "entityTypeCode"
FROM organization.charts c
INNER JOIN core.types et ON et.id = c.entity_type_id
WHERE c.is_active = true
  AND et.code IN ('TG903-T004', 'TG903-T005', 'TG903-T006') -- Area, Subarea, Course
  AND NOT EXISTS (
	SELECT 1 FROM up
	INNER JOIN core.types pt ON pt.id = up.entity_type_id
	WHERE up.id = c.id AND pt.code = 'TG903-T003' -- Program
  )
ORDER BY c.academic_period_id, c.id;
```

Record the row count here before deploying:

- Audit run on: `<date>` — `<N>` violating nodes found across `<M>` academic periods.

A non-zero result is not a blocker — the rule is forward-only — but if it is large, confirm
with the team whether historical periods need a separate, deliberate cleanup change before
relying on this rule for reporting.

## Manual verification — `audit.fn_upload_charts` (AC-3–AC-7)

Run against a local database with the migration applied (`pnpm migration:run`). Needs: an
academic period, a School with a Director chart node already configured (`chart-heads`), and
at least one Program pre-configured under that school via
`POST /admin-chart-heads/configure` with a `programs` entry.

1. **AC-3** — Build an Excel file with one Area row whose `parentCode` is the pre-configured
   program's `code`. Upload it (`POST` the charts-upload endpoint). Expect success; confirm in
   `organization.charts` that the new Area node's `root_chart_id` equals the program's chart
   id.
2. **AC-4** — Pre-configure the same program under a _different_ school (or use a program
   configured only for another school). Upload a file for the first school referencing that
   program's code as a parent. Expect `programNotConfiguredForSchool` on that row in the
   returned Excel, and zero rows written.
3. **AC-5** — Upload a file with a row whose `parentCode` matches neither any row's own `code`
   in the file nor any real program code. Expect `parentNotFound`.
4. **AC-6** — Upload a file with a row whose `parentCode` is blank. Expect `parentCodeEmpty`.
5. **AC-7** — Upload a file with an Area row that has a blank `parentCode`, and two Course
   rows beneath it (their `parentCode` correctly names the Area's own `code`). Expect only the
   Area row marked with an error in the returned Excel — the two Course rows carry no error of
   their own.
6. **AC-10** — After a successful upload (step 1), call the rollback endpoint with that
   upload's `uploadLogId`. Confirm the Area/Course nodes it created are gone, and confirm the
   Program node used as their parent is untouched (`organization.charts`, still active, still
   under the same school).

## Revert

`down()` in the migration restores `audit.fn_upload_charts` verbatim to the body from
`1785730489320-enforce-unique-chart-entity-per-period.ts` — Program becomes uploadable again,
blank `parentCode` becomes valid again, and the new error codes stop appearing. No data is
deleted by either direction of this migration; it only replaces the function body. Any
Program pre-configuration or Area/Subarea/Course nodes created under this change's rule remain
exactly as they are after a revert — reverting the function does not undo prior writes.
