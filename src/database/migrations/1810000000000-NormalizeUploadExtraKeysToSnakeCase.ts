import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Normalize the bulk-upload / rollback JSONB `extra` keys to snake_case.
 *
 * Repo convention (AGENTS.md, src/libs/case.functions.ts): JSONB stored in the `extra`
 * column is snake_case, and BaseService camelizes it only at the read boundary. The
 * upload/rollback audit functions were the lone violators — they wrote and read camelCase
 * keys (`uploadUndo` and its nested `logId`/`firstName`/... elements, plus `uploadNodeCode`
 * for charts). This migration brings them in line.
 *
 * 1. CREATE OR REPLACE every affected audit.fn_upload_* / fn_rollback_* function with its
 *    latest body, but with snake_case `extra` keys (`upload_undo`, `upload_node_code`, and
 *    every nested key: `log_id`, `first_name`, `grade_type_percentage`, ...). Writes and reads
 *    inside each function use the new keys consistently. Only the `extra`-column keys changed;
 *    input-payload reads (e->>'firstName') and exception/result strings are untouched.
 * 2. Backfill existing rows via a recursive, idempotent `audit.snake_case_jsonb_keys(jsonb)`
 *    helper applied to every table whose `extra` can hold an upload undo-stack, then drop it.
 *
 * Forward-only in production. down() restores the original camelCase function bodies and runs
 * a best-effort reverse backfill (see note inline — re-camelizing is lossy in the general case
 * but round-trips for these undo-stack-only blobs).
 */
export class NormalizeUploadExtraKeysToSnakeCase1810000000000 implements MigrationInterface {
	name = 'NormalizeUploadExtraKeysToSnakeCase1810000000000';

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

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                 AS row_number,
			NULLIF(trim(e->>'code'), '')           AS code,
			NULLIF(trim(e->>'parentCode'), '')     AS parent_code,
			COALESCE(e->'title', '{}'::jsonb)      AS title,
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

