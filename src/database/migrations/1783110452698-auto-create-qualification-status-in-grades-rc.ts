import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Moves qualification-status resolution for the RC bulk grade upload from strict validation to
 * resolve-or-auto-create, matching how the old Banner system worked: Banner can return a raw
 * status text (e.g. "PEN") instead of an internal code for a grade, and the RC upload should
 * transcribe it -- not reject it. Sources feeding this (e.g. the notas-rc scraping export) pass
 * through whatever text Banner gave when it isn't a recognized code yet.
 *
 * fn_upload_grades_rc now:
 *  - Accepts qualificationStatusCode as either an existing core.types.code (TG404-Txxx) or an
 *    existing type's name (case-insensitive) -- no longer rejects unknown text as
 *    'qualificationStatusInvalid'.
 *  - Auto-provisions a new TG404 type (name/description = the raw text as given) the first time
 *    a given status text/code is seen, before the insert/update join resolves it.
 */
export class AutoCreateQualificationStatusInGradesRc1783110452698 implements MigrationInterface {
	name = 'AutoCreateQualificationStatusInGradesRc1783110452698';

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
		// Restore the previous fn_upload_grades_rc (from migration 1783094827614), with strict
		// TG404 code validation and no auto-provisioning.
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
	}
}
