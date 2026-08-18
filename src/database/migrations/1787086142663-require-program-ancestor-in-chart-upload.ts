import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Recreates audit.fn_upload_charts so an Area, Subarea or Course row can no longer attach
 * directly under the school (no career in between), and Program can no longer be a row's own
 * tag — it is created only through the chart-heads pre-configuration step.
 *
 * Changes to the per-row validation loop:
 *   - The entity-type resolution list drops 'TG903-T003' (Program): a row still tagged Program
 *     simply fails to resolve and falls into the existing entityTypeInvalid branch.
 *   - parent_code is now required. Blank -> new parentCodeEmpty.
 *   - Non-blank parent_code is resolved in order (a documented, deliberate precedence for the
 *     unlikely case a file-local code collides with a real program code):
 *       1. matches another row's code in this file -> unchanged, wired in pass 2.
 *       2. else matches an active academic.programs.code -> that program must already have an
 *          active chart node under THIS school (root_chart_id = the school's own chart id) for
 *          this period, else new programNotConfiguredForSchool.
 *       3. else -> existing parentNotFound.
 *   - A new wiring pass links rows whose parent resolved to a program directly to that
 *     program's chart id. The old "pass 3: top-level rows hang under the school" is removed —
 *     nothing reaches wiring with an unresolved parent any more, since blank/unresolvable
 *     parentCode is now caught in validation before any insert.
 *
 * v_school_chart_id is computed at the top of the function (moved up from just before the
 * insert passes) because the per-row validation loop now needs it too.
 *
 * Error attribution: a row several levels under a broken chain still names its own immediate,
 * file-local parent correctly, so only the row actually missing a valid parent is ever flagged
 * — no chain-walk is needed for this.
 *
 * Forward-only in production: down() restores the prior function body verbatim from
 * 1785730489320-enforce-unique-chart-entity-per-period.ts.
 */
export class RequireProgramAncestorInChartUpload1787086142663 implements MigrationInterface {
	name = 'RequireProgramAncestorInChartUpload1787086142663';

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
	-- uploaded" guard are checked in the service (request-level HTTP errors), not here. Every
	-- row must resolve to a parent: another row's code in this file, or a program's own code
	-- already pre-configured under this school via chart-heads. Blank, or a code that resolves
	-- to neither, is rejected.

	-- the school's chart node (prior configuration). Needed by the per-row parent validation
	-- below as well as the insert-time wiring further down.
	v_school_chart_id := (
		SELECT c.id FROM organization.charts c
		JOIN core.types et ON et.id = c.entity_type_id
		WHERE et.code = 'TG903-T002'
		  AND c.entity_code = p_school_id
		  AND c.academic_period_id = p_academic_period_id
		  AND c.is_active = true
		LIMIT 1
	);

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

	-- intra-file: two rows must not resolve to the same entity (Course only now; Program is no
	-- longer an uploadable row tag).
	FOR r IN
		SELECT rn FROM (
			SELECT
				(e->>'rowNumber')::int AS rn,
				count(*) OVER (PARTITION BY et.code, ent.entity_id) AS same_entity
			FROM jsonb_array_elements(p_rows) AS e
			JOIN LATERAL (
				SELECT t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
				WHERE g.code = 'TG903'
				  AND t.code = 'TG903-T006'
				  AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
				       OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
				LIMIT 1
			) et ON true
			JOIN LATERAL (
				SELECT id AS entity_id FROM academic.courses WHERE code = trim(e->>'entityCode')
			) ent ON true
			WHERE NULLIF(trim(e->>'entityCode'), '') IS NOT NULL
			  AND ent.entity_id IS NOT NULL
		) q
		WHERE q.same_entity > 1
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateEntityInFile'::text, NULL::integer;
	END LOOP;

	-- the entity must not already hold an active node in this period.
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		JOIN LATERAL (
			SELECT t.id, t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG903'
			  AND t.code = 'TG903-T006'
			  AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
			       OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
			LIMIT 1
		) et ON true
		JOIN LATERAL (
			SELECT id AS entity_id FROM academic.courses WHERE code = trim(e->>'entityCode')
		) ent ON true
		WHERE NULLIF(trim(e->>'entityCode'), '') IS NOT NULL
		  AND ent.entity_id IS NOT NULL
		  AND EXISTS (
			SELECT 1 FROM organization.charts c
			WHERE c.academic_period_id = p_academic_period_id
			  AND c.entity_type_id     = et.id
			  AND c.entity_code        = ent.entity_id
			  AND c.is_active          = true
		  )
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'entityAlreadyInPeriod'::text, NULL::integer;
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
			   AND t.code IN ('TG903-T004', 'TG903-T005', 'TG903-T006')
			   AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
			        OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
			 LIMIT 1)                              AS resolved_entity_code,
			-- email (lowercased) of the user already linked to this professor's staff, if any.
			(SELECT lower(u.email)
			 FROM academic.professors pr
			 JOIN organization.staff s ON s.id = pr.staff_id
			 JOIN organization.users u ON u.id = s.user_id
			 WHERE pr.code = NULLIF(trim(e->>'professorCode'), '')
			 LIMIT 1)                              AS linked_user_email,
			-- the program parentCode names, when it is not a file-local row code. File codes win
			-- on a collision: this is only consulted after the file-code check fails.
			(SELECT pr.id FROM academic.programs pr
			 WHERE pr.code = NULLIF(trim(e->>'parentCode'), '') AND pr.is_active = true
			 LIMIT 1)                              AS parent_program_id
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

		IF r.email IS NOT NULL
		   AND r.linked_user_email IS NOT NULL
		   AND r.linked_user_email <> lower(r.email) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailMismatchForLinkedUser'::text, NULL::integer;
		END IF;

		-- Entity tag: blank = generic node. Otherwise it must be an uploadable kind matched by its
		-- localized name (Area/Subarea/Course only now — Program is configured separately, not
		-- uploaded, so a row still tagged Program simply fails to resolve below).
		-- Course anchors to a real entity (entity_code required); Area/Subarea carry none.
		IF r.entity_type_name IS NULL THEN
			IF r.entity_code IS NOT NULL THEN
				v_has_errors := true;
				RETURN QUERY SELECT r.row_number, 'entityCodeWithoutType'::text, NULL::integer;
			END IF;
		ELSIF r.resolved_entity_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'entityTypeInvalid'::text, NULL::integer;
		ELSIF r.resolved_entity_code = 'TG903-T006' AND NOT EXISTS (
			SELECT 1 FROM academic.courses x WHERE x.code = r.entity_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'entityNotFound'::text, NULL::integer;
		END IF;

		-- Parent resolution: blank is rejected; a file-local code wins over a program code on
		-- collision; a program code must already be configured for THIS school.
		IF r.parent_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'parentCodeEmpty'::text, NULL::integer;
		ELSIF EXISTS (
			SELECT 1 FROM jsonb_array_elements(p_rows) AS d
			WHERE lower(trim(d->>'code')) = lower(r.parent_code)
		) THEN
			NULL; -- resolves within the file; wired in pass 2 below
		ELSIF r.parent_program_id IS NOT NULL THEN
			IF NOT EXISTS (
				SELECT 1 FROM organization.charts pc
				JOIN core.types pt ON pt.id = pc.entity_type_id
				WHERE pt.code = 'TG903-T003'
				  AND pc.entity_code = r.parent_program_id
				  AND pc.academic_period_id = p_academic_period_id
				  AND pc.root_chart_id = v_school_chart_id
				  AND pc.is_active = true
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r.row_number, 'programNotConfiguredForSchool'::text, NULL::integer;
			END IF;
		ELSE
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
		  AND t.code IN ('TG903-T004', 'TG903-T005', 'TG903-T006')
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

	-- pass 3: rows whose parentCode names a pre-configured program (not a file-local code, which
	-- pass 2 already claimed) hang under that program's chart node.
	UPDATE organization.charts child
	SET root_chart_id = prog_chart.id, updated_at = NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs pr
		ON pr.code = trim(e->>'parentCode') AND pr.is_active = true
	JOIN organization.charts prog_chart
		ON prog_chart.root_chart_id = v_school_chart_id
	   AND prog_chart.entity_code = pr.id
	   AND prog_chart.academic_period_id = p_academic_period_id
	   AND prog_chart.is_active = true
	JOIN core.types prog_t ON prog_t.id = prog_chart.entity_type_id AND prog_t.code = 'TG903-T003'
	WHERE child.upload_log_id = v_log_id
	  AND child.extra->>'upload_node_code' = lower(trim(e->>'code'))
	  AND child.root_chart_id IS NULL;

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

	-- intra-file: two rows must not resolve to the same entity. Grouped on the RESOLVED id rather
	-- than the business code, so the check is about the entity, not how it was spelled. Every row of
	-- a duplicated group is returned so the annotated file shows both ends of the conflict.
	FOR r IN
		SELECT rn FROM (
			SELECT
				(e->>'rowNumber')::int AS rn,
				count(*) OVER (PARTITION BY et.code, ent.entity_id) AS same_entity
			FROM jsonb_array_elements(p_rows) AS e
			JOIN LATERAL (
				SELECT t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
				WHERE g.code = 'TG903'
				  AND t.code IN ('TG903-T003', 'TG903-T006')
				  AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
				       OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
				LIMIT 1
			) et ON true
			JOIN LATERAL (
				SELECT CASE
					WHEN et.code = 'TG903-T003' THEN (SELECT id FROM academic.programs WHERE code = trim(e->>'entityCode'))
					WHEN et.code = 'TG903-T006' THEN (SELECT id FROM academic.courses  WHERE code = trim(e->>'entityCode'))
				END AS entity_id
			) ent ON true
			WHERE NULLIF(trim(e->>'entityCode'), '') IS NOT NULL
			  AND ent.entity_id IS NOT NULL
		) q
		WHERE q.same_entity > 1
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateEntityInFile'::text, NULL::integer;
	END LOOP;

	-- the entity must not already hold an active node in this period. charts.entity_code stores the
	-- internal id, so the row's business code is resolved before comparing.
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		JOIN LATERAL (
			SELECT t.id, t.code FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG903'
			  AND t.code IN ('TG903-T003', 'TG903-T006')
			  AND (lower(t.name->>'es') = lower(trim(e->>'entityType'))
			       OR lower(t.name->>'en') = lower(trim(e->>'entityType')))
			LIMIT 1
		) et ON true
		JOIN LATERAL (
			SELECT CASE
				WHEN et.code = 'TG903-T003' THEN (SELECT id FROM academic.programs WHERE code = trim(e->>'entityCode'))
				WHEN et.code = 'TG903-T006' THEN (SELECT id FROM academic.courses  WHERE code = trim(e->>'entityCode'))
			END AS entity_id
		) ent ON true
		WHERE NULLIF(trim(e->>'entityCode'), '') IS NOT NULL
		  AND ent.entity_id IS NOT NULL
		  AND EXISTS (
			SELECT 1 FROM organization.charts c
			WHERE c.academic_period_id = p_academic_period_id
			  AND c.entity_type_id     = et.id
			  AND c.entity_code        = ent.entity_id
			  AND c.is_active          = true
		  )
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'entityAlreadyInPeriod'::text, NULL::integer;
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
}
