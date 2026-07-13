import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes the "DISTINCT is not implemented for window functions" error raised when uploading
 * Student Sections. `audit.fn_upload_student_sections` (from 1783575251494) computed the
 * intra-file "same student enrolled in >1 different section of the same course/period" check
 * with `count(DISTINCT cs.id) OVER (PARTITION BY ...)`. PostgreSQL does not support DISTINCT
 * inside a window aggregate, so the whole function raised at runtime.
 *
 * The check is rewritten to compute the distinct-section count with a plain GROUP BY aggregate
 * in a CTE (which DOES support DISTINCT) and join it back to flag every offending row. The
 * semantics are unchanged; the rest of the function is identical to 1783575251494.
 */
export class FixStudentSectionsIntrafileCourseCheckWindowDistinct1784006633470 implements MigrationInterface {
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
DECLARE
	v_total integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

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

	-- intra-file: same student in >1 DIFFERENT section of the same course/period within the file.
	-- Distinct-section count is computed with a GROUP BY aggregate (not a window function, which
	-- cannot take DISTINCT) and joined back to flag every row of an offending partition.
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

	-- per-row validation
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

		-- the student must be enrolled in the SAME study_plan_academic_period as the section
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

		-- the section's course must belong to the student's study plan
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

		-- the student may already be enrolled in a DIFFERENT section of the same course/period (in the DB)
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
		// Restore the previous (buggy) definition with count(DISTINCT ...) OVER (...).
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
	-- The academic period is validated in the service (request-level HTTP error), not here.

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

	-- intra-file: same student in >1 DIFFERENT section of the same course/period within the file
	FOR r IN
		SELECT rn FROM (
			SELECT
				(e->>'rowNumber')::int AS rn,
				count(DISTINCT cs.id) OVER (
					PARTITION BY es.id, cs.course_id, cs.academic_period_id
				) AS distinct_sections
			FROM jsonb_array_elements(p_rows) AS e
			JOIN academic.students st ON st.code = trim(e->>'studentCode')
			JOIN academic.enrolled_students es ON es.student_id = st.id
			JOIN academic.study_plan_academic_periods spap ON spap.id = es.study_plan_academic_period_id
			JOIN academic.course_sections cs
				ON cs.section_code = trim(e->>'sectionCode')
			   AND cs.academic_period_id = spap.academic_period_id
			WHERE NULLIF(trim(e->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
		) q
		WHERE q.distinct_sections > 1
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'studentAlreadyEnrolledInCourse'::text, NULL::integer;
	END LOOP;

	-- per-row validation
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
