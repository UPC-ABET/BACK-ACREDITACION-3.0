import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a validation to the RC grades upload (audit.fn_upload_grades_rc): the grade type of every
 * row must be the one designated for the section's course in
 * `academic.study_plan_courses.extra.grade_type_id`, resolved through the study plan offered in the
 * section's own academic period.
 *
 * The RC report used to enforce this itself, by keeping only the `student_course_grades` row whose
 * grade type matched the designated one: a grade of any other type loaded fine and then vanished
 * from the report with nothing said. That filter is being removed from `SEMAPHORE_RC_*_SQL` in the
 * same change, so this check is now the ONLY place the rule is enforced -- the report trusts it and
 * reads whatever grade the enrollment has.
 *
 * Two new error codes, both reported only for rows whose section exists and whose grade type is a
 * valid TG205 code (those two defects are already reported by the checks above, and repeating them
 * as a third message would only describe the same problem twice):
 *
 *  - `courseGradeTypeNotDesignated` — the section's course has no designated grade type at all for
 *    the period (no study plan course row, or `extra.grade_type_id` missing / not a positive
 *    integer). Nothing this course is graded with can reach the RC report until it is configured.
 *  - `gradeTypeNotDesignated` — the course has a designated grade type and this row carries a
 *    different one.
 *
 * Everything else in the function is unchanged. down() restores the prior body (the one installed
 * by 1783366935441-consolidate-rc-rv-evaluation-feature), which has no such check.
 */