		IF r.email IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM organization.users u WHERE lower(u.email) = lower(r.email)) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'userNotFound'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM organization.users u JOIN organization.staff s ON s.user_id = u.id
			WHERE lower(u.email) = lower(r.email)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'staffNotFound'::text, NULL::integer;
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

	-- pass 1: insert every node (root_chart_id NULL), keep the file code in extra for wiring
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
	JOIN organization.staff s
		ON s.id = (SELECT ss.id FROM organization.staff ss
		           JOIN organization.users uu ON uu.id = ss.user_id
		           WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY ss.id LIMIT 1)
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
CREATE OR REPLACE FUNCTION audit.fn_upload_outcomes(
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

	-- intra-file duplicate outcome (the stored code is commissionCode-programCode-userInput)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'commissionCode')), lower(trim(e->>'programCode')), lower(trim(e->>'outcomeCode'))) IN (
			SELECT lower(trim(d->>'commissionCode')), lower(trim(d->>'programCode')), lower(trim(d->>'outcomeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'commissionCode')), lower(trim(d->>'programCode')), lower(trim(d->>'outcomeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                 AS row_number,
			NULLIF(trim(e->>'outcomeCode'), '')    AS outcome_code,
			NULLIF(trim(e->>'programCode'), '')    AS program_code,
			NULLIF(trim(e->>'commissionCode'), '') AS commission_code,
			COALESCE(e->'outcomeName', '{}'::jsonb) AS outcome_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.outcome_name) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNameEmpty'::text, NULL::integer;
		END IF;

		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		END IF;

		IF r.commission_code IS NULL OR NOT EXISTS (SELECT 1 FROM accreditation.commissions c WHERE c.code = r.commission_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'commissionNotFound'::text, NULL::integer;
		END IF;

		-- the program_commission (program + commission + period) must already exist (catalog)
		IF r.program_code IS NOT NULL AND r.commission_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM accreditation.program_commissions pc
			JOIN academic.programs p ON p.id = pc.program_id
			JOIN accreditation.commissions c ON c.id = pc.commission_id
			WHERE p.code = r.program_code
			  AND c.code = r.commission_code
			  AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programCommissionNotFound'::text, NULL::integer;
		END IF;

		IF r.commission_code IS NOT NULL AND r.program_code IS NOT NULL AND r.outcome_code IS NOT NULL
		   AND char_length(r.commission_code || '-' || r.program_code || '-' || r.outcome_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeTooLong'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T003'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert outcomes whose code does not exist yet
	INSERT INTO accreditation.outcomes
		(program_commission_id, outcome_code, outcome_name, outcome_description, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		pc.id,
		trim(e->>'commissionCode') || '-' || trim(e->>'programCode') || '-' || trim(e->>'outcomeCode'),
		COALESCE(e->'outcomeName', '{}'::jsonb),
		COALESCE(e->'outcomeDescription', '{}'::jsonb),
		v_log_id,
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN accreditation.commissions c ON c.code = trim(e->>'commissionCode')
	JOIN accreditation.program_commissions pc
		ON pc.program_id = p.id AND pc.commission_id = c.id AND pc.academic_period_id = p_academic_period_id
	WHERE NOT EXISTS (
		SELECT 1 FROM accreditation.outcomes o
		WHERE o.program_commission_id = pc.id
		  AND o.outcome_code = trim(e->>'commissionCode') || '-' || trim(e->>'programCode') || '-' || trim(e->>'outcomeCode')
	);

	-- update outcomes whose code already existed in this period (push prior name + description onto the extra.upload_undo stack)
	UPDATE accreditation.outcomes o
	SET outcome_name = COALESCE(e->'outcomeName', '{}'::jsonb),
		outcome_description = COALESCE(e->'outcomeDescription', '{}'::jsonb),
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(o.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(o.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'outcome_name', o.outcome_name,
				'outcome_description', o.outcome_description))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN accreditation.commissions c ON c.code = trim(e->>'commissionCode')
	JOIN accreditation.program_commissions pc
		ON pc.program_id = p.id AND pc.commission_id = c.id AND pc.academic_period_id = p_academic_period_id
	WHERE o.program_commission_id = pc.id
	  AND o.outcome_code = trim(e->>'commissionCode') || '-' || trim(e->>'programCode') || '-' || trim(e->>'outcomeCode')
	  AND o.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_articulation(
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

	-- intra-file duplicate (outcome, study plan, course)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'outcomeCode')), lower(trim(e->>'studyPlanCode')), lower(trim(e->>'courseCode'))) IN (
			SELECT lower(trim(d->>'outcomeCode')), lower(trim(d->>'studyPlanCode')), lower(trim(d->>'courseCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studyPlanCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'courseCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'outcomeCode')), lower(trim(d->>'studyPlanCode')), lower(trim(d->>'courseCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                  AS row_number,
			NULLIF(trim(e->>'outcomeCode'), '')     AS outcome_code,
			NULLIF(trim(e->>'studyPlanCode'), '')   AS study_plan_code,
			NULLIF(trim(e->>'courseCode'), '')      AS course_code,
			NULLIF(trim(e->>'outcomeTypeCode'), '') AS outcome_type_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			WHERE o.outcome_code = r.outcome_code AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotFound'::text, NULL::integer;
		END IF;

		IF r.study_plan_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeEmpty'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		END IF;

		-- the study_plan_course (plan + course + period) must exist
		IF r.study_plan_code IS NOT NULL AND r.course_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_courses spc
			JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.courses c ON c.id = spc.course_id
			WHERE spap.academic_period_id = p_academic_period_id
			  AND sp.code = r.study_plan_code
			  AND c.code = r.course_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCourseNotFound'::text, NULL::integer;
		END IF;

		IF r.outcome_type_code IS NULL OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG302' AND t.code = r.outcome_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeTypeInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T009'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert mappings that do not exist yet (uniqueness = outcome + study_plan_course)
	INSERT INTO academic.course_outcome_mappings
		(outcome_id, study_plan_course_id, outcome_type_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		o.id, spc.id, t.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = p_academic_period_id
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
	JOIN core.type_groups g ON g.code = 'TG302'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'outcomeTypeCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE com.outcome_id = o.id AND com.study_plan_course_id = spc.id
	);

	-- update mappings that already existed (push prior outcome type onto the extra.upload_undo stack)
	UPDATE academic.course_outcome_mappings com
	SET outcome_type_id = t.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(com.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(com.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'outcome_type_id', com.outcome_type_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = p_academic_period_id
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
	JOIN core.type_groups g ON g.code = 'TG302'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'outcomeTypeCode')
	WHERE com.outcome_id = o.id
	  AND com.study_plan_course_id = spc.id
	  AND com.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_sections(
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

	-- intra-file duplicate section code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'sectionCode')) IN (
			SELECT lower(trim(d->>'sectionCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode'))
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
			NULLIF(trim(e->>'sectionCode'), '')         AS section_code,
			NULLIF(trim(e->>'courseCode'), '')          AS course_code,
			NULLIF(trim(e->>'campusCode'), '')          AS campus_code,
			NULLIF(trim(e->>'professorCode'), '')       AS professor_code,
			-- the file carries a single-letter teaching modality (P/S/V); map it to its TG103 type code.
			CASE upper(NULLIF(trim(e->>'sectionModalityTypeCode'), ''))
				WHEN 'P' THEN 'TG103-T001'
				WHEN 'S' THEN 'TG103-T003'
				WHEN 'V' THEN 'TG103-T002'
			END                                         AS modality_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.section_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeTooLong'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.courses c WHERE c.code = r.course_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNotFound'::text, NULL::integer;
		END IF;

		IF r.campus_code IS NULL OR NOT EXISTS (SELECT 1 FROM organization.campuses cam WHERE cam.code = r.campus_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'campusNotFound'::text, NULL::integer;
		END IF;

		IF r.professor_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.professors pr WHERE pr.code = r.professor_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorNotFound'::text, NULL::integer;
		END IF;

		IF r.modality_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionModalityInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T005'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert sections whose code does not exist yet (schedule left NULL per spec)
	INSERT INTO academic.course_sections
		(course_id, academic_period_id, campus_id, professor_id, section_code, schedule, section_modality_type_id, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		c.id, p_academic_period_id, cam.id, pr.id, trim(e->>'sectionCode'), NULL, t.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = CASE upper(trim(e->>'sectionModalityTypeCode'))
		WHEN 'P' THEN 'TG103-T001'
		WHEN 'S' THEN 'TG103-T003'
		WHEN 'V' THEN 'TG103-T002'
	END
	WHERE NOT EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = trim(e->>'sectionCode'));

	-- update sections whose code already existed (push prior values onto the extra.upload_undo stack)
	UPDATE academic.course_sections cs
	SET course_id = c.id,
		academic_period_id = p_academic_period_id,
		campus_id = cam.id,
		professor_id = pr.id,
		section_modality_type_id = t.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(cs.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(cs.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'course_id', cs.course_id,
				'academic_period_id', cs.academic_period_id,
				'campus_id', cs.campus_id, 'professor_id', cs.professor_id,
				'section_modality_type_id', cs.section_modality_type_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = CASE upper(trim(e->>'sectionModalityTypeCode'))
		WHEN 'P' THEN 'TG103-T001'
		WHEN 'S' THEN 'TG103-T003'
		WHEN 'V' THEN 'TG103-T002'
	END
	WHERE cs.section_code = trim(e->>'sectionCode')
	  AND cs.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

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
CREATE OR REPLACE FUNCTION audit.fn_upload_grades_rv(
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

	-- intra-file duplicate (section, student, outcome)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode')), lower(trim(e->>'outcomeCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'outcomeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'outcomeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int               AS row_number,
			NULLIF(trim(e->>'sectionCode'), '')  AS section_code,
			NULLIF(trim(e->>'studentCode'), '')  AS student_code,
			NULLIF(trim(e->>'outcomeCode'), '')  AS outcome_code,
			NULLIF(trim(e->>'grade'), '')        AS grade
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

		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			WHERE o.outcome_code = r.outcome_code AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotFound'::text, NULL::integer;
		END IF;

		-- the outcome must be mapped to the section's course (course_outcome_mappings on its study_plan_course)
		IF r.section_code IS NOT NULL AND r.outcome_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM accreditation.outcomes o JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id WHERE o.outcome_code = r.outcome_code AND pc.academic_period_id = p_academic_period_id)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.study_plan_courses spc_com ON spc_com.course_id = cs.course_id
			JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc_com.id
			JOIN accreditation.outcomes o ON o.id = com.outcome_id
			JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = cs.academic_period_id
			WHERE cs.section_code = r.section_code AND o.outcome_code = r.outcome_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotInSection'::text, NULL::integer;
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
		(SELECT id FROM core.types WHERE code = 'TG1101-T007'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert outcome grades that do not exist yet (uniqueness = enrollment + outcome)
	INSERT INTO evidence.student_course_outcome_grades
		(student_section_enrollment_id, outcome_id, grade, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		sse.id, o.id, (e->>'grade')::numeric, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = p_academic_period_id
	WHERE NOT EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE g.student_section_enrollment_id = sse.id AND g.outcome_id = o.id
	);

	-- update outcome grades that already existed (push prior grade onto the extra.upload_undo stack)
	UPDATE evidence.student_course_outcome_grades g
	SET grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(g.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(g.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'grade', g.grade))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = p_academic_period_id
	WHERE g.student_section_enrollment_id = sse.id
	  AND g.outcome_id = o.id
	  AND g.upload_log_id IS DISTINCT FROM v_log_id;

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

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_outcomes(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if an outcome created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM improvement.finding_outcomes fo
		JOIN accreditation.outcomes o ON o.id = fo.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM survey.scores sc
		JOIN accreditation.outcomes o ON o.id = sc.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM survey.outcome_configs oc
		JOIN accreditation.outcomes o ON o.id = oc.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		JOIN accreditation.outcomes o ON o.id = g.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evaluation.rubric_questions rq
		JOIN accreditation.outcomes o ON o.id = rq.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		JOIN accreditation.outcomes o ON o.id = com.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedOutcomeRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM accreditation.outcomes o
		WHERE (o.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (o.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM accreditation.outcomes o
		WHERE o.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(o.extra->'upload_undo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated outcomes by popping this upload's (top) upload_undo entry, then drop inserts
	UPDATE accreditation.outcomes o
	SET outcome_name = o.extra->'upload_undo' -> -1 -> 'outcome_name',
		outcome_description = COALESCE(o.extra->'upload_undo' -> -1 -> 'outcome_description', o.outcome_description),
		extra = CASE
			WHEN jsonb_array_length(o.extra->'upload_undo') <= 1 THEN o.extra - 'upload_undo'
			ELSE jsonb_set(o.extra, '{upload_undo}', (o.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (o.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM accreditation.outcomes WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_articulation(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE (com.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (com.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE com.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(com.extra->'upload_undo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated mappings by popping this upload's (top) upload_undo entry, then drop inserts
	UPDATE academic.course_outcome_mappings com
	SET outcome_type_id = (com.extra->'upload_undo' -> -1 ->> 'outcome_type_id')::int,
		extra = CASE
			WHEN jsonb_array_length(com.extra->'upload_undo') <= 1 THEN com.extra - 'upload_undo'
			ELSE jsonb_set(com.extra, '{upload_undo}', (com.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (com.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.course_outcome_mappings WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_sections(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if a section created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		JOIN academic.course_sections cs ON cs.id = sse.course_section_id
		WHERE cs.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.surveys sv
		JOIN academic.course_sections cs ON cs.id = sv.course_section_id
		WHERE cs.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedSectionRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM academic.course_sections cs
		WHERE (cs.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (cs.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_sections cs
		WHERE cs.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(cs.extra->'upload_undo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated sections by popping this upload's (top) upload_undo entry, then drop inserts
	UPDATE academic.course_sections cs
	SET course_id = (cs.extra->'upload_undo' -> -1 ->> 'course_id')::int,
		academic_period_id = (cs.extra->'upload_undo' -> -1 ->> 'academic_period_id')::int,
		campus_id = (cs.extra->'upload_undo' -> -1 ->> 'campus_id')::int,
		professor_id = (cs.extra->'upload_undo' -> -1 ->> 'professor_id')::int,
		section_modality_type_id = (cs.extra->'upload_undo' -> -1 ->> 'section_modality_type_id')::int,
		extra = CASE
			WHEN jsonb_array_length(cs.extra->'upload_undo') <= 1 THEN cs.extra - 'upload_undo'
			ELSE jsonb_set(cs.extra, '{upload_undo}', (cs.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (cs.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM academic.course_sections WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
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

	-- restore updated grades by popping this upload's (top) upload_undo entry, then drop inserts
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

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rv(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE (g.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (g.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE g.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(g.extra->'upload_undo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated grades by popping this upload's (top) upload_undo entry, then drop inserts
	UPDATE evidence.student_course_outcome_grades g
	SET grade = (g.extra->'upload_undo' -> -1 ->> 'grade')::numeric,
		extra = CASE
			WHEN jsonb_array_length(g.extra->'upload_undo') <= 1 THEN g.extra - 'upload_undo'
			ELSE jsonb_set(g.extra, '{upload_undo}', (g.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (g.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	DELETE FROM evidence.student_course_outcome_grades WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		// Backfill historical rows: snake_case every key (top-level + nested undo-stack
		// elements) in any `extra` blob that still carries the old camelCase upload keys.
		// The helper is recursive and idempotent, so re-running is harmless.
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.snake_case_jsonb_keys(data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $helper$
DECLARE
	result jsonb;
	k text;
	v jsonb;
BEGIN
	IF data IS NULL OR jsonb_typeof(data) = 'null' THEN
		RETURN data;
	ELSIF jsonb_typeof(data) = 'array' THEN
		RETURN COALESCE(
			(SELECT jsonb_agg(audit.snake_case_jsonb_keys(elem)) FROM jsonb_array_elements(data) AS elem),
			'[]'::jsonb
		);
	ELSIF jsonb_typeof(data) = 'object' THEN
		result := '{}'::jsonb;
		FOR k, v IN SELECT * FROM jsonb_each(data) LOOP
			-- snake_case the key: prefix every uppercase letter with '_' and lowercase it.
			-- Already-snake keys have no uppercase, so this is idempotent.
			result := result || jsonb_build_object(
				lower(regexp_replace(k, '([A-Z])', '_\\1', 'g')),
				audit.snake_case_jsonb_keys(v)
			);
		END LOOP;
		RETURN result;
	ELSE
		RETURN data;
	END IF;
END;
$helper$;
`);

		await queryRunner.query(`
UPDATE organization.staff
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE academic.professors
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE organization.charts
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE accreditation.outcomes
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE academic.course_outcome_mappings
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE academic.course_sections
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE academic.students
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE academic.enrolled_students
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE academic.student_course_grades
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);
		await queryRunner.query(`
UPDATE evidence.student_course_outcome_grades
SET extra = audit.snake_case_jsonb_keys(extra)
WHERE extra ?| array['uploadUndo', 'uploadNodeCode'];
`);

		await queryRunner.query(`
DROP FUNCTION IF EXISTS audit.snake_case_jsonb_keys(jsonb);
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
				extra = jsonb_set(COALESCE(s.extra, '{}'::jsonb), '{uploadUndo}',
					COALESCE(s.extra->'uploadUndo', '[]'::jsonb) ||
					jsonb_build_object('logId', v_log_id, 'firstName', s.first_name, 'lastName', s.last_name))
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

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                 AS row_number,
			NULLIF(trim(e->>'code'), '')           AS code,
			NULLIF(trim(e->>'parentCode'), '')     AS parent_code,
			COALESCE(e->'title', '{}'::jsonb)      AS title,
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

		IF r.email IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'emailEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM organization.users u WHERE lower(u.email) = lower(r.email)) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'userNotFound'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM organization.users u JOIN organization.staff s ON s.user_id = u.id
			WHERE lower(u.email) = lower(r.email)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'staffNotFound'::text, NULL::integer;
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

	-- pass 1: insert every node (root_chart_id NULL), keep the file code in extra for wiring
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
		jsonb_build_object('uploadNodeCode', lower(trim(e->>'code'))),
		true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN organization.staff s
		ON s.id = (SELECT ss.id FROM organization.staff ss
		           JOIN organization.users uu ON uu.id = ss.user_id
		           WHERE lower(uu.email) = lower(trim(e->>'email')) ORDER BY ss.id LIMIT 1)
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
	   AND parent.extra->>'uploadNodeCode' = lower(trim(e->>'parentCode'))
	WHERE child.upload_log_id = v_log_id
	  AND child.extra->>'uploadNodeCode' = lower(trim(e->>'code'))
	  AND NULLIF(trim(e->>'parentCode'), '') IS NOT NULL;

	-- pass 3: top-level rows (no parent in the file) hang under the school's chart node.
	-- Qualify the columns: unqualified upload_log_id collides with the OUT column of the same name.
	UPDATE organization.charts
	SET root_chart_id = v_school_chart_id, updated_at = NOW()
	WHERE charts.upload_log_id = v_log_id AND charts.root_chart_id IS NULL;

	-- drop the temporary wiring code from extra
	UPDATE organization.charts SET extra = extra - 'uploadNodeCode' WHERE charts.upload_log_id = v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_outcomes(
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

	-- intra-file duplicate outcome (the stored code is commissionCode-programCode-userInput)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'commissionCode')), lower(trim(e->>'programCode')), lower(trim(e->>'outcomeCode'))) IN (
			SELECT lower(trim(d->>'commissionCode')), lower(trim(d->>'programCode')), lower(trim(d->>'outcomeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'commissionCode')), lower(trim(d->>'programCode')), lower(trim(d->>'outcomeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateCodeInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                 AS row_number,
			NULLIF(trim(e->>'outcomeCode'), '')    AS outcome_code,
			NULLIF(trim(e->>'programCode'), '')    AS program_code,
			NULLIF(trim(e->>'commissionCode'), '') AS commission_code,
			COALESCE(e->'outcomeName', '{}'::jsonb) AS outcome_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.outcome_name) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNameEmpty'::text, NULL::integer;
		END IF;

		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		END IF;

		IF r.commission_code IS NULL OR NOT EXISTS (SELECT 1 FROM accreditation.commissions c WHERE c.code = r.commission_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'commissionNotFound'::text, NULL::integer;
		END IF;

		-- the program_commission (program + commission + period) must already exist (catalog)
		IF r.program_code IS NOT NULL AND r.commission_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM accreditation.program_commissions pc
			JOIN academic.programs p ON p.id = pc.program_id
			JOIN accreditation.commissions c ON c.id = pc.commission_id
			WHERE p.code = r.program_code
			  AND c.code = r.commission_code
			  AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programCommissionNotFound'::text, NULL::integer;
		END IF;

		IF r.commission_code IS NOT NULL AND r.program_code IS NOT NULL AND r.outcome_code IS NOT NULL
		   AND char_length(r.commission_code || '-' || r.program_code || '-' || r.outcome_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeTooLong'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T003'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert outcomes whose code does not exist yet
	INSERT INTO accreditation.outcomes
		(program_commission_id, outcome_code, outcome_name, outcome_description, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		pc.id,
		trim(e->>'commissionCode') || '-' || trim(e->>'programCode') || '-' || trim(e->>'outcomeCode'),
		COALESCE(e->'outcomeName', '{}'::jsonb),
		COALESCE(e->'outcomeDescription', '{}'::jsonb),
		v_log_id,
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN accreditation.commissions c ON c.code = trim(e->>'commissionCode')
	JOIN accreditation.program_commissions pc
		ON pc.program_id = p.id AND pc.commission_id = c.id AND pc.academic_period_id = p_academic_period_id
	WHERE NOT EXISTS (
		SELECT 1 FROM accreditation.outcomes o
		WHERE o.program_commission_id = pc.id
		  AND o.outcome_code = trim(e->>'commissionCode') || '-' || trim(e->>'programCode') || '-' || trim(e->>'outcomeCode')
	);

	-- update outcomes whose code already existed in this period (push prior name + description onto the extra.uploadUndo stack)
	UPDATE accreditation.outcomes o
	SET outcome_name = COALESCE(e->'outcomeName', '{}'::jsonb),
		outcome_description = COALESCE(e->'outcomeDescription', '{}'::jsonb),
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(o.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(o.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'outcomeName', o.outcome_name,
				'outcomeDescription', o.outcome_description))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN accreditation.commissions c ON c.code = trim(e->>'commissionCode')
	JOIN accreditation.program_commissions pc
		ON pc.program_id = p.id AND pc.commission_id = c.id AND pc.academic_period_id = p_academic_period_id
	WHERE o.program_commission_id = pc.id
	  AND o.outcome_code = trim(e->>'commissionCode') || '-' || trim(e->>'programCode') || '-' || trim(e->>'outcomeCode')
	  AND o.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_articulation(
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

	-- intra-file duplicate (outcome, study plan, course)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'outcomeCode')), lower(trim(e->>'studyPlanCode')), lower(trim(e->>'courseCode'))) IN (
			SELECT lower(trim(d->>'outcomeCode')), lower(trim(d->>'studyPlanCode')), lower(trim(d->>'courseCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studyPlanCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'courseCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'outcomeCode')), lower(trim(d->>'studyPlanCode')), lower(trim(d->>'courseCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                  AS row_number,
			NULLIF(trim(e->>'outcomeCode'), '')     AS outcome_code,
			NULLIF(trim(e->>'studyPlanCode'), '')   AS study_plan_code,
			NULLIF(trim(e->>'courseCode'), '')      AS course_code,
			NULLIF(trim(e->>'outcomeTypeCode'), '') AS outcome_type_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			WHERE o.outcome_code = r.outcome_code AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotFound'::text, NULL::integer;
		END IF;

		IF r.study_plan_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeEmpty'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		END IF;

		-- the study_plan_course (plan + course + period) must exist
		IF r.study_plan_code IS NOT NULL AND r.course_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_courses spc
			JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.courses c ON c.id = spc.course_id
			WHERE spap.academic_period_id = p_academic_period_id
			  AND sp.code = r.study_plan_code
			  AND c.code = r.course_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCourseNotFound'::text, NULL::integer;
		END IF;

		IF r.outcome_type_code IS NULL OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG302' AND t.code = r.outcome_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeTypeInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T009'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert mappings that do not exist yet (uniqueness = outcome + study_plan_course)
	INSERT INTO academic.course_outcome_mappings
		(outcome_id, study_plan_course_id, outcome_type_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		o.id, spc.id, t.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = p_academic_period_id
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
	JOIN core.type_groups g ON g.code = 'TG302'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'outcomeTypeCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE com.outcome_id = o.id AND com.study_plan_course_id = spc.id
	);

	-- update mappings that already existed (push prior outcome type onto the extra.uploadUndo stack)
	UPDATE academic.course_outcome_mappings com
	SET outcome_type_id = t.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(com.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(com.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'outcomeTypeId', com.outcome_type_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = p_academic_period_id
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap.id AND spc.course_id = c.id
	JOIN core.type_groups g ON g.code = 'TG302'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'outcomeTypeCode')
	WHERE com.outcome_id = o.id
	  AND com.study_plan_course_id = spc.id
	  AND com.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_sections(
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

	-- intra-file duplicate section code
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'sectionCode')) IN (
			SELECT lower(trim(d->>'sectionCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode'))
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
			NULLIF(trim(e->>'sectionCode'), '')         AS section_code,
			NULLIF(trim(e->>'courseCode'), '')          AS course_code,
			NULLIF(trim(e->>'campusCode'), '')          AS campus_code,
			NULLIF(trim(e->>'professorCode'), '')       AS professor_code,
			-- the file carries a single-letter teaching modality (P/S/V); map it to its TG103 type code.
			CASE upper(NULLIF(trim(e->>'sectionModalityTypeCode'), ''))
				WHEN 'P' THEN 'TG103-T001'
				WHEN 'S' THEN 'TG103-T003'
				WHEN 'V' THEN 'TG103-T002'
			END                                         AS modality_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.section_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeTooLong'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.courses c WHERE c.code = r.course_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNotFound'::text, NULL::integer;
		END IF;

		IF r.campus_code IS NULL OR NOT EXISTS (SELECT 1 FROM organization.campuses cam WHERE cam.code = r.campus_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'campusNotFound'::text, NULL::integer;
		END IF;

		IF r.professor_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.professors pr WHERE pr.code = r.professor_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorNotFound'::text, NULL::integer;
		END IF;

		IF r.modality_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionModalityInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T005'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert sections whose code does not exist yet (schedule left NULL per spec)
	INSERT INTO academic.course_sections
		(course_id, academic_period_id, campus_id, professor_id, section_code, schedule, section_modality_type_id, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		c.id, p_academic_period_id, cam.id, pr.id, trim(e->>'sectionCode'), NULL, t.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = CASE upper(trim(e->>'sectionModalityTypeCode'))
		WHEN 'P' THEN 'TG103-T001'
		WHEN 'S' THEN 'TG103-T003'
		WHEN 'V' THEN 'TG103-T002'
	END
	WHERE NOT EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = trim(e->>'sectionCode'));

	-- update sections whose code already existed (push prior values onto the extra.uploadUndo stack)
	UPDATE academic.course_sections cs
	SET course_id = c.id,
		academic_period_id = p_academic_period_id,
		campus_id = cam.id,
		professor_id = pr.id,
		section_modality_type_id = t.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(cs.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(cs.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'courseId', cs.course_id,
				'academicPeriodId', cs.academic_period_id,
				'campusId', cs.campus_id, 'professorId', cs.professor_id,
				'sectionModalityTypeId', cs.section_modality_type_id))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN organization.campuses cam ON cam.code = trim(e->>'campusCode')
	JOIN academic.professors pr ON pr.code = trim(e->>'professorCode')
	JOIN core.type_groups g ON g.code = 'TG103'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = CASE upper(trim(e->>'sectionModalityTypeCode'))
		WHEN 'P' THEN 'TG103-T001'
		WHEN 'S' THEN 'TG103-T003'
		WHEN 'V' THEN 'TG103-T002'
	END
	WHERE cs.section_code = trim(e->>'sectionCode')
	  AND cs.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

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

	-- update students whose code already existed (push prior values onto the extra.uploadUndo stack)
	UPDATE academic.students s
	SET user_id = u.id,
		program_id = p.id,
		graduation_modality_type_id = tm.id,
		first_name = trim(e->>'firstName'),
		last_name = trim(e->>'lastName'),
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(s.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(s.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'userId', s.user_id, 'programId', s.program_id,
				'graduationModalityTypeId', s.graduation_modality_type_id,
				'firstName', s.first_name, 'lastName', s.last_name))
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

	-- update enrollments that already existed (push prior values onto the extra.uploadUndo stack)
	UPDATE academic.enrolled_students es
	SET campus_id = x.campus_id,
		enrollement_modality_type_id = x.modality_id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(es.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(es.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'campusId', es.campus_id,
				'enrollementModalityTypeId', es.enrollement_modality_type_id))
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

	-- update grades that already existed (push prior values onto the extra.uploadUndo stack)
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (e->>'gradeTypePercentage')::numeric,
		grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(scg.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(scg.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'gradeTypePercentage', scg.grade_type_percentage, 'grade', scg.grade))
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
CREATE OR REPLACE FUNCTION audit.fn_upload_grades_rv(
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

	-- intra-file duplicate (section, student, outcome)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode')), lower(trim(e->>'outcomeCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'outcomeCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'outcomeCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode')), lower(trim(d->>'outcomeCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int               AS row_number,
			NULLIF(trim(e->>'sectionCode'), '')  AS section_code,
			NULLIF(trim(e->>'studentCode'), '')  AS student_code,
			NULLIF(trim(e->>'outcomeCode'), '')  AS outcome_code,
			NULLIF(trim(e->>'grade'), '')        AS grade
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

		IF r.outcome_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			WHERE o.outcome_code = r.outcome_code AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotFound'::text, NULL::integer;
		END IF;

		-- the outcome must be mapped to the section's course (course_outcome_mappings on its study_plan_course)
		IF r.section_code IS NOT NULL AND r.outcome_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM accreditation.outcomes o JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id WHERE o.outcome_code = r.outcome_code AND pc.academic_period_id = p_academic_period_id)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.study_plan_courses spc_com ON spc_com.course_id = cs.course_id
			JOIN academic.course_outcome_mappings com ON com.study_plan_course_id = spc_com.id
			JOIN accreditation.outcomes o ON o.id = com.outcome_id
			JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = cs.academic_period_id
			WHERE cs.section_code = r.section_code AND o.outcome_code = r.outcome_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'outcomeNotInSection'::text, NULL::integer;
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
		(SELECT id FROM core.types WHERE code = 'TG1101-T007'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert outcome grades that do not exist yet (uniqueness = enrollment + outcome)
	INSERT INTO evidence.student_course_outcome_grades
		(student_section_enrollment_id, outcome_id, grade, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		sse.id, o.id, (e->>'grade')::numeric, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = p_academic_period_id
	WHERE NOT EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE g.student_section_enrollment_id = sse.id AND g.outcome_id = o.id
	);

	-- update outcome grades that already existed (push prior grade onto the extra.uploadUndo stack)
	UPDATE evidence.student_course_outcome_grades g
	SET grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(g.extra, '{}'::jsonb), '{uploadUndo}',
			COALESCE(g.extra->'uploadUndo', '[]'::jsonb) ||
			jsonb_build_object('logId', v_log_id, 'grade', g.grade))
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN accreditation.outcomes o ON o.outcome_code = trim(e->>'outcomeCode')
	JOIN accreditation.program_commissions opc ON opc.id = o.program_commission_id AND opc.academic_period_id = p_academic_period_id
	WHERE g.student_section_enrollment_id = sse.id
	  AND g.outcome_id = o.id
	  AND g.upload_log_id IS DISTINCT FROM v_log_id;

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
	-- Blocked when this upload's id is in a row's uploadUndo stack but is NOT the top element (a later
	-- upload updated it since), or when this upload INSERTED a row that a later upload has since updated
	-- (the inserted row carries a non-empty stack). Roll back the newer upload first.
	IF EXISTS (
		SELECT 1 FROM organization.staff s
		WHERE (s.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (s.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM organization.staff s
		WHERE s.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(s.extra->'uploadUndo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.professors p
		WHERE (p.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (p.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.professors p
		WHERE p.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(p.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore re-pointed professors by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE academic.professors p
	SET staff_id = (p.extra->'uploadUndo' -> -1 ->> 'staffId')::int,
		extra = CASE
			WHEN jsonb_array_length(p.extra->'uploadUndo') <= 1 THEN p.extra - 'uploadUndo'
			ELSE jsonb_set(p.extra, '{uploadUndo}', (p.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (p.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.professors WHERE upload_log_id = p_upload_log_id;

	-- restore updated staff by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE organization.staff s
	SET first_name = s.extra->'uploadUndo' -> -1 ->> 'firstName',
		last_name = s.extra->'uploadUndo' -> -1 ->> 'lastName',
		extra = CASE
			WHEN jsonb_array_length(s.extra->'uploadUndo') <= 1 THEN s.extra - 'uploadUndo'
			ELSE jsonb_set(s.extra, '{uploadUndo}', (s.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (s.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

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

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_outcomes(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if an outcome created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM improvement.finding_outcomes fo
		JOIN accreditation.outcomes o ON o.id = fo.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM survey.scores sc
		JOIN accreditation.outcomes o ON o.id = sc.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM survey.outcome_configs oc
		JOIN accreditation.outcomes o ON o.id = oc.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		JOIN accreditation.outcomes o ON o.id = g.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evaluation.rubric_questions rq
		JOIN accreditation.outcomes o ON o.id = rq.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		JOIN accreditation.outcomes o ON o.id = com.outcome_id
		WHERE o.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedOutcomeRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM accreditation.outcomes o
		WHERE (o.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (o.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM accreditation.outcomes o
		WHERE o.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(o.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated outcomes by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE accreditation.outcomes o
	SET outcome_name = o.extra->'uploadUndo' -> -1 -> 'outcomeName',
		outcome_description = COALESCE(o.extra->'uploadUndo' -> -1 -> 'outcomeDescription', o.outcome_description),
		extra = CASE
			WHEN jsonb_array_length(o.extra->'uploadUndo') <= 1 THEN o.extra - 'uploadUndo'
			ELSE jsonb_set(o.extra, '{uploadUndo}', (o.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (o.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM accreditation.outcomes WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_articulation(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE (com.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (com.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_outcome_mappings com
		WHERE com.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(com.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated mappings by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE academic.course_outcome_mappings com
	SET outcome_type_id = (com.extra->'uploadUndo' -> -1 ->> 'outcomeTypeId')::int,
		extra = CASE
			WHEN jsonb_array_length(com.extra->'uploadUndo') <= 1 THEN com.extra - 'uploadUndo'
			ELSE jsonb_set(com.extra, '{uploadUndo}', (com.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (com.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.course_outcome_mappings WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_sections(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if a section created by this upload is already referenced downstream
	IF EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		JOIN academic.course_sections cs ON cs.id = sse.course_section_id
		WHERE cs.upload_log_id = p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.surveys sv
		JOIN academic.course_sections cs ON cs.id = sv.course_section_id
		WHERE cs.upload_log_id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedSectionRefs';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM academic.course_sections cs
		WHERE (cs.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (cs.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.course_sections cs
		WHERE cs.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(cs.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated sections by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE academic.course_sections cs
	SET course_id = (cs.extra->'uploadUndo' -> -1 ->> 'courseId')::int,
		academic_period_id = (cs.extra->'uploadUndo' -> -1 ->> 'academicPeriodId')::int,
		campus_id = (cs.extra->'uploadUndo' -> -1 ->> 'campusId')::int,
		professor_id = (cs.extra->'uploadUndo' -> -1 ->> 'professorId')::int,
		section_modality_type_id = (cs.extra->'uploadUndo' -> -1 ->> 'sectionModalityTypeId')::int,
		extra = CASE
			WHEN jsonb_array_length(cs.extra->'uploadUndo') <= 1 THEN cs.extra - 'uploadUndo'
			ELSE jsonb_set(cs.extra, '{uploadUndo}', (cs.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (cs.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.course_sections WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
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
		WHERE (s.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (s.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.students s
		WHERE s.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(s.extra->'uploadUndo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE (es.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (es.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(es.extra->'uploadUndo', '[]'::jsonb)) > 0
	) OR EXISTS (
		SELECT 1 FROM academic.enrolled_students es
		WHERE es.upload_log_id IS DISTINCT FROM p_upload_log_id
		  AND es.student_id IN (SELECT id FROM academic.students WHERE upload_log_id = p_upload_log_id)
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated enrollments (pop), then drop inserted enrollments
	UPDATE academic.enrolled_students es
	SET campus_id = (es.extra->'uploadUndo' -> -1 ->> 'campusId')::int,
		enrollement_modality_type_id = (es.extra->'uploadUndo' -> -1 ->> 'enrollementModalityTypeId')::int,
		extra = CASE
			WHEN jsonb_array_length(es.extra->'uploadUndo') <= 1 THEN es.extra - 'uploadUndo'
			ELSE jsonb_set(es.extra, '{uploadUndo}', (es.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (es.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM academic.enrolled_students WHERE upload_log_id = p_upload_log_id;

	-- restore updated students (pop), then drop inserted students
	UPDATE academic.students s
	SET user_id = (s.extra->'uploadUndo' -> -1 ->> 'userId')::int,
		program_id = (s.extra->'uploadUndo' -> -1 ->> 'programId')::int,
		graduation_modality_type_id = (s.extra->'uploadUndo' -> -1 ->> 'graduationModalityTypeId')::int,
		first_name = s.extra->'uploadUndo' -> -1 ->> 'firstName',
		last_name = s.extra->'uploadUndo' -> -1 ->> 'lastName',
		extra = CASE
			WHEN jsonb_array_length(s.extra->'uploadUndo') <= 1 THEN s.extra - 'uploadUndo'
			ELSE jsonb_set(s.extra, '{uploadUndo}', (s.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (s.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

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
		WHERE (scg.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (scg.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(scg.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated grades by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (scg.extra->'uploadUndo' -> -1 ->> 'gradeTypePercentage')::numeric,
		grade = (scg.extra->'uploadUndo' -> -1 ->> 'grade')::numeric,
		extra = CASE
			WHEN jsonb_array_length(scg.extra->'uploadUndo') <= 1 THEN scg.extra - 'uploadUndo'
			ELSE jsonb_set(scg.extra, '{uploadUndo}', (scg.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (scg.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

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

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rv(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block out-of-order rollback: this upload must be the NEWEST that touched each row it changed.
	IF EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE (g.extra->'uploadUndo') @> jsonb_build_array(jsonb_build_object('logId', p_upload_log_id))
		  AND (g.extra->'uploadUndo' -> -1 ->> 'logId')::int <> p_upload_log_id
	) OR EXISTS (
		SELECT 1 FROM evidence.student_course_outcome_grades g
		WHERE g.upload_log_id = p_upload_log_id
		  AND jsonb_array_length(COALESCE(g.extra->'uploadUndo', '[]'::jsonb)) > 0
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore updated grades by popping this upload's (top) uploadUndo entry, then drop inserts
	UPDATE evidence.student_course_outcome_grades g
	SET grade = (g.extra->'uploadUndo' -> -1 ->> 'grade')::numeric,
		extra = CASE
			WHEN jsonb_array_length(g.extra->'uploadUndo') <= 1 THEN g.extra - 'uploadUndo'
			ELSE jsonb_set(g.extra, '{uploadUndo}', (g.extra->'uploadUndo') - (-1))
		END,
		updated_at = NOW()
	WHERE (g.extra->'uploadUndo' -> -1 ->> 'logId')::int = p_upload_log_id;

	DELETE FROM evidence.student_course_outcome_grades WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at = NOW(),
	    updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';
END;
$fn$;
`);

		// Best-effort reverse backfill: re-camelCase the keys. This is lossy in the general
		// case (any genuinely snake_case nested key in the same blob would also be camelized),
		// but in practice these rows only carry the upload undo-stack, so it round-trips.
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.camel_case_jsonb_keys(data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $helper$
DECLARE
	result jsonb;
	k text;
	v jsonb;
	ck text;
BEGIN
	IF data IS NULL OR jsonb_typeof(data) = 'null' THEN
		RETURN data;
	ELSIF jsonb_typeof(data) = 'array' THEN
		RETURN COALESCE(
			(SELECT jsonb_agg(audit.camel_case_jsonb_keys(elem)) FROM jsonb_array_elements(data) AS elem),
			'[]'::jsonb
		);
	ELSIF jsonb_typeof(data) = 'object' THEN
		result := '{}'::jsonb;
		FOR k, v IN SELECT * FROM jsonb_each(data) LOOP
			-- camelCase the key: title-case each underscore-separated word, join, then lowercase
			-- the first letter. (Postgres regexp_replace cannot uppercase a backreference.)
			ck := replace(initcap(replace(k, '_', ' ')), ' ', '');
			ck := lower(left(ck, 1)) || substring(ck FROM 2);
			result := result || jsonb_build_object(ck, audit.camel_case_jsonb_keys(v));
		END LOOP;
		RETURN result;
	ELSE
		RETURN data;
	END IF;
END;
$helper$;
`);

		await queryRunner.query(`
UPDATE organization.staff
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE academic.professors
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE organization.charts
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE accreditation.outcomes
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE academic.course_outcome_mappings
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE academic.course_sections
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE academic.students
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE academic.enrolled_students
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE academic.student_course_grades
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);
		await queryRunner.query(`
UPDATE evidence.student_course_outcome_grades
SET extra = audit.camel_case_jsonb_keys(extra)
WHERE extra ?| array['upload_undo', 'upload_node_code'];
`);

		await queryRunner.query(`
DROP FUNCTION IF EXISTS audit.camel_case_jsonb_keys(jsonb);
`);
	}
}
