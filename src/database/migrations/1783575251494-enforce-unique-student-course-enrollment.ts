import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Enforce "a student may be enrolled in at most ONE section of a given course for a given
 * academic period":
 *
 * 1. audit.fn_upload_student_sections is recreated with two new validations that return the
 *    'studentAlreadyEnrolledInCourse' error code (per row, before any insert):
 *      - DB-level: the student is already enrolled in a DIFFERENT section of the same course/period.
 *      - intra-file: the file itself enrolls the same student in >1 section of the same course/period.
 *
 * 2. academic.fn_enforce_unique_student_course_period + a BEFORE INSERT/UPDATE trigger guarantee the
 *    invariant at the database level (backstop for direct writes / races). A plain UNIQUE constraint
 *    cannot express this because course/period live on course_sections, not on the enrollment row.
 *    The trigger only fires on new writes, so pre-existing duplicate enrollments are left untouched.
 *
 * The column enrolled_students.study_plan_academic_period_id is the period link used throughout.
 */
export class EnforceUniqueStudentCourseEnrollment1783575251494 implements MigrationInterface {
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

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION academic.fn_enforce_unique_student_course_period()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_course_id integer;
	v_period_id integer;
BEGIN
	SELECT cs.course_id, cs.academic_period_id
	INTO v_course_id, v_period_id
	FROM academic.course_sections cs
	WHERE cs.id = NEW.course_section_id;

	IF EXISTS (
		SELECT 1
		FROM academic.student_section_enrollments sse
		JOIN academic.course_sections cs ON cs.id = sse.course_section_id
		WHERE sse.enrolled_student_id = NEW.enrolled_student_id
		  AND cs.course_id = v_course_id
		  AND cs.academic_period_id = v_period_id
		  AND sse.id <> COALESCE(NEW.id, 0)
	) THEN
		RAISE EXCEPTION 'studentAlreadyEnrolledInCourse: enrolled_student % already has a section of course % in period %',
			NEW.enrolled_student_id, v_course_id, v_period_id
			USING ERRCODE = '23505';
	END IF;

	RETURN NEW;
END;
$fn$;
		`);

		await queryRunner.query(
			`DROP TRIGGER IF EXISTS trg_enforce_unique_student_course_period ON academic.student_section_enrollments`,
		);
		await queryRunner.query(`
CREATE TRIGGER trg_enforce_unique_student_course_period
BEFORE INSERT OR UPDATE OF enrolled_student_id, course_section_id
ON academic.student_section_enrollments
FOR EACH ROW
EXECUTE FUNCTION academic.fn_enforce_unique_student_course_period();
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP TRIGGER IF EXISTS trg_enforce_unique_student_course_period ON academic.student_section_enrollments`,
		);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS academic.fn_enforce_unique_student_course_period()`,
		);

		// Restore the previous fn_upload_student_sections (without the course-uniqueness validations).
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
