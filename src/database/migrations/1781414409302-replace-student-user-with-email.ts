import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceStudentUserWithEmail1781414409302 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD COLUMN "email" character varying(254) NOT NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD CONSTRAINT "UQ_students_email" UNIQUE ("email")`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" DROP CONSTRAINT "FK_students_user_id"`,
		);
		await queryRunner.query(`ALTER TABLE "academic"."students" DROP COLUMN "user_id"`);

		// The enrollment email is no longer taken from the file; it is derived from the student code
		// as 'U' || code || '@upc.edu.pe', so there is no longer a user lookup or userNotFound check.
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_enrolled_students(
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

	-- intra-file duplicate student code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'studentCode')) IN (
			SELECT lower(trim(d->>'studentCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'studentCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                      AS row_number,
			NULLIF(trim(e->>'studentCode'), '')         AS student_code,
			NULLIF(trim(e->>'lastName'), '')            AS last_name,
			NULLIF(trim(e->>'firstName'), '')           AS first_name,
			NULLIF(trim(e->>'programCode'), '')         AS program_code,
			NULLIF(trim(e->>'campusCode'), '')          AS campus_code,
			-- the file carries a single-letter enrollment modality (P/S/V); map it to its TG103 type code.
			CASE upper(NULLIF(trim(e->>'enrollmentModalityTypeCode'), ''))
				WHEN 'P' THEN 'TG103-T001'
				WHEN 'S' THEN 'TG103-T003'
				WHEN 'V' THEN 'TG103-T002'
			END                                         AS modality_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.student_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeTooLong'::text, NULL::integer;
		END IF;

		IF r.last_name IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'lastNameEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.last_name) > 255 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'lastNameTooLong'::text, NULL::integer;
		END IF;

		IF r.first_name IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'firstNameEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.first_name) > 255 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'firstNameTooLong'::text, NULL::integer;
		END IF;

		-- the program must exist and own a study plan offered in this academic period (the enrollment links to it)
		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_academic_periods spap
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.programs p ON p.id = sp.program_id
			WHERE p.code = r.program_code AND spap.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanPeriodNotFound'::text, NULL::integer;
		END IF;

		IF r.campus_code IS NULL OR NOT EXISTS (SELECT 1 FROM organization.campuses cam WHERE cam.code = r.campus_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'campusNotFound'::text, NULL::integer;
		END IF;

		IF r.modality_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'enrollmentModalityInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T006'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert students whose code does not exist yet (graduation modality = the enrollment modality per spec;
	-- the email is derived from the student code: 'U' || code || '@upc.edu.pe')
	INSERT INTO academic.students
		(code, email, program_id, graduation_modality_type_id, first_name, last_name, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		trim(e->>'studentCode'),
		'U' || trim(e->>'studentCode') || '@upc.edu.pe',
		p.id, tm.id, trim(e->>'firstName'), trim(e->>'lastName'),
		v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = CASE upper(trim(e->>'enrollmentModalityTypeCode'))
		WHEN 'P' THEN 'TG103-T001'
		WHEN 'S' THEN 'TG103-T003'
		WHEN 'V' THEN 'TG103-T002'
	END
	WHERE NOT EXISTS (SELECT 1 FROM academic.students s WHERE s.code = trim(e->>'studentCode'));

	-- update students whose code already existed (push prior values onto the extra.upload_undo stack)
	UPDATE academic.students s
	SET email = 'U' || trim(e->>'studentCode') || '@upc.edu.pe',
		program_id = p.id,
		graduation_modality_type_id = tm.id,
		first_name = trim(e->>'firstName'),
		last_name = trim(e->>'lastName'),
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(s.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(s.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'email', s.email, 'program_id', s.program_id,
				'graduation_modality_type_id', s.graduation_modality_type_id,
				'first_name', s.first_name, 'last_name', s.last_name))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = CASE upper(trim(e->>'enrollmentModalityTypeCode'))
		WHEN 'P' THEN 'TG103-T001'
		WHEN 'S' THEN 'TG103-T003'
		WHEN 'V' THEN 'TG103-T002'
	END
	WHERE s.code = trim(e->>'studentCode')
	  AND s.upload_log_id IS DISTINCT FROM v_log_id;

	-- The study plan is derived from the program for this period; a scalar subquery picks one
	-- study_plan_academic_period so a program with several plans cannot multiply the enrollment rows.
	-- insert enrollments that do not exist yet (uniqueness = student + study_plan_academic_period)
	INSERT INTO academic.enrolled_students
		(student_id, study_plan_academic_period, campus_id, enrollement_modality_type_id, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT x.student_id, x.spap_id, x.campus_id, x.modality_id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM (
		SELECT
			s.id AS student_id,
			cam.id AS campus_id,
			tm.id AS modality_id,
			(SELECT spap.id FROM academic.study_plan_academic_periods spap
			 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			 WHERE sp.program_id = p.id AND spap.academic_period_id = p_academic_period_id
			 ORDER BY spap.id LIMIT 1) AS spap_id
		FROM jsonb_array_elements(p_rows) AS e
		JOIN academic.students s ON s.code = trim(e->>'studentCode')
		JOIN academic.programs p ON p.code = trim(e->>'programCode')
		JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
		JOIN core.type_groups g ON g.code = 'TG103'
		JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = CASE upper(trim(e->>'enrollmentModalityTypeCode'))
			WHEN 'P' THEN 'TG103-T001'
			WHEN 'S' THEN 'TG103-T003'
			WHEN 'V' THEN 'TG103-T002'
		END
	) x
	WHERE x.spap_id IS NOT NULL
	  AND NOT EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.student_id = x.student_id AND es.study_plan_academic_period = x.spap_id
	);

	-- update enrollments that already existed (push prior values onto the extra.upload_undo stack)
	UPDATE academic.enrolled_students es
	SET campus_id = x.campus_id,
		enrollement_modality_type_id = x.modality_id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(es.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(es.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'campus_id', es.campus_id,
				'enrollement_modality_type_id', es.enrollement_modality_type_id))
	FROM (
		SELECT
			s.id AS student_id,
			cam.id AS campus_id,
			tm.id AS modality_id,
			(SELECT spap.id FROM academic.study_plan_academic_periods spap
			 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			 WHERE sp.program_id = p.id AND spap.academic_period_id = p_academic_period_id
			 ORDER BY spap.id LIMIT 1) AS spap_id
		FROM jsonb_array_elements(p_rows) AS e
		JOIN academic.students s ON s.code = trim(e->>'studentCode')
		JOIN academic.programs p ON p.code = trim(e->>'programCode')
		JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
		JOIN core.type_groups g ON g.code = 'TG103'
		JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = CASE upper(trim(e->>'enrollmentModalityTypeCode'))
			WHEN 'P' THEN 'TG103-T001'
			WHEN 'S' THEN 'TG103-T003'
			WHEN 'V' THEN 'TG103-T002'
		END
	) x
	WHERE es.student_id = x.student_id
	  AND es.study_plan_academic_period = x.spap_id
	  AND es.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		// rollback now restores the prior email instead of user_id when popping the undo stack.
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_enrolled_students(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if an enrollment / student created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
		WHERE es.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.surveys sv
		JOIN academic.students s ON s.id = sv.student_id
		WHERE s.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedEnrollmentRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed,
	-- and no newer upload may have hung an enrollment off a student this one inserted.
	IF EXISTS (
		SELECT 1 FROM academic.students s
		WHERE (s.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (s.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.students s
		WHERE s.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(s.extra->'upload_undo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE (es.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (es.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(es.extra->'upload_undo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.upload_log_id IS DISTINCT FROM p_upload_log_id
		  AND es.student_id IN (SELECT id FROM academic.students WHERE upload_log_id = p_upload_log_id)
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated enrollments (pop), then drop inserted enrollments
	UPDATE academic.enrolled_students es
	SET campus_id = (es.extra->'upload_undo' -> -1 ->> 'campus_id')::int,
		enrollement_modality_type_id = (es.extra->'upload_undo' -> -1 ->> 'enrollement_modality_type_id')::int,
		extra = CASE
			WHEN jsonb_array_length(es.extra->'upload_undo') <= 1 THEN es.extra - 'upload_undo'
			ELSE jsonb_set(es.extra, '{upload_undo}', (es.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (es.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.enrolled_students WHERE upload_log_id = p_upload_log_id;

	-- restore updated students (pop), then drop inserted students
	UPDATE academic.students s
	SET email = s.extra->'upload_undo' -> -1 ->> 'email',
		program_id = (s.extra->'upload_undo' -> -1 ->> 'program_id')::int,
		graduation_modality_type_id = (s.extra->'upload_undo' -> -1 ->> 'graduation_modality_type_id')::int,
		first_name = s.extra->'upload_undo' -> -1 ->> 'first_name',
		last_name = s.extra->'upload_undo' -> -1 ->> 'last_name',
		extra = CASE
			WHEN jsonb_array_length(s.extra->'upload_undo') <= 1 THEN s.extra - 'upload_undo'
			ELSE jsonb_set(s.extra, '{upload_undo}', (s.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (s.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.students WHERE upload_log_id = p_upload_log_id;

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
		await queryRunner.query(`ALTER TABLE "academic"."students" ADD COLUMN "user_id" integer`);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" ADD CONSTRAINT "FK_students_user_id" FOREIGN KEY ("user_id") REFERENCES "organization"."users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."students" DROP CONSTRAINT "UQ_students_email"`,
		);
		await queryRunner.query(`ALTER TABLE "academic"."students" DROP COLUMN "email"`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_enrolled_students(
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

	-- intra-file duplicate student code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'studentCode')) IN (
			SELECT lower(trim(d->>'studentCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'studentCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                      AS row_number,
			NULLIF(trim(e->>'studentCode'), '')         AS student_code,
			NULLIF(trim(e->>'lastName'), '')            AS last_name,
			NULLIF(trim(e->>'firstName'), '')           AS first_name,
			NULLIF(trim(e->>'email'), '')               AS email,
			NULLIF(trim(e->>'programCode'), '')         AS program_code,
			NULLIF(trim(e->>'campusCode'), '')          AS campus_code,
			-- the file carries a single-letter enrollment modality (P/S/V); map it to its TG103 type code.
			CASE upper(NULLIF(trim(e->>'enrollmentModalityTypeCode'), ''))
				WHEN 'P' THEN 'TG103-T001'
				WHEN 'S' THEN 'TG103-T003'
				WHEN 'V' THEN 'TG103-T002'
			END                                         AS modality_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.student_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeTooLong'::text, NULL::integer;
		END IF;

		IF r.last_name IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'lastNameEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.last_name) > 255 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'lastNameTooLong'::text, NULL::integer;
		END IF;

		IF r.first_name IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'firstNameEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.first_name) > 255 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'firstNameTooLong'::text, NULL::integer;
		END IF;

		-- email is optional; only when present must it resolve to a user.
		IF r.email IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM organization.users u WHERE lower(u.email) = lower(r.email)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'userNotFound'::text, NULL::integer;
		END IF;

		-- the program must exist and own a study plan offered in this academic period (the enrollment links to it)
		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_academic_periods spap
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.programs p ON p.id = sp.program_id
			WHERE p.code = r.program_code AND spap.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanPeriodNotFound'::text, NULL::integer;
		END IF;

		IF r.campus_code IS NULL OR NOT EXISTS (SELECT 1 FROM organization.campuses cam WHERE cam.code = r.campus_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'campusNotFound'::text, NULL::integer;
		END IF;

		IF r.modality_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'enrollmentModalityInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T006'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert students whose code does not exist yet (graduation modality = the enrollment modality per spec;
	-- email is optional, so the user is matched by LEFT JOIN and left NULL when absent)
	INSERT INTO academic.students
		(code, user_id, program_id, graduation_modality_type_id, first_name, last_name, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		trim(e->>'studentCode'), u.id, p.id, tm.id, trim(e->>'firstName'), trim(e->>'lastName'),
		v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = CASE upper(trim(e->>'enrollmentModalityTypeCode'))
		WHEN 'P' THEN 'TG103-T001'
		WHEN 'S' THEN 'TG103-T003'
		WHEN 'V' THEN 'TG103-T002'
	END
	LEFT JOIN organization.users u
		ON u.id = (SELECT uu.id FROM organization.users uu WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY uu.id LIMIT 1)
	WHERE NOT EXISTS (SELECT 1 FROM academic.students s WHERE s.code = trim(e->>'studentCode'));

	-- update students whose code already existed (push prior values onto the extra.upload_undo stack)
	UPDATE academic.students s
	SET user_id = u.id,
		program_id = p.id,
		graduation_modality_type_id = tm.id,
		first_name = trim(e->>'firstName'),
		last_name = trim(e->>'lastName'),
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(s.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(s.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'user_id', s.user_id, 'program_id', s.program_id,
				'graduation_modality_type_id', s.graduation_modality_type_id,
				'first_name', s.first_name, 'last_name', s.last_name))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = CASE upper(trim(e->>'enrollmentModalityTypeCode'))
		WHEN 'P' THEN 'TG103-T001'
		WHEN 'S' THEN 'TG103-T003'
		WHEN 'V' THEN 'TG103-T002'
	END
	LEFT JOIN organization.users u
		ON u.id = (SELECT uu.id FROM organization.users uu WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY uu.id LIMIT 1)
	WHERE s.code = trim(e->>'studentCode')
	  AND s.upload_log_id IS DISTINCT FROM v_log_id;

	-- The study plan is derived from the program for this period; a scalar subquery picks one
	-- study_plan_academic_period so a program with several plans cannot multiply the enrollment rows.
	-- insert enrollments that do not exist yet (uniqueness = student + study_plan_academic_period)
	INSERT INTO academic.enrolled_students
		(student_id, study_plan_academic_period, campus_id, enrollement_modality_type_id, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT x.student_id, x.spap_id, x.campus_id, x.modality_id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM (
		SELECT
			s.id AS student_id,
			cam.id AS campus_id,
			tm.id AS modality_id,
			(SELECT spap.id FROM academic.study_plan_academic_periods spap
			 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			 WHERE sp.program_id = p.id AND spap.academic_period_id = p_academic_period_id
			 ORDER BY spap.id LIMIT 1) AS spap_id
		FROM jsonb_array_elements(p_rows) AS e
		JOIN academic.students s ON s.code = trim(e->>'studentCode')
		JOIN academic.programs p ON p.code = trim(e->>'programCode')
		JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
		JOIN core.type_groups g ON g.code = 'TG103'
		JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = CASE upper(trim(e->>'enrollmentModalityTypeCode'))
			WHEN 'P' THEN 'TG103-T001'
			WHEN 'S' THEN 'TG103-T003'
			WHEN 'V' THEN 'TG103-T002'
		END
	) x
	WHERE x.spap_id IS NOT NULL
	  AND NOT EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.student_id = x.student_id AND es.study_plan_academic_period = x.spap_id
	);

	-- update enrollments that already existed (push prior values onto the extra.upload_undo stack)
	UPDATE academic.enrolled_students es
	SET campus_id = x.campus_id,
		enrollement_modality_type_id = x.modality_id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(es.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(es.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'campus_id', es.campus_id,
				'enrollement_modality_type_id', es.enrollement_modality_type_id))
	FROM (
		SELECT
			s.id AS student_id,
			cam.id AS campus_id,
			tm.id AS modality_id,
			(SELECT spap.id FROM academic.study_plan_academic_periods spap
			 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			 WHERE sp.program_id = p.id AND spap.academic_period_id = p_academic_period_id
			 ORDER BY spap.id LIMIT 1) AS spap_id
		FROM jsonb_array_elements(p_rows) AS e
		JOIN academic.students s ON s.code = trim(e->>'studentCode')
		JOIN academic.programs p ON p.code = trim(e->>'programCode')
		JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
		JOIN core.type_groups g ON g.code = 'TG103'
		JOIN core.types tm ON tm.type_group_id = g.id AND tm.code = CASE upper(trim(e->>'enrollmentModalityTypeCode'))
			WHEN 'P' THEN 'TG103-T001'
			WHEN 'S' THEN 'TG103-T003'
			WHEN 'V' THEN 'TG103-T002'
		END
	) x
	WHERE es.student_id = x.student_id
	  AND es.study_plan_academic_period = x.spap_id
	  AND es.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_enrolled_students(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if an enrollment / student created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
		WHERE es.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.surveys sv
		JOIN academic.students s ON s.id = sv.student_id
		WHERE s.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedEnrollmentRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed,
	-- and no newer upload may have hung an enrollment off a student this one inserted.
	IF EXISTS (
		SELECT 1 FROM academic.students s
		WHERE (s.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (s.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.students s
		WHERE s.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(s.extra->'upload_undo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE (es.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (es.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(es.extra->'upload_undo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.upload_log_id IS DISTINCT FROM p_upload_log_id
		  AND es.student_id IN (SELECT id FROM academic.students WHERE upload_log_id = p_upload_log_id)
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated enrollments (pop), then drop inserted enrollments
	UPDATE academic.enrolled_students es
	SET campus_id = (es.extra->'upload_undo' -> -1 ->> 'campus_id')::int,
		enrollement_modality_type_id = (es.extra->'upload_undo' -> -1 ->> 'enrollement_modality_type_id')::int,
		extra = CASE
			WHEN jsonb_array_length(es.extra->'upload_undo') <= 1 THEN es.extra - 'upload_undo'
			ELSE jsonb_set(es.extra, '{upload_undo}', (es.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (es.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.enrolled_students WHERE upload_log_id = p_upload_log_id;

	-- restore updated students (pop), then drop inserted students
	UPDATE academic.students s
	SET user_id = (s.extra->'upload_undo' -> -1 ->> 'user_id')::int,
		program_id = (s.extra->'upload_undo' -> -1 ->> 'program_id')::int,
		graduation_modality_type_id = (s.extra->'upload_undo' -> -1 ->> 'graduation_modality_type_id')::int,
		first_name = s.extra->'upload_undo' -> -1 ->> 'first_name',
		last_name = s.extra->'upload_undo' -> -1 ->> 'last_name',
		extra = CASE
			WHEN jsonb_array_length(s.extra->'upload_undo') <= 1 THEN s.extra - 'upload_undo'
			ELSE jsonb_set(s.extra, '{upload_undo}', (s.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (s.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.students WHERE upload_log_id = p_upload_log_id;

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
