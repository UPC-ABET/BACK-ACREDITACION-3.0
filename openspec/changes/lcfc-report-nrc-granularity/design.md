# Design — backend

## Data source for "Alumnos Matriculados"

Survey rows (`evidence.surveys`) are only created for students whose own program has a
Control-outcome mapped to the course (see `LcfcNotificationRepository.getEnrolledStudentsByCourses`),
and only when notifications are explicitly sent for an active LCFC config. So
`COUNT(evidence.surveys WHERE course_section_id = X)` is a lower bound on, not equal to,
`COUNT(academic.student_section_enrollments WHERE course_section_id = X)`. "Alumnos
Matriculados" must come from `student_section_enrollments`, computed with a scalar subquery
per `course_section_id` to avoid a join fan-out against the surveys aggregation.

## Repository (`lcfc-survey.repository.ts`)

Extended the existing `byCourse` query in `getDashboardData` (no new query, no migration):

- `GROUP BY` now includes `cs.id` (was `c.name, cs.section_code` — coarser, and collision-prone
  if two courses ever shared a name+section pair).
- Added: `c.id AS "courseId"`, `c.code AS "courseCode"`, `cs.id AS "courseSectionId"`,
  `TRIM(CONCAT(st.first_name, ' ', st.last_name)) AS "professorName"` (INNER JOIN
  `academic.professors` → `organization.staff`; both FKs are non-nullable so INNER is safe),
  and `enrolled` via a scalar subquery against `student_section_enrollments`.
- New exported interface `LcfcCourseSectionRow` replaces the `any[]` return type for
  `byCourse`.

## Service (`lcfc-report.service.ts`)

- `generateResultsPdf` / `buildDocument` take a new `groupBy: 'course' | 'section'` param
  (default `'section'`, preserving current behavior as the default path).
- New private `aggregateByCourse(rows)`: collapses per-section rows into one per course,
  keyed by `courseCode` (falls back to `JSON.stringify(courseName)` for test fixtures without
  a code), summing `enrolled`/`completed`/`pending`/`total`. This is presentation-layer
  aggregation (no DB access), so it belongs in the service per the repository-boundary rule.
- The by-course table header/row rendering conditionally includes Professor + Section columns
  only when `groupBy === 'section'`.

## ADR gate

No new architectural pattern, no schema change, no new external dependency. Doesn't warrant
an ADR.

## API surface (openapi.json is the contract — sequential mode)

- `GET lcfc/report-pdf` gains an optional `groupBy` query param (`course` | `section`,
  default `section`) on `LcfcReportQueryDto`.
