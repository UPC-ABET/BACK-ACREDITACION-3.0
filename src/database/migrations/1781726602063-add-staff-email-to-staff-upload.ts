import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Re-introduce a contact email to the staff/professor bulk upload.
 *
 * The upload row now carries an optional email that is stamped onto organization.staff.staff_email.
 * Staff identity is still keyed on the professor code (a row whose code already exists updates that
 * professor's staff in place; everyone else inserts a fresh, user-less staff). The email is optional:
 * a blank value leaves staff_email untouched on update / NULL on insert, and only its length is
 * validated (varchar(255), surfaced per-row as emailTooLong).
 *
 * Rollback support: an in-place update records the staff's prior staff_email on the upload_undo
 * stack, and fn_rollback_staff restores it when the upload is undone. Inserted staff are deleted on
 * rollback, so they carry no email-specific undo state.
 *
 * Forward-only in production: down() restores the prior bodies (staff upload with no email column,
 * undo stack without staff_email).
 */
export class AddStaffEmailToStaffUpload1781726602063 implements MigrationInterface {
	name = 'AddStaffEmailToStaffUpload1781726602063';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_staff(
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
	v_staff_id integer;
	v_prof_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate professor code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
		  AND lower(trim(e->>'professorCode')) IN (
			SELECT lower(trim(d->>'professorCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'professorCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'professorCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateProfessorCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                  AS row_number,
			NULLIF(trim(e->>'professorCode'), '')   AS professor_code,
			NULLIF(trim(e->>'lastName'), '')        AS last_name,
			NULLIF(trim(e->>'firstName'), '')       AS first_name,
			NULLIF(trim(e->>'email'), '')           AS email
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
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

		IF char_length(r.professor_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorCodeTooLong'::text, NULL::integer;
		END IF;

		IF char_length(r.email) > 255 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailTooLong'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T001'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- Without an email key, staff identity is carried by the professor code: a row whose professor
	-- code already exists updates that professor's staff in place; everyone else inserts a fresh
	-- (user-less) staff. Rows without a professor code always insert a new staff. The optional email
	-- is stamped onto staff_email; a blank email leaves the prior value untouched on update.
	FOR r IN
		SELECT
			NULLIF(trim(e->>'professorCode'), '') AS professor_code,
			trim(e->>'lastName')                  AS last_name,
			trim(e->>'firstName')                 AS first_name,
			NULLIF(trim(e->>'email'), '')         AS email
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		v_staff_id := NULL;
		v_prof_id := NULL;

		IF r.professor_code IS NOT NULL THEN
			SELECT p.id, p.staff_id INTO v_prof_id, v_staff_id
			FROM academic.professors p
			WHERE p.code = r.professor_code
			LIMIT 1;
		END IF;

		IF v_staff_id IS NULL THEN
			INSERT INTO organization.staff
				(user_id, first_name, last_name, staff_email, upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (NULL, r.first_name, r.last_name, r.email, v_log_id, '{}'::jsonb, true, NOW(), NOW())
			RETURNING id INTO v_staff_id;
		ELSE
			UPDATE organization.staff s
			SET first_name = r.first_name,
				last_name = r.last_name,
				staff_email = COALESCE(r.email, s.staff_email),
				updated_at = NOW(),
				extra = jsonb_set(COALESCE(s.extra, '{}'::jsonb), '{upload_undo}',
					COALESCE(s.extra->'upload_undo', '[]'::jsonb) ||
					jsonb_build_object('log_id', v_log_id, 'first_name', s.first_name, 'last_name', s.last_name, 'staff_email', s.staff_email))
			WHERE s.id = v_staff_id;
		END IF;

		IF r.professor_code IS NOT NULL AND v_prof_id IS NULL THEN
			INSERT INTO academic.professors
				(staff_id, code, upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (v_staff_id, r.professor_code, v_log_id, '{}'::jsonb, true, NOW(), NOW());
		END IF;
	END LOOP;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_staff(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if a professor created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.course_sections cs
		JOIN academic.professors p ON p.id = cs.professor_id
		WHERE p.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evaluation.project_evaluators pe
		JOIN academic.professors p ON p.id = pe.professor_id
		WHERE p.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedProfessors';
	END IF;

	-- block if a staff created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM organization.charts c
		JOIN organization.staff s ON s.id = c.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM improvement.findings f
		JOIN organization.staff s ON s.id = f.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM ifc.statuses st
		JOIN organization.staff s ON s.id = st.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedStaff';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	-- Blocked when this upload's id is in a row's upload_undo stack but is NOT the top element (a later
	-- upload updated it since), or when this upload INSERTED a row that a later upload has since updated
	-- (the inserted row carries a non-empty stack). Roll back the newer upload first.
	IF EXISTS (
		SELECT 1 FROM organization.staff s
		WHERE (s.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (s.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM organization.staff s
		WHERE s.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(s.extra->'upload_undo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.professors p
		WHERE (p.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (p.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.professors p
		WHERE p.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(p.extra->'upload_undo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore re-pointed professors by popping this upload's (top) upload_undo entry, then drop inserts
	UPDATE academic.professors p
	SET staff_id = (p.extra->'upload_undo' -> -1 ->> 'staff_id')::int,
		extra = CASE
			WHEN jsonb_array_length(p.extra->'upload_undo') <= 1 THEN p.extra - 'upload_undo'
			ELSE jsonb_set(p.extra, '{upload_undo}', (p.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (p.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.professors WHERE upload_log_id = p_upload_log_id;

	-- restore updated staff by popping this upload's (top) upload_undo entry, then drop inserts.
	-- staff_email is only restored when the undo entry actually recorded it: older entries (from
	-- uploads that predate the email column) never touched staff_email, so we leave it as-is for them.
	UPDATE organization.staff s
	SET first_name = s.extra->'upload_undo' -> -1 ->> 'first_name',
		last_name = s.extra->'upload_undo' -> -1 ->> 'last_name',
		staff_email = CASE
			WHEN (s.extra->'upload_undo' -> -1) ? 'staff_email'
				THEN s.extra->'upload_undo' -> -1 ->> 'staff_email'
			ELSE s.staff_email
		END,
		extra = CASE
			WHEN jsonb_array_length(s.extra->'upload_undo') <= 1 THEN s.extra - 'upload_undo'
			ELSE jsonb_set(s.extra, '{upload_undo}', (s.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (s.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM organization.staff WHERE upload_log_id = p_upload_log_id;

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
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_staff(
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
	v_staff_id integer;
	v_prof_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate professor code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
		  AND lower(trim(e->>'professorCode')) IN (
			SELECT lower(trim(d->>'professorCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'professorCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'professorCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateProfessorCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                  AS row_number,
			NULLIF(trim(e->>'professorCode'), '')   AS professor_code,
			NULLIF(trim(e->>'lastName'), '')        AS last_name,
			NULLIF(trim(e->>'firstName'), '')       AS first_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
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

		IF char_length(r.professor_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorCodeTooLong'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T001'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- Without an email key, staff identity is carried by the professor code: a row whose professor
	-- code already exists updates that professor's staff in place; everyone else inserts a fresh
	-- (user-less) staff. Rows without a professor code always insert a new staff.
	FOR r IN
		SELECT
			NULLIF(trim(e->>'professorCode'), '') AS professor_code,
			trim(e->>'lastName')                  AS last_name,
			trim(e->>'firstName')                 AS first_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		v_staff_id := NULL;
		v_prof_id := NULL;

		IF r.professor_code IS NOT NULL THEN
			SELECT p.id, p.staff_id INTO v_prof_id, v_staff_id
			FROM academic.professors p
			WHERE p.code = r.professor_code
			LIMIT 1;
		END IF;

		IF v_staff_id IS NULL THEN
			INSERT INTO organization.staff
				(user_id, first_name, last_name, upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (NULL, r.first_name, r.last_name, v_log_id, '{}'::jsonb, true, NOW(), NOW())
			RETURNING id INTO v_staff_id;
		ELSE
			UPDATE organization.staff s
			SET first_name = r.first_name,
				last_name = r.last_name,
				updated_at = NOW(),
				extra = jsonb_set(COALESCE(s.extra, '{}'::jsonb), '{upload_undo}',
					COALESCE(s.extra->'upload_undo', '[]'::jsonb) ||
					jsonb_build_object('log_id', v_log_id, 'first_name', s.first_name, 'last_name', s.last_name))
			WHERE s.id = v_staff_id;
		END IF;

		IF r.professor_code IS NOT NULL AND v_prof_id IS NULL THEN
			INSERT INTO academic.professors
				(staff_id, code, upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (v_staff_id, r.professor_code, v_log_id, '{}'::jsonb, true, NOW(), NOW());
		END IF;
	END LOOP;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_staff(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if a professor created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.course_sections cs
		JOIN academic.professors p ON p.id = cs.professor_id
		WHERE p.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evaluation.project_evaluators pe
		JOIN academic.professors p ON p.id = pe.professor_id
		WHERE p.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedProfessors';
	END IF;

	-- block if a staff created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM organization.charts c
		JOIN organization.staff s ON s.id = c.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM improvement.findings f
		JOIN organization.staff s ON s.id = f.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM ifc.statuses st
		JOIN organization.staff s ON s.id = st.staff_id
		WHERE s.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedStaff';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	-- Blocked when this upload's id is in a row's upload_undo stack but is NOT the top element (a later
	-- upload updated it since), or when this upload INSERTED a row that a later upload has since updated
	-- (the inserted row carries a non-empty stack). Roll back the newer upload first.
	IF EXISTS (
		SELECT 1 FROM organization.staff s
		WHERE (s.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (s.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM organization.staff s
		WHERE s.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(s.extra->'upload_undo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.professors p
		WHERE (p.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (p.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.professors p
		WHERE p.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(p.extra->'upload_undo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore re-pointed professors by popping this upload's (top) upload_undo entry, then drop inserts
	UPDATE academic.professors p
	SET staff_id = (p.extra->'upload_undo' -> -1 ->> 'staff_id')::int,
		extra = CASE
			WHEN jsonb_array_length(p.extra->'upload_undo') <= 1 THEN p.extra - 'upload_undo'
			ELSE jsonb_set(p.extra, '{upload_undo}', (p.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (p.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.professors WHERE upload_log_id = p_upload_log_id;

	-- restore updated staff by popping this upload's (top) upload_undo entry, then drop inserts
	UPDATE organization.staff s
	SET first_name = s.extra->'upload_undo' -> -1 ->> 'first_name',
		last_name = s.extra->'upload_undo' -> -1 ->> 'last_name',
		extra = CASE
			WHEN jsonb_array_length(s.extra->'upload_undo') <= 1 THEN s.extra - 'upload_undo'
			ELSE jsonb_set(s.extra, '{upload_undo}', (s.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (s.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM organization.staff WHERE upload_log_id = p_upload_log_id;

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
