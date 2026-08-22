import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the RC/RV semaphore report queries (evaluation/semaphore-reports), whose read path
 * was measured (EXPLAIN ANALYZE, local seed data: 2.8k course_sections, 44k student_course_grades)
 * to take ~100 seconds for one instrument's `detail` query alone. Each of the 6 report queries
 * (screen/detail/summary x RC/RV) re-runs this same join chain, and the RC/RV download endpoints
 * can now run it several times concurrently per request (one per selected campus -- see
 * SemaphoreReportsService), so the cost below is paid for repeatedly in one request.
 *
 * The dominant fix, confirmed by measurement, is the LAST index:
 *
 *  - `study_plan_courses ((extra->>'grade_type_id')::int)`, alongside `course_id`. RC's
 *    `course_grades` CTE (SEMAPHORE_RC_SCREEN_SQL and its DETAIL/SUMMARY siblings) matches a grade
 *    to the course's designated grade type via `scg.grade_type_id = (spc.extra->>'grade_type_id')::int`
 *    -- a JSONB expression Postgres cannot collect ordinary column statistics for. With no
 *    supporting index, the planner had no way to estimate this expression's selectivity and picked
 *    a hash join keyed on `grade_type_id` ALONE (a handful of distinct values app-wide) instead of
 *    `(course_id, grade_type_id)` together: on the seed data this produced a 43.5-MILLION-row
 *    intermediate result (44k grades x every study-plan-course sharing that grade type, regardless
 *    of course) that then had to be filtered back down to the ~64k rows that actually matched by
 *    course -- millions of rows built and discarded for nothing. The composite expression index
 *    gives the planner real selectivity for that predicate and an efficient access path, which
 *    took the same EXPLAIN ANALYZE from ~100s to ~2.7s (37x) with no SQL changes.
 *
 * The other three close smaller, but real, gaps -- confirmed by grepping every migration for
 * CREATE INDEX / UNIQUE on these tables before writing this one:
 *
 *  - `course_sections.academic_period_id` had no supporting index: the only existing index on
 *    this table is `(course_id, academic_period_id)` (IDX_course_sections_course_period), whose
 *    leading column is `course_id`. Every report query here filters `course_sections` by
 *    `academic_period_id` alone -- academic period is the scope nearly every query in the app
 *    filters by first (see CONTEXT.md's Domain Vocabulary) -- so that index cannot serve this
 *    filter. `campus_id` rides along as the second column since the same queries also filter or
 *    join on it.
 *  - `student_course_grades.student_section_enrollment_id` had no index at all (the table only
 *    carries its own PK). This is the join from `student_section_enrollments` into what is very
 *    likely the largest table this report reads (one row per student, per course, per grade
 *    type, per period), inside the RC path's `course_grades` CTE. `grade_type_id` rides along:
 *    the same CTE filters it per row to the course's designated grade type.
 *  - `course_outcome_mappings.study_plan_course_id` / `.outcome_id` had no index either --
 *    both RC and RV join this table to resolve which outcomes a course's grade counts toward.
 *
 * Separately, on the same local DB, `course_sections`, `course_outcome_mappings`,
 * `student_section_enrollments` and `study_plan_courses` had NEVER been ANALYZEd (`pg_stat_user_tables`
 * showed 0 live tuples and a null `last_analyze`/`last_autoanalyze` for all four, despite real rows in
 * every one), which independently starves the planner of row-count estimates. That is environment
 * state, not something a migration fixes -- worth an operational check (`ANALYZE`, or confirming
 * autovacuum keeps up) after any large bulk load (e.g. the Banner/Planner scrape import), especially
 * in an environment where autovacuum's default thresholds may not have triggered yet.
 */
export class AddSemaphoreReportIndexes1787366374901 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_course_sections_academic_period_campus"
			ON "academic"."course_sections" ("academic_period_id", "campus_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_student_course_grades_enrollment_grade_type"
			ON "academic"."student_course_grades" ("student_section_enrollment_id", "grade_type_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_course_outcome_mappings_study_plan_course_outcome"
			ON "academic"."course_outcome_mappings" ("study_plan_course_id", "outcome_id")
		`);
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_study_plan_courses_course_grade_type"
			ON "academic"."study_plan_courses" ("course_id", (((extra->>'grade_type_id'))::int))
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX IF EXISTS "academic"."IDX_study_plan_courses_course_grade_type"`,
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "academic"."IDX_course_outcome_mappings_study_plan_course_outcome"`,
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "academic"."IDX_student_course_grades_enrollment_grade_type"`,
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "academic"."IDX_course_sections_academic_period_campus"`,
		);
	}
}