export class EnforceDesignatedGradeTypeInGradesRcUpload1786836461483 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_grades_rc(
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

	-- intra-file duplicate (section, student, grade type)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode')), lower(trim(e->>'gradeTypeCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'gradeTypeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'gradeTypeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'gradeTypeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                       AS row_number,
			NULLIF(trim(e->>'sectionCode'), '')          AS section_code,
			NULLIF(trim(e->>'studentCode'), '')          AS student_code,
			NULLIF(trim(e->>'gradeTypeCode'), '')        AS grade_type_code,
			NULLIF(trim(e->>'gradeTypePercentage'), '')  AS grade_type_percentage,
			NULLIF(trim(e->>'grade'), '')                AS grade,
			NULLIF(trim(e->>'qualificationStatusCode'), '') AS qualification_status_code
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

		-- the student must be enrolled in that section (student_section_enrollment exists)
		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.student_section_enrollments sse
			JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			JOIN academic.students st ON st.id = es.student_id
			WHERE cs.section_code = r.section_code AND st.code = r.student_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'enrollmentNotFound'::text, NULL::integer;
		END IF;

		IF r.grade_type_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG205' AND t.code = r.grade_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeInvalid'::text, NULL::integer;
		END IF;

		IF r.grade_type_percentage IS NULL OR r.grade_type_percentage !~ '^[0-9]+(\\.[0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypePercentageInvalid'::text, NULL::integer;
		END IF;

		IF r.grade IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeEmpty'::text, NULL::integer;
		ELSIF r.grade !~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeInvalid'::text, NULL::integer;
		END IF;

		-- qualification status code/text is required; it no longer has to already exist in TG404 --
		-- unrecognized values (by code or by name) are auto-provisioned below, before the insert.
		IF r.qualification_status_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'qualificationStatusEmpty'::text, NULL::integer;
		END IF;
	END LOOP;

	-- The uploaded grade must be the RC grade of the course: the type designated for it in
	-- study_plan_courses.extra.grade_type_id, looked up through study_plan_courses ->
	-- study_plan_academic_periods and resolved by the SECTION's own academic period. The RC report
	-- used to apply this same join as a filter and silently drop everything else; it no longer does,
	-- so this is the only thing standing between a wrongly typed grade and a report that counts it.
	--
	-- Set-based rather than a per-row lookup inside the loop above: this is a three-table join and
	-- an RC file holds a whole period of grades.
	FOR r IN
		WITH file_rows AS (
			SELECT
				(e->>'rowNumber')::int                AS rn,
				NULLIF(trim(e->>'sectionCode'), '')   AS section_code,
				NULLIF(trim(e->>'gradeTypeCode'), '') AS grade_type_code
			FROM jsonb_array_elements(p_rows) AS e
		),
		-- Only rows that resolve on both ends: an unknown section or an unknown grade type is
		-- already reported above, and this check has nothing to add to either.
		resolved_rows AS (
			SELECT fr.rn, cs.id AS course_section_id, t.id AS grade_type_id
			FROM file_rows fr
			JOIN academic.course_sections cs ON cs.section_code = fr.section_code
			JOIN core.type_groups g ON g.code = 'TG205'
			JOIN core.types t ON t.type_group_id = g.id AND t.code = fr.grade_type_code
		),
		-- One row per section: a course can be designated by several study plans of the same period,
		-- and any of their types is a legitimate RC grade for it.
		--
		-- The ::int cast is guarded twice (WHERE and CASE) on purpose: extra.grade_type_id has been
		-- set by hand in SQL until now, so it may hold a type code ('TG205-T002') or an empty string,
		-- and one such row would otherwise abort the whole upload with a cast error instead of
		-- rejecting the file with a message.
		designated_types AS (
			SELECT
				cs.id AS course_section_id,
				array_agg(DISTINCT CASE
					WHEN spc.extra->>'grade_type_id' ~ '^[0-9]+$'
					THEN (spc.extra->>'grade_type_id')::int
				END) AS grade_type_ids
			FROM academic.course_sections cs
			JOIN (SELECT DISTINCT section_code FROM file_rows WHERE section_code IS NOT NULL) f
				ON f.section_code = cs.section_code
			JOIN academic.study_plan_courses spc ON spc.course_id = cs.course_id
			JOIN academic.study_plan_academic_periods spap
				ON spap.id = spc.study_plan_academic_period_id
				AND spap.academic_period_id = cs.academic_period_id
			WHERE spc.extra->>'grade_type_id' ~ '^[0-9]+$'
			GROUP BY cs.id
		)
		SELECT
			rr.rn AS rn,
			CASE WHEN dt.course_section_id IS NULL
				THEN 'courseGradeTypeNotDesignated'
				ELSE 'gradeTypeNotDesignated'
			END AS err_code
		FROM resolved_rows rr
		LEFT JOIN designated_types dt ON dt.course_section_id = rr.course_section_id
		WHERE dt.course_section_id IS NULL
		   OR NOT (rr.grade_type_id = ANY(dt.grade_type_ids))
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, r.err_code::text, NULL::integer;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	-- Auto-provision any qualificationStatusCode value (matched by code OR name) that TG404
	-- doesn't have yet. Banner (or the notas-rc scraping export) may hand us either the real code
	-- (TG404-Txxx) or the raw status text (e.g. "PEN") when it isn't in the catalog yet; either
	-- way, resolve or create it here so the insert/update join below always finds a match.
	FOR r IN
		SELECT DISTINCT trim(e->>'qualificationStatusCode') AS raw_code
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'qualificationStatusCode'), '') IS NOT NULL
	LOOP
		IF NOT EXISTS (
			SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG404'
			  AND (t.code = r.raw_code OR UPPER(t.name->>'es') = UPPER(r.raw_code))
		) THEN
			INSERT INTO core.types
				(type_group_id, code, name, description, extra, is_active, created_at, updated_at)
			SELECT
				tg.id,
				'TG404-T' || LPAD((
					COALESCE(MAX(SUBSTRING(t2.code FROM 'T(\\d+)$')::int), 0) + 1
				)::text, 3, '0'),
				jsonb_build_object('es', r.raw_code, 'en', r.raw_code),
				jsonb_build_object('es', r.raw_code, 'en', r.raw_code),
				'{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups tg
			LEFT JOIN core.types t2 ON t2.type_group_id = tg.id
			WHERE tg.code = 'TG404'
			GROUP BY tg.id;
		END IF;
	END LOOP;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T008'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert grades that do not exist yet (uniqueness = enrollment + grade_type)
	INSERT INTO academic.student_course_grades
		(student_section_enrollment_id, grade_type_id, grade_type_percentage, grade, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		sse.id, t.id, (e->>'gradeTypePercentage')::numeric, (e->>'grade')::numeric, v_log_id,
		jsonb_build_object('qualification_status_type_id', qt.id),
		true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	JOIN core.type_groups qg ON qg.code = 'TG404'
	JOIN core.types qt ON qt.type_group_id = qg.id
		AND (qt.code = trim(e->>'qualificationStatusCode')
		     OR UPPER(qt.name->>'es') = UPPER(trim(e->>'qualificationStatusCode')))
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.student_section_enrollment_id = sse.id AND scg.grade_type_id = t.id
	);

	-- update grades that already existed (push prior values onto the extra.upload_undo stack).
	-- extra is rebuilt from the row's own current extra: jsonb_set only replaces the upload_undo
	-- key, and the concatenation on top only replaces qualification_status_type_id -- any other
	-- key already in extra (added by another flow) survives untouched.
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (e->>'gradeTypePercentage')::numeric,
		grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = (
			jsonb_set(COALESCE(scg.extra, '{}'::jsonb), '{upload_undo}',
				COALESCE(scg.extra->'upload_undo', '[]'::jsonb) ||
				jsonb_build_object(
					'log_id', v_log_id,
					'grade_type_percentage', scg.grade_type_percentage,
					'grade', scg.grade,
					'qualification_status_type_id', scg.extra->'qualification_status_type_id'
				))
			|| jsonb_build_object('qualification_status_type_id', qt.id)
		)
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	JOIN core.type_groups qg ON qg.code = 'TG404'
	JOIN core.types qt ON qt.type_group_id = qg.id
		AND (qt.code = trim(e->>'qualificationStatusCode')
		     OR UPPER(qt.name->>'es') = UPPER(trim(e->>'qualificationStatusCode')))
	WHERE scg.student_section_enrollment_id = sse.id
	  AND scg.grade_type_id = t.id
	  AND scg.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_grades_rc(
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

	-- intra-file duplicate (section, student, grade type)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode')), lower(trim(e->>'gradeTypeCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'gradeTypeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'gradeTypeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'gradeTypeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                       AS row_number,
			NULLIF(trim(e->>'sectionCode'), '')          AS section_code,
			NULLIF(trim(e->>'studentCode'), '')          AS student_code,
			NULLIF(trim(e->>'gradeTypeCode'), '')        AS grade_type_code,
			NULLIF(trim(e->>'gradeTypePercentage'), '')  AS grade_type_percentage,
			NULLIF(trim(e->>'grade'), '')                AS grade,
			NULLIF(trim(e->>'qualificationStatusCode'), '') AS qualification_status_code
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

		-- the student must be enrolled in that section (student_section_enrollment exists)
		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.student_section_enrollments sse
			JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			JOIN academic.students st ON st.id = es.student_id
			WHERE cs.section_code = r.section_code AND st.code = r.student_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'enrollmentNotFound'::text, NULL::integer;
		END IF;

		IF r.grade_type_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG205' AND t.code = r.grade_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeInvalid'::text, NULL::integer;
		END IF;

		IF r.grade_type_percentage IS NULL OR r.grade_type_percentage !~ '^[0-9]+(\\.[0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypePercentageInvalid'::text, NULL::integer;
		END IF;

		IF r.grade IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeEmpty'::text, NULL::integer;
		ELSIF r.grade !~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeInvalid'::text, NULL::integer;
		END IF;

		-- qualification status code/text is required; it no longer has to already exist in TG404 --
		-- unrecognized values (by code or by name) are auto-provisioned below, before the insert.
		IF r.qualification_status_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'qualificationStatusEmpty'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	-- Auto-provision any qualificationStatusCode value (matched by code OR name) that TG404
	-- doesn't have yet. Banner (or the notas-rc scraping export) may hand us either the real code
	-- (TG404-Txxx) or the raw status text (e.g. "PEN") when it isn't in the catalog yet; either
	-- way, resolve or create it here so the insert/update join below always finds a match.
	FOR r IN
		SELECT DISTINCT trim(e->>'qualificationStatusCode') AS raw_code
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'qualificationStatusCode'), '') IS NOT NULL
	LOOP
		IF NOT EXISTS (
			SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG404'
			  AND (t.code = r.raw_code OR UPPER(t.name->>'es') = UPPER(r.raw_code))
		) THEN
			INSERT INTO core.types
				(type_group_id, code, name, description, extra, is_active, created_at, updated_at)
			SELECT
				tg.id,
				'TG404-T' || LPAD((
					COALESCE(MAX(SUBSTRING(t2.code FROM 'T(\\d+)$')::int), 0) + 1
				)::text, 3, '0'),
				jsonb_build_object('es', r.raw_code, 'en', r.raw_code),
				jsonb_build_object('es', r.raw_code, 'en', r.raw_code),
				'{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups tg
			LEFT JOIN core.types t2 ON t2.type_group_id = tg.id
			WHERE tg.code = 'TG404'
			GROUP BY tg.id;
		END IF;
	END LOOP;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T008'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert grades that do not exist yet (uniqueness = enrollment + grade_type)
	INSERT INTO academic.student_course_grades
		(student_section_enrollment_id, grade_type_id, grade_type_percentage, grade, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		sse.id, t.id, (e->>'gradeTypePercentage')::numeric, (e->>'grade')::numeric, v_log_id,
		jsonb_build_object('qualification_status_type_id', qt.id),
		true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	JOIN core.type_groups qg ON qg.code = 'TG404'
	JOIN core.types qt ON qt.type_group_id = qg.id
		AND (qt.code = trim(e->>'qualificationStatusCode')
		     OR UPPER(qt.name->>'es') = UPPER(trim(e->>'qualificationStatusCode')))
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.student_section_enrollment_id = sse.id AND scg.grade_type_id = t.id
	);

	-- update grades that already existed (push prior values onto the extra.upload_undo stack).
	-- extra is rebuilt from the row's own current extra: jsonb_set only replaces the upload_undo
	-- key, and the concatenation on top only replaces qualification_status_type_id -- any other
	-- key already in extra (added by another flow) survives untouched.
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (e->>'gradeTypePercentage')::numeric,
		grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = (
			jsonb_set(COALESCE(scg.extra, '{}'::jsonb), '{upload_undo}',
				COALESCE(scg.extra->'upload_undo', '[]'::jsonb) ||
				jsonb_build_object(
					'log_id', v_log_id,
					'grade_type_percentage', scg.grade_type_percentage,
					'grade', scg.grade,
					'qualification_status_type_id', scg.extra->'qualification_status_type_id'
				))
			|| jsonb_build_object('qualification_status_type_id', qt.id)
		)
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	JOIN core.type_groups qg ON qg.code = 'TG404'
	JOIN core.types qt ON qt.type_group_id = qg.id
		AND (qt.code = trim(e->>'qualificationStatusCode')
		     OR UPPER(qt.name->>'es') = UPPER(trim(e->>'qualificationStatusCode')))
	WHERE scg.student_section_enrollment_id = sse.id
	  AND scg.grade_type_id = t.id
	  AND scg.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);
	}
}
