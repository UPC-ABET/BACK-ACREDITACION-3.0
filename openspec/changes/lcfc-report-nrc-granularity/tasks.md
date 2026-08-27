### Task 1 — Extend `byCourse` query with course code, professor, enrollment ✅ DONE (2026-08-27)

- [x] Task complete

**Files**

- `src/modules/survey/lcfc/core/lcfc-survey.repository.ts` (modify)

**Steps**

1. Add `LcfcCourseSectionRow` interface.
2. Extend the `byCourse` raw query: group by `cs.id`, join `professors`/`staff`, add a scalar
   subquery for `student_section_enrollments` count.

**Commit**: `feat(lcfc): add course code, professor and enrollment to results report`

### Task 2 — `groupBy` param end-to-end (DTO → service → PDF) ✅ DONE (2026-08-27)

- [x] Task complete

**Files**

- `src/modules/survey/lcfc/model/lcfc.dtos.ts` (modify — `LcfcReportQueryDto.groupBy`)
- `src/modules/survey/lcfc/api/docs/lcfc.swagger.ts` (modify — document the query param)
- `src/modules/survey/lcfc/api/lcfc.controller.ts` (modify — pass `groupBy` through)
- `src/modules/survey/lcfc/api/lcfc.service.ts` (modify — pass `groupBy` through)
- `src/modules/survey/lcfc/api/lcfc-report.service.ts` (modify — `aggregateByCourse`,
  conditional professor/section columns)
- `src/modules/survey/lcfc/api/lcfc-report.service.spec.ts` (test)

**Steps (TDD)**

1. Extend the spec with `courseCode`/`professorName`/`enrolled` fixture data and a second
   test for `groupBy: 'course'` aggregation.
2. `npx jest src/modules/survey/lcfc/api/lcfc-report.service.spec.ts` → green (2/2).
3. `npx tsc --noEmit` → no new errors introduced by this change.

**Commit**: `feat(lcfc): add groupBy (course|section) to results report PDF`
