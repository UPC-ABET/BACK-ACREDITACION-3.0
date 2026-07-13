import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rewrites audit.fn_upload_student_sections from a per-row PL/pgSQL loop (which ran ~6 correlated
 * subqueries per row → ~8ms/row, minutes for a 50k-row file) into a single set-based pass:
 *
 *   - one RETURN QUERY produces every validation error via a UNION ALL of set-based checks;
 *   - GET DIAGNOSTICS ROW_COUNT decides whether any error was emitted, and if so the function
 *     stops before inserting (same all-or-nothing behavior);
 *   - the insert (already set-based) is unchanged.
 *
 * Error codes, precedence, and which rows pass/fail are preserved exactly. Combined with the new
 * join-column indexes this turns a ~7-minute validation into seconds.
 *
 * down() restores the previous loop-based (but window-DISTINCT-fixed) definition from
 * 1784006633470.
 */
export class SetBasedStudentSectionsUploadFunction1784093233471 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_student_sections(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
-- CTE columns below are named row_number/error_code, matching the RETURNS TABLE OUT params;
-- resolve any such clash in favor of the query column, not the OUT variable.
#variable_conflict use_column
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_log_id integer;
	v_err_count integer;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- ── Emit every validation error in one set-based pass ──────────────
	RETURN QUERY
	WITH input AS (
		SELECT
			(e->>'rowNumber')::int              AS row_number,
			NULLIF(trim(e->>'sectionCode'), '') AS section_code,
			NULLIF(trim(e->>'studentCode'), '') AS student_code
		FROM jsonb_array_elements(p_rows) AS e
	),
	resolved AS (
		SELECT
			i.row_number,
			i.section_code,
			i.student_code,
			cs.id                 AS cs_id,
			cs.course_id          AS cs_course_id,
			cs.academic_period_id AS cs_period_id,
			st.id                 AS st_id
		FROM input i
		LEFT JOIN academic.course_sections cs ON cs.section_code = i.section_code
		LEFT JOIN academic.students st ON st.code = i.student_code
	),
	flags AS (
		SELECT
			r.row_number,
			(r.section_code IS NOT NULL) AS has_section_code,
			(r.student_code IS NOT NULL) AS has_student_code,
			(r.cs_id IS NOT NULL)        AS sec_exists,
			(r.st_id IS NOT NULL)        AS stu_exists,
			-- student enrolled in the SAME academic period as the section
			EXISTS (
				SELECT 1
				FROM academic.enrolled_students es
				JOIN academic.study_plan_academic_periods spap
					ON spap.id = es.study_plan_academic_period_id
				   AND spap.academic_period_id = r.cs_period_id
				WHERE es.student_id = r.st_id
			) AS period_match,
			-- the section's course belongs to the student's study plan for that period
			EXISTS (
				SELECT 1
				FROM academic.enrolled_students es
				JOIN academic.study_plan_academic_periods spap
					ON spap.id = es.study_plan_academic_period_id
				   AND spap.academic_period_id = r.cs_period_id
				JOIN academic.study_plan_courses spc
					ON spc.study_plan_academic_period_id = spap.id
				   AND spc.course_id = r.cs_course_id
				WHERE es.student_id = r.st_id
			) AS course_in_plan,
			-- already enrolled in a DIFFERENT section of the same course/period in the DB
			EXISTS (
				SELECT 1
				FROM academic.enrolled_students es
				JOIN academic.study_plan_academic_periods spap
					ON spap.id = es.study_plan_academic_period_id
				   AND spap.academic_period_id = r.cs_period_id
				JOIN academic.student_section_enrollments sse
					ON sse.enrolled_student_id = es.id
				JOIN academic.course_sections cs_other
					ON cs_other.id = sse.course_section_id
				   AND cs_other.course_id = r.cs_course_id
				   AND cs_other.academic_period_id = r.cs_period_id
				   AND cs_other.id <> r.cs_id
				WHERE es.student_id = r.st_id
			) AS db_dupe_course
		FROM resolved r
	),
	-- intra-file duplicate (section, student)
	dup_in_file AS (
		SELECT row_number
		FROM input
		WHERE (lower(section_code), lower(student_code)) IN (
			SELECT lower(section_code), lower(student_code)
			FROM input
			WHERE section_code IS NOT NULL AND student_code IS NOT NULL
			GROUP BY lower(section_code), lower(student_code)
			HAVING count(*) > 1
		)
	),
	-- intra-file: same student in >1 DIFFERENT section of the same course/period within the file
	rows_expanded AS (
		SELECT
			i.row_number          AS rn,
			es.id                 AS enrolled_student_id,
			cs.course_id          AS course_id,
			cs.academic_period_id AS academic_period_id,
			cs.id                 AS section_id
		FROM input i
		JOIN academic.students st ON st.code = i.student_code
		JOIN academic.enrolled_students es ON es.student_id = st.id
		JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period_id
		JOIN academic.course_sections cs
			ON cs.section_code = i.section_code
		   AND cs.academic_period_id = spap.academic_period_id
		WHERE i.section_code IS NOT NULL AND i.student_code IS NOT NULL
	),
	intrafile_course AS (
		SELECT re.rn AS row_number
		FROM rows_expanded re
		JOIN (
			SELECT enrolled_student_id, course_id, academic_period_id
			FROM rows_expanded
			GROUP BY enrolled_student_id, course_id, academic_period_id
			HAVING count(DISTINCT section_id) > 1
		) dup
			ON dup.enrolled_student_id = re.enrolled_student_id
		   AND dup.course_id = re.course_id
		   AND dup.academic_period_id = re.academic_period_id
	)
	SELECT q.row_number, q.error_code, NULL::integer AS upload_log_id
	FROM (
		SELECT row_number, 'sectionCodeEmpty'::text AS error_code FROM flags WHERE NOT has_section_code
		UNION ALL
		SELECT row_number, 'sectionNotFound' FROM flags WHERE has_section_code AND NOT sec_exists
		UNION ALL
		SELECT row_number, 'studentCodeEmpty' FROM flags WHERE NOT has_student_code
		UNION ALL
		SELECT row_number, 'studentNotFound' FROM flags WHERE has_student_code AND NOT stu_exists
		UNION ALL
		SELECT row_number, 'studyPlanPeriodMismatch' FROM flags
			WHERE has_section_code AND has_student_code AND sec_exists AND stu_exists AND NOT period_match
		UNION ALL
		SELECT row_number, 'courseNotInStudyPlan' FROM flags
			WHERE has_section_code AND has_student_code AND NOT course_in_plan
			  AND NOT (sec_exists AND stu_exists AND NOT period_match)
		UNION ALL
		SELECT row_number, 'studentAlreadyEnrolledInCourse' FROM flags
			WHERE has_section_code AND has_student_code AND db_dupe_course
		UNION ALL
		SELECT row_number, 'duplicateRowInFile' FROM dup_in_file
		UNION ALL
		SELECT row_number, 'studentAlreadyEnrolledInCourse' FROM intrafile_course
	) q;

	GET DIAGNOSTICS v_err_count = ROW_COUNT;
	IF v_err_count > 0 THEN
		RETURN;
	END IF;

	-- ── No errors: insert ──────────────────────────────────────────────
	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T010'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert enrollments that do not exist yet (uniqueness = enrolled_student + course_section)
	INSERT INTO academic.student_section_enrollments
		(enrolled_student_id, course_section_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT es.id, cs.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.students st ON st.code = trim(e->>'studentCode')
	JOIN academic.enrolled_students es ON es.student_id = st.id
	JOIN academic.study_plan_academic_periods spap_es
		ON spap_es.id = es.study_plan_academic_period_id AND spap_es.academic_period_id = cs.academic_period_id
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap_es.id AND spc.course_id = cs.course_id
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		WHERE sse.enrolled_student_id = es.id AND sse.course_section_id = cs.id
	);

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restore the loop-based (window-DISTINCT-fixed) definition from 1784006633470.
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_student_sections(
	p_rows jsonb,
	p_academic_period_id integer,
	p_user_id integer,
	p_source_file text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- intra-file duplicate (section, student)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	FOR r IN
		WITH rows_expanded AS (
			SELECT
				(e->>'rowNumber')::int AS rn,
				es.id                  AS enrolled_student_id,
				cs.course_id           AS course_id,
				cs.academic_period_id  AS academic_period_id,
				cs.id                  AS section_id
			FROM jsonb_array_elements(p_rows) AS e
			JOIN academic.students st ON st.code = trim(e->>'studentCode')
			JOIN academic.enrolled_students es ON es.student_id = st.id
			JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period_id
			JOIN academic.course_sections cs
				ON cs.section_code = trim(e->>'sectionCode')
			   AND cs.academic_period_id = spap.academic_period_id
			WHERE NULLIF(trim(e->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
		)
		SELECT re.rn
		FROM rows_expanded re
		JOIN (
			SELECT enrolled_student_id, course_id, academic_period_id
			FROM rows_expanded
			GROUP BY enrolled_student_id, course_id, academic_period_id
			HAVING count(DISTINCT section_id) > 1
		) dup
			ON dup.enrolled_student_id = re.enrolled_student_id
		   AND dup.course_id = re.course_id
		   AND dup.academic_period_id = re.academic_period_id
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'studentAlreadyEnrolledInCourse'::text, NULL::integer;
	END LOOP;

	FOR r IN
		SELECT
			(e->>'rowNumber')::int              AS row_number,
			NULLIF(trim(e->>'sectionCode'), '') AS section_code,
			NULLIF(trim(e->>'studentCode'), '') AS student_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionNotFound'::text, NULL::integer;
		END IF;

		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentNotFound'::text, NULL::integer;
		END IF;

		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.students st ON st.code = r.student_code
			JOIN academic.enrolled_students es ON es.student_id = st.id
			JOIN academic.study_plan_academic_periods spap_es
				ON spap_es.id = es.study_plan_academic_period_id AND spap_es.academic_period_id = cs.academic_period_id
			WHERE cs.section_code = r.section_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanPeriodMismatch'::text, NULL::integer;

		ELSIF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.students st ON st.code = r.student_code
			JOIN academic.enrolled_students es ON es.student_id = st.id
			JOIN academic.study_plan_academic_periods spap_es
				ON spap_es.id = es.study_plan_academic_period_id AND spap_es.academic_period_id = cs.academic_period_id
			JOIN academic.study_plan_courses spc
				ON spc.study_plan_academic_period_id = spap_es.id AND spc.course_id = cs.course_id
			WHERE cs.section_code = r.section_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNotInStudyPlan'::text, NULL::integer;
		END IF;

		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (
			SELECT 1
			FROM academic.students st
			JOIN academic.enrolled_students es ON es.student_id = st.id
			JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period_id
			JOIN academic.course_sections cs_target
				ON cs_target.section_code = r.section_code
			   AND cs_target.academic_period_id = spap.academic_period_id
			JOIN academic.student_section_enrollments sse
				ON sse.enrolled_student_id = es.id
			JOIN academic.course_sections cs_other
				ON cs_other.id = sse.course_section_id
			   AND cs_other.course_id = cs_target.course_id
			   AND cs_other.academic_period_id = cs_target.academic_period_id
			   AND cs_other.id <> cs_target.id
			WHERE st.code = r.student_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentAlreadyEnrolledInCourse'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T010'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	INSERT INTO academic.student_section_enrollments
		(enrolled_student_id, course_section_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT es.id, cs.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.students st ON st.code = trim(e->>'studentCode')
	JOIN academic.enrolled_students es ON es.student_id = st.id
	JOIN academic.study_plan_academic_periods spap_es
		ON spap_es.id = es.study_plan_academic_period_id AND spap_es.academic_period_id = cs.academic_period_id
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap_es.id AND spc.course_id = cs.course_id
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		WHERE sse.enrolled_student_id = es.id AND sse.course_section_id = cs.id
	);

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
		`);
	}
}
