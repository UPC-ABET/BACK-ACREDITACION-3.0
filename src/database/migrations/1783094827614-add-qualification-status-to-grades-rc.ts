import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Adds a required per-row qualification status to the RC bulk grade upload, mirroring the
 * qualification_status_type_id (TG404) that evidence.evaluations already has for academic
 * projects/RV. academic.student_course_grades has no dedicated column for it, so it's stored
 * inside the existing `extra` jsonb as `qualification_status_type_id` instead of adding a column.
 *
 * The write to `extra` is merge-safe: it only ever touches the `upload_undo` key and the
 * `qualification_status_type_id` key, leaving any other key some other flow may have added
 * untouched.
 */
export class AddQualificationStatusToGradesRc1783094827614 implements MigrationInterface {
	name = 'AddQualificationStatusToGradesRc1783094827614';

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

		-- qualification status code is required and must exist in TG404
		IF r.qualification_status_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'qualificationStatusEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG404' AND t.code = r.qualification_status_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'qualificationStatusInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

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
	JOIN core.types qt ON qt.type_group_id = qg.id AND qt.code = trim(e->>'qualificationStatusCode')
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
	JOIN core.types qt ON qt.type_group_id = qg.id AND qt.code = trim(e->>'qualificationStatusCode')
	WHERE scg.student_section_enrollment_id = sse.id
	  AND scg.grade_type_id = t.id
	  AND scg.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rc(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE (scg.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (scg.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(scg.extra->'upload_undo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated grades by popping this upload's (top) upload_undo entry, then drop inserts.
	-- qualification_status_type_id is restored from the popped snapshot (removed if it was unset
	-- before this upload touched the row); every other key in extra is left untouched.
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (scg.extra->'upload_undo' -> -1 ->> 'grade_type_percentage')::numeric,
		grade = (scg.extra->'upload_undo' -> -1 ->> 'grade')::numeric,
		extra = (
			(CASE
				WHEN jsonb_array_length(scg.extra->'upload_undo') <= 1 THEN scg.extra - 'upload_undo'
				ELSE jsonb_set(scg.extra, '{upload_undo}', (scg.extra->'upload_undo') - (-1))
			END) - 'qualification_status_type_id'
			|| CASE
				WHEN (scg.extra->'upload_undo' -> -1 ->> 'qualification_status_type_id') IS NOT NULL
				THEN jsonb_build_object(
					'qualification_status_type_id',
					(scg.extra->'upload_undo' -> -1 ->> 'qualification_status_type_id')::int
				)
				ELSE '{}'::jsonb
			END
		),
		updated_at = NOW()
	WHERE (scg.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.student_course_grades WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restore the previous fn_upload_grades_rc / fn_rollback_grades_rc (from migration
		// 1781188404691), without the qualification status support.
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
			NULLIF(trim(e->>'grade'), '')                AS grade
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
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

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
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.student_section_enrollment_id = sse.id AND scg.grade_type_id = t.id
	);

	-- update grades that already existed (push prior values onto the extra.upload_undo stack)
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (e->>'gradeTypePercentage')::numeric,
		grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(scg.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(scg.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'grade_type_percentage', scg.grade_type_percentage, 'grade', scg.grade))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	WHERE scg.student_section_enrollment_id = sse.id
	  AND scg.grade_type_id = t.id
	  AND scg.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rc(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	IF EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE (scg.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (scg.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(scg.extra->'upload_undo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (scg.extra->'upload_undo' -> -1 ->> 'grade_type_percentage')::numeric,
		grade = (scg.extra->'upload_undo' -> -1 ->> 'grade')::numeric,
		extra = CASE
			WHEN jsonb_array_length(scg.extra->'upload_undo') <= 1 THEN scg.extra - 'upload_undo'
			ELSE jsonb_set(scg.extra, '{upload_undo}', (scg.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (scg.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.student_course_grades WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);
	}
}
