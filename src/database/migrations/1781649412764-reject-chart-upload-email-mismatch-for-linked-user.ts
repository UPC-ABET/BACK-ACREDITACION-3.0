import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Adds a per-row guard to audit.fn_upload_charts: when a row's professor code resolves to a staff that
 * is already linked to a user (organization.staff.user_id IS NOT NULL), the row's contact email must
 * match that linked user's email (case-insensitive). A divergent email is rejected with
 * emailMismatchForLinkedUser before any write, so we never re-stamp staff_email from a file we reject
 * and the linked login's email never silently diverges from the chart contact email.
 *
 * The match is against the linked user regardless of the user's active status (any staff.user_id link
 * counts), so a deactivated login still blocks a divergent re-upload.
 *
 * Forward-only in production: down() restores the prior function body (no linked-user email guard).
 */
export class RejectChartUploadEmailMismatchForLinkedUser1781649412764 implements MigrationInterface {
	name = 'RejectChartUploadEmailMismatchForLinkedUser1781649412764';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_charts(
	p_rows jsonb,
	p_academic_period_id integer,
	p_school_id integer,
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
	v_school_chart_id integer;
	r record;
BEGIN
	-- The academic period, the existing school chart node, and the per-(school, period) "already
	-- uploaded" guard are checked in the service (request-level HTTP errors), not here. The file
	-- starts at Program Coordinator; top-level rows are hung under the school's chart node.

	-- intra-file duplicate node code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'code')) IN (
			SELECT lower(trim(d->>'code'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'code'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'code'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- intra-file: the same professor code must not carry different emails
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
		  AND lower(trim(e->>'professorCode')) IN (
			SELECT lower(trim(d->>'professorCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'professorCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'email'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'professorCode'))
			HAVING count(DISTINCT lower(trim(d->>'email'))) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'inconsistentEmailForProfessor'::text, NULL::integer;
	END LOOP;

	-- intra-file: the same email must not carry different professor codes
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'email'), '') IS NOT NULL
		  AND lower(trim(e->>'email')) IN (
			SELECT lower(trim(d->>'email'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'email'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'professorCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'email'))
			HAVING count(DISTINCT lower(trim(d->>'professorCode'))) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'inconsistentProfessorForEmail'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                 AS row_number,
			NULLIF(trim(e->>'code'), '')           AS code,
			NULLIF(trim(e->>'parentCode'), '')     AS parent_code,
			COALESCE(e->'title', '{}'::jsonb)      AS title,
			NULLIF(trim(e->>'professorCode'), '')  AS professor_code,
			NULLIF(trim(e->>'email'), '')          AS email,
			NULLIF(trim(e->>'entityType'), '')     AS entity_type_name,
			NULLIF(trim(e->>'entityCode'), '')     AS entity_code,
			(SELECT t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = 'TG903'
			   AND t.code IN ('TG903-T003', 'TG903-T004', 'TG903-T005', 'TG903-T006')
			   AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
			        OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
			 LIMIT 1)                              AS resolved_entity_code,
			-- email (lowercased) of the user already linked to this professor's staff, if any.
			-- NULL when the professor is unknown or the staff has no user_id link.
			(SELECT lower(u.email)
			 FROM academic.professors pr
			 JOIN organization.staff s ON s.id = pr.staff_id
			 JOIN organization.users u ON u.id = s.user_id
			 WHERE pr.code = NULLIF(trim(e->>'professorCode'), '')
			 LIMIT 1)                              AS linked_user_email
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'codeEmpty'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.title) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'titleEmpty'::text, NULL::integer;
		END IF;

		IF r.professor_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.professors pr WHERE pr.code = r.professor_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorNotFound'::text, NULL::integer;
		END IF;

		IF r.email IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailEmpty'::text, NULL::integer;
		ELSIF char_length(r.email) > 255 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailTooLong'::text, NULL::integer;
		END IF;

		-- when this professor's staff is already linked to a user, the row email must match that
		-- user's email; a divergent email is rejected so the login email never silently drifts.
		IF r.email IS NOT NULL
		   AND r.linked_user_email IS NOT NULL
		   AND r.linked_user_email <> lower(r.email) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailMismatchForLinkedUser'::text, NULL::integer;
		END IF;

		-- Entity tag: blank = generic node. Otherwise it must be an uploadable kind matched by its
		-- localized name (Program/Area/Subarea/Course); School/Dean belong to the prior configuration.
		-- Program/Course anchor to a real entity (entity_code required); Area/Subarea carry none.
		IF r.entity_type_name IS NULL THEN
			IF r.entity_code IS NOT NULL THEN
				v_has_errors := true;
				RETURN QUERY SELECT r.row_number, 'entityCodeWithoutType'::text, NULL::integer;
			END IF;
		ELSIF r.resolved_entity_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'entityTypeInvalid'::text, NULL::integer;
		ELSIF r.resolved_entity_code IN ('TG903-T003', 'TG903-T006') AND NOT (
			(r.resolved_entity_code = 'TG903-T003' AND EXISTS (SELECT 1 FROM academic.programs x WHERE x.code = r.entity_code)) OR
			(r.resolved_entity_code = 'TG903-T006' AND EXISTS (SELECT 1 FROM academic.courses x WHERE x.code = r.entity_code))
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'entityNotFound'::text, NULL::integer;
		END IF;

		IF r.parent_code IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM jsonb_array_elements(p_rows) AS d
			WHERE lower(trim(d->>'code')) = lower(r.parent_code)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'parentNotFound'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T004'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- stamp each responsible's contact email onto their staff (resolved via professor code)
	UPDATE organization.staff s
	SET staff_email = trim(e->>'email'), updated_at = NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	WHERE s.id = pr.staff_id
	  AND NULLIF(trim(e->>'email'), '') IS NOT NULL;

	-- the school's chart node (prior configuration) that the top-level uploaded rows hang under
	v_school_chart_id := (
		SELECT c.id FROM organization.charts c
		JOIN core.types et ON et.id = c.entity_type_id
		WHERE et.code = 'TG903-T002'
		  AND c.entity_code = p_school_id
		  AND c.academic_period_id = p_academic_period_id
		  AND c.is_active = true
		LIMIT 1
	);

	-- pass 1: insert every node (root_chart_id NULL), keep the file code in extra for wiring.
	-- the node's staff is resolved through the professor code: professors.code -> professors.staff_id.
	INSERT INTO organization.charts
		(staff_id, academic_period_id, root_chart_id, title, entity_type_id, entity_code,
		 upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		s.id,
		p_academic_period_id,
		NULL,
		COALESCE(e->'title', '{}'::jsonb),
		et.id,
		CASE
			WHEN et.code = 'TG903-T003' THEN (SELECT id FROM academic.programs WHERE code = trim(e->>'entityCode'))
			WHEN et.code = 'TG903-T006' THEN (SELECT id FROM academic.courses WHERE code = trim(e->>'entityCode'))
			ELSE NULL
		END,
		v_log_id,
		jsonb_build_object('upload_node_code', lower(trim(e->>'code'))),
		true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	JOIN organization.staff s   ON s.id = pr.staff_id
	LEFT JOIN LATERAL (
		SELECT t.id, t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
		WHERE g.code = 'TG903'
		  AND t.code IN ('TG903-T003', 'TG903-T004', 'TG903-T005', 'TG903-T006')
		  AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
		       OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
		LIMIT 1
	) et ON true;

	-- pass 2: wire root_chart_id by matching parentCode -> the node whose code matches (this upload)
	UPDATE organization.charts child
	SET root_chart_id = parent.id, updated_at = NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.charts parent
		ON parent.upload_log_id = v_log_id
	   AND parent.extra->>'upload_node_code' = lower(trim(e->>'parentCode'))
	WHERE child.upload_log_id = v_log_id
	  AND child.extra->>'upload_node_code' = lower(trim(e->>'code'))
	  AND NULLIF(trim(e->>'parentCode'), '') IS NOT NULL;

	-- pass 3: top-level rows (no parent in the file) hang under the school's chart node.
	-- Qualify the columns: unqualified upload_log_id collides with the OUT column of the same name.
	UPDATE organization.charts
	SET root_chart_id = v_school_chart_id, updated_at = NOW()
	WHERE charts.upload_log_id = v_log_id AND charts.root_chart_id IS NULL;

	-- drop the temporary wiring code from extra
	UPDATE organization.charts SET extra = extra - 'upload_node_code' WHERE charts.upload_log_id = v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_charts(
	p_rows jsonb,
	p_academic_period_id integer,
	p_school_id integer,
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
	v_school_chart_id integer;
	r record;
BEGIN
	-- The academic period, the existing school chart node, and the per-(school, period) "already
	-- uploaded" guard are checked in the service (request-level HTTP errors), not here. The file
	-- starts at Program Coordinator; top-level rows are hung under the school's chart node.

	-- intra-file duplicate node code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'code')) IN (
			SELECT lower(trim(d->>'code'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'code'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'code'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- intra-file: the same professor code must not carry different emails
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
		  AND lower(trim(e->>'professorCode')) IN (
			SELECT lower(trim(d->>'professorCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'professorCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'email'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'professorCode'))
			HAVING count(DISTINCT lower(trim(d->>'email'))) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'inconsistentEmailForProfessor'::text, NULL::integer;
	END LOOP;

	-- intra-file: the same email must not carry different professor codes
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'email'), '') IS NOT NULL
		  AND lower(trim(e->>'email')) IN (
			SELECT lower(trim(d->>'email'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'email'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'professorCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'email'))
			HAVING count(DISTINCT lower(trim(d->>'professorCode'))) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'inconsistentProfessorForEmail'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                 AS row_number,
			NULLIF(trim(e->>'code'), '')           AS code,
			NULLIF(trim(e->>'parentCode'), '')     AS parent_code,
			COALESCE(e->'title', '{}'::jsonb)      AS title,
			NULLIF(trim(e->>'professorCode'), '')  AS professor_code,
			NULLIF(trim(e->>'email'), '')          AS email,
			NULLIF(trim(e->>'entityType'), '')     AS entity_type_name,
			NULLIF(trim(e->>'entityCode'), '')     AS entity_code,
			(SELECT t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = 'TG903'
			   AND t.code IN ('TG903-T003', 'TG903-T004', 'TG903-T005', 'TG903-T006')
			   AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
			        OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
			 LIMIT 1)                              AS resolved_entity_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'codeEmpty'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.title) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'titleEmpty'::text, NULL::integer;
		END IF;

		IF r.professor_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.professors pr WHERE pr.code = r.professor_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorNotFound'::text, NULL::integer;
		END IF;

		IF r.email IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailEmpty'::text, NULL::integer;
		ELSIF char_length(r.email) > 255 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailTooLong'::text, NULL::integer;
		END IF;

		-- Entity tag: blank = generic node. Otherwise it must be an uploadable kind matched by its
		-- localized name (Program/Area/Subarea/Course); School/Dean belong to the prior configuration.
		-- Program/Course anchor to a real entity (entity_code required); Area/Subarea carry none.
		IF r.entity_type_name IS NULL THEN
			IF r.entity_code IS NOT NULL THEN
				v_has_errors := true;
				RETURN QUERY SELECT r.row_number, 'entityCodeWithoutType'::text, NULL::integer;
			END IF;
		ELSIF r.resolved_entity_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'entityTypeInvalid'::text, NULL::integer;
		ELSIF r.resolved_entity_code IN ('TG903-T003', 'TG903-T006') AND NOT (
			(r.resolved_entity_code = 'TG903-T003' AND EXISTS (SELECT 1 FROM academic.programs x WHERE x.code = r.entity_code)) OR
			(r.resolved_entity_code = 'TG903-T006' AND EXISTS (SELECT 1 FROM academic.courses x WHERE x.code = r.entity_code))
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'entityNotFound'::text, NULL::integer;
		END IF;

		IF r.parent_code IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM jsonb_array_elements(p_rows) AS d
			WHERE lower(trim(d->>'code')) = lower(r.parent_code)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'parentNotFound'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T004'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- stamp each responsible's contact email onto their staff (resolved via professor code)
	UPDATE organization.staff s
	SET staff_email = trim(e->>'email'), updated_at = NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	WHERE s.id = pr.staff_id
	  AND NULLIF(trim(e->>'email'), '') IS NOT NULL;

	-- the school's chart node (prior configuration) that the top-level uploaded rows hang under
	v_school_chart_id := (
		SELECT c.id FROM organization.charts c
		JOIN core.types et ON et.id = c.entity_type_id
		WHERE et.code = 'TG903-T002'
		  AND c.entity_code = p_school_id
		  AND c.academic_period_id = p_academic_period_id
		  AND c.is_active = true
		LIMIT 1
	);

	-- pass 1: insert every node (root_chart_id NULL), keep the file code in extra for wiring.
	-- the node's staff is resolved through the professor code: professors.code -> professors.staff_id.
	INSERT INTO organization.charts
		(staff_id, academic_period_id, root_chart_id, title, entity_type_id, entity_code,
		 upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		s.id,
		p_academic_period_id,
		NULL,
		COALESCE(e->'title', '{}'::jsonb),
		et.id,
		CASE
			WHEN et.code = 'TG903-T003' THEN (SELECT id FROM academic.programs WHERE code = trim(e->>'entityCode'))
			WHEN et.code = 'TG903-T006' THEN (SELECT id FROM academic.courses WHERE code = trim(e->>'entityCode'))
			ELSE NULL
		END,
		v_log_id,
		jsonb_build_object('upload_node_code', lower(trim(e->>'code'))),
		true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	JOIN organization.staff s   ON s.id = pr.staff_id
	LEFT JOIN LATERAL (
		SELECT t.id, t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
		WHERE g.code = 'TG903'
		  AND t.code IN ('TG903-T003', 'TG903-T004', 'TG903-T005', 'TG903-T006')
		  AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
		       OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
		LIMIT 1
	) et ON true;

	-- pass 2: wire root_chart_id by matching parentCode -> the node whose code matches (this upload)
	UPDATE organization.charts child
	SET root_chart_id = parent.id, updated_at = NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.charts parent
		ON parent.upload_log_id = v_log_id
	   AND parent.extra->>'upload_node_code' = lower(trim(e->>'parentCode'))
	WHERE child.upload_log_id = v_log_id
	  AND child.extra->>'upload_node_code' = lower(trim(e->>'code'))
	  AND NULLIF(trim(e->>'parentCode'), '') IS NOT NULL;

	-- pass 3: top-level rows (no parent in the file) hang under the school's chart node.
	-- Qualify the columns: unqualified upload_log_id collides with the OUT column of the same name.
	UPDATE organization.charts
	SET root_chart_id = v_school_chart_id, updated_at = NOW()
	WHERE charts.upload_log_id = v_log_id AND charts.root_chart_id IS NULL;

	-- drop the temporary wiring code from extra
	UPDATE organization.charts SET extra = extra - 'upload_node_code' WHERE charts.upload_log_id = v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);
	}
}
