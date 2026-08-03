import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Enforce "an entity holds at most ONE active chart node per academic period".
 *
 * audit.fn_upload_charts is recreated with two new validations, returned per row before any write:
 *   - intra-file: two rows resolve to the same entity -> duplicateEntityInFile. Every offending row
 *     is returned, not just the second, so the annotated Excel shows both ends of the conflict.
 *   - DB-level: the entity already has an active node in this period -> entityAlreadyInPeriod.
 *
 * The file's entityCode column carries the BUSINESS code (academic.programs.code /
 * academic.courses.code) while organization.charts.entity_code stores the internal id. Both checks
 * resolve the business code to an id first; comparing the file's code directly against
 * charts.entity_code would compare a code to an id and silently never match.
 *
 * Only Program (TG903-T003) and Course (TG903-T006) reach these checks: School and Dean are not
 * uploadable, and Area/Subarea carry no entity code.
 *
 * A partial unique index then guarantees the invariant at the database level, covering direct writes
 * and the race where two concurrent requests both pass application validation. It is an index rather
 * than a constraint because a UNIQUE constraint cannot carry a WHERE clause, and the predicate is
 * what keeps null-coded nodes (Area/Subarea/untagged) free to repeat.
 *
 * up() refuses to run if the table already violates the invariant, naming the offending groups
 * rather than leaving the operator with the index's own message. It never deletes or deactivates a
 * chart node: which duplicate survives decides which node owns its IFCs and drives notification
 * routing, so that is a decision for the team, not for a migration.
 *
 * The index name below is also matched at runtime by ChartRepository, which translates SQLSTATE
 * 23505 on it into a domain conflict — see UNIQUE_CHART_ENTITY_INDEX in
 * src/modules/organization/charts/core/charts.repository.ts. Renaming it here alone would leave
 * that translation silently unmatched, and every lost duplicate race would return a 500 again.
 *
 * Forward-only in production: down() drops the index and restores the prior function body (no
 * duplicate-entity checks).
 */
export class EnforceUniqueChartEntityPerPeriod1785730489320 implements MigrationInterface {
	name = 'EnforceUniqueChartEntityPerPeriod1785730489320';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const duplicates: Array<{
			academicPeriodId: number;
			entityTypeId: number;
			entityCode: number;
			nodes: string;
			chartIds: string;
		}> = await queryRunner.query(`
			SELECT academic_period_id AS "academicPeriodId",
			       entity_type_id     AS "entityTypeId",
			       entity_code        AS "entityCode",
			       count(*)           AS "nodes",
			       string_agg(id::text, ', ' ORDER BY id) AS "chartIds"
			FROM   organization.charts
			WHERE  entity_code IS NOT NULL AND is_active = true
			GROUP  BY academic_period_id, entity_type_id, entity_code
			HAVING count(*) > 1
			ORDER  BY academic_period_id, entity_type_id, entity_code
		`);

		if (duplicates.length > 0) {
			const detail = duplicates
				.map(
					(d) =>
						`  period=${d.academicPeriodId} entityType=${d.entityTypeId} entity=${d.entityCode}` +
						` -> ${d.nodes} active nodes (chart ids: ${d.chartIds})`,
				)
				.join('\n');
			throw new Error(
				`Cannot create UQ_charts_academic_period_entity_type_entity_code: ${duplicates.length} ` +
					`(academic period, entity type, entity) group(s) already hold more than one active chart ` +
					`node.\n${detail}\nResolve these by hand before deploying. Re-parent the losing node's ` +
					`children onto the keeper before deactivating it, or its whole subtree disappears from ` +
					`the maintenance tree.`,
			);
		}

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

		await queryRunner.query(`
			CREATE UNIQUE INDEX "UQ_charts_academic_period_entity_type_entity_code"
				ON organization.charts (academic_period_id, entity_type_id, entity_code)
				WHERE entity_code IS NOT NULL AND is_active = true
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP INDEX IF EXISTS organization."UQ_charts_academic_period_entity_type_entity_code"`,
		);

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
}
