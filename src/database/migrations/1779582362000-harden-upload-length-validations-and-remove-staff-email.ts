import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Two related hardening changes to the bulk-upload pipeline:
 *
 * 1. academic.study_plans.code was character varying(10) — an outlier; every other code
 *    column is varchar(50). Real study-plan codes (e.g. "01-202601-CC", 12 chars) overflowed
 *    it, and the Postgres 22001 ("value too long") surfaced as an HTTP 500 instead of a
 *    graceful per-row error. Widened to varchar(20).
 *
 * 2. Every audit.fn_upload_* function that inserts into a bounded varchar column now validates
 *    the incoming string length up-front and returns a field-specific *TooLong error_code
 *    (annotated back into the error Excel), so an over-long value is reported per-row instead
 *    of aborting the whole load with a 500. char_length(NULL) is NULL, so these checks never
 *    fire for empty values — the existing *Empty checks still own that case.
 *
 * 3. The staff upload no longer carries an email column. Staff identity is now keyed on the
 *    professor code: a row whose professor code already exists updates that professor's staff
 *    in place; everyone else inserts a fresh (user-less) staff. (Previously email matched the
 *    staff to a user; that linkage is dropped.)
 *
 * Forward-only in production: down() restores the original function bodies and the varchar(10)
 * width (the narrowing can fail if longer codes were stored meanwhile — acceptable for a
 * rollback that is not expected to run in prod).
 */
export class HardenUploadLengthValidationsAndRemoveStaffEmail1779582362000 implements MigrationInterface {
	name = 'HardenUploadLengthValidationsAndRemoveStaffEmail1779582362000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plans" ALTER COLUMN "code" TYPE character varying(20)`,
		);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_study_plans(
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

	FOR r IN
		SELECT (e->>'rowNumber')::int AS row_number
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (trim(e->>'studyPlanCode'), lower(trim(e->>'courseCode'))) IN (
			SELECT trim(d->>'studyPlanCode'), lower(trim(d->>'courseCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'studyPlanCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'courseCode'), '') IS NOT NULL
			GROUP BY trim(d->>'studyPlanCode'), lower(trim(d->>'courseCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.row_number, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	FOR r IN
		SELECT
			(e->>'rowNumber')::int                AS row_number,
			NULLIF(trim(e->>'studyPlanCode'), '') AS study_plan_code,
			NULLIF(trim(e->>'programCode'), '')   AS program_code,
			NULLIF(trim(e->>'level'), '')         AS level,
			NULLIF(trim(e->>'courseCode'), '')    AS course_code,
			COALESCE(e->'courseName', '{}'::jsonb) AS course_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.study_plan_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.study_plan_code) > 20 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeTooLong'::text, NULL::integer;
		END IF;

		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		END IF;

		IF char_length(r.course_code) > 50 THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeTooLong'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.course_name) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNameEmpty'::text, NULL::integer;
		END IF;

		IF r.level IS NULL OR r.level !~ '^\\d+$' OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG203' AND (t.extra->>'level')::int = r.level::int
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'levelTypeInvalid'::text, NULL::integer;
		END IF;

		IF r.study_plan_code IS NOT NULL AND r.course_code IS NOT NULL AND EXISTS (
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
			RETURN QUERY SELECT r.row_number, 'courseAlreadyInStudyPlan'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T002'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	WITH plan_src AS (
		SELECT DISTINCT ON (e->>'studyPlanCode')
			trim(e->>'studyPlanCode')                AS code,
			COALESCE(e->'studyPlanName','{}'::jsonb) AS name,
			(SELECT p.id FROM academic.programs p WHERE p.code = trim(e->>'programCode')) AS program_id
		FROM jsonb_array_elements(p_rows) AS e
	)
	INSERT INTO academic.study_plans (program_id, code, name, description, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT s.program_id, s.code, s.name, '{}'::jsonb, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM plan_src s
	ON CONFLICT (code) DO NOTHING;

	INSERT INTO academic.study_plan_academic_periods (study_plan_id, academic_period_id, extra, is_active, created_at, updated_at)
	SELECT DISTINCT sp.id, p_academic_period_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.study_plan_academic_periods x
		WHERE x.study_plan_id = sp.id AND x.academic_period_id = p_academic_period_id
	);

	WITH course_src AS (
		SELECT DISTINCT ON (lower(trim(e->>'courseCode')))
			trim(e->>'courseCode')                     AS code,
			COALESCE(e->'courseName','{}'::jsonb)      AS name,
			COALESCE(e->'learningOutcome','{}'::jsonb) AS learning_outcome
		FROM jsonb_array_elements(p_rows) AS e
	)
	INSERT INTO academic.courses (code, name, description, learning_outcome, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT c.code, c.name, '{}'::jsonb, c.learning_outcome, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM course_src c
	ON CONFLICT (code) DO NOTHING;

	INSERT INTO academic.study_plan_courses
		(study_plan_academic_period_id, course_id, is_elective, level_type_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		spap.id,
		c.id,
		COALESCE((e->>'isElective')::boolean, false),
		t.id,
		v_log_id,
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN core.type_groups g ON g.code = 'TG203'
	JOIN core.types t ON t.type_group_id = g.id AND (t.extra->>'level')::int = NULLIF(trim(e->>'level'), '')::int;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

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
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
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

		IF r.last_name IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'lastNameEmpty'::text, NULL::integer;
		END IF;

		IF r.first_name IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'firstNameEmpty'::text, NULL::integer;
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
	v_user_id integer;
	v_staff_id integer;
	v_prof_id integer;
	r record;
BEGIN
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate email
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE lower(trim(e->>'email')) IN (
			SELECT lower(trim(d->>'email'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'email'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'email'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateEmailInFile'::text, NULL::integer;
	END LOOP;

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
			NULLIF(trim(e->>'email'), '')           AS email,
			NULLIF(trim(e->>'lastName'), '')        AS last_name,
			NULLIF(trim(e->>'firstName'), '')       AS first_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		-- email is optional; only when present must it resolve to a user.
		IF r.email IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM organization.users u WHERE lower(u.email) = lower(r.email)
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'userNotFound'::text, NULL::integer;
		END IF;

		IF r.last_name IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'lastNameEmpty'::text, NULL::integer;
		END IF;

		IF r.first_name IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'firstNameEmpty'::text, NULL::integer;
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

	-- Row-by-row because the staff target depends on the optional email: rows with an email upsert
	-- the matching user's staff, rows without one always insert a new (user-less) staff. The professor,
	-- when a code is given, must point at exactly the staff resolved for that same row, which a set-based
	-- statement cannot key on for the user-less inserts.
	FOR r IN
		SELECT
			NULLIF(trim(e->>'email'), '')         AS email,
			NULLIF(trim(e->>'professorCode'), '') AS professor_code,
			trim(e->>'lastName')                  AS last_name,
			trim(e->>'firstName')                 AS first_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		v_user_id := NULL;
		v_staff_id := NULL;

		IF r.email IS NOT NULL THEN
			SELECT u.id INTO v_user_id
			FROM organization.users u
			WHERE lower(u.email) = lower(r.email)
			ORDER BY u.id LIMIT 1;

			SELECT s.id INTO v_staff_id
			FROM organization.staff s
			WHERE s.user_id = v_user_id
			ORDER BY s.id LIMIT 1;
		END IF;

		IF v_staff_id IS NULL THEN
			INSERT INTO organization.staff
				(user_id, first_name, last_name, upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (v_user_id, r.first_name, r.last_name, v_log_id, '{}'::jsonb, true, NOW(), NOW())
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

		IF r.professor_code IS NOT NULL THEN
			SELECT p.id INTO v_prof_id
			FROM academic.professors p
			WHERE p.code = r.professor_code
			LIMIT 1;

			IF v_prof_id IS NULL THEN
				INSERT INTO academic.professors
					(staff_id, code, upload_log_id, extra, is_active, created_at, updated_at)
				VALUES (v_staff_id, r.professor_code, v_log_id, '{}'::jsonb, true, NOW(), NOW());
			ELSE
				UPDATE academic.professors p
				SET staff_id = v_staff_id,
					updated_at = NOW(),
					extra = jsonb_set(COALESCE(p.extra, '{}'::jsonb), '{uploadUndo}',
						COALESCE(p.extra->'uploadUndo', '[]'::jsonb) ||
						jsonb_build_object('logId', v_log_id, 'staffId', p.staff_id))
				WHERE p.id = v_prof_id;
			END IF;
		END IF;
	END LOOP;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_study_plans(
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

	FOR r IN
		SELECT (e->>'rowNumber')::int AS row_number
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (trim(e->>'studyPlanCode'), lower(trim(e->>'courseCode'))) IN (
			SELECT trim(d->>'studyPlanCode'), lower(trim(d->>'courseCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'studyPlanCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'courseCode'), '') IS NOT NULL
			GROUP BY trim(d->>'studyPlanCode'), lower(trim(d->>'courseCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.row_number, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	FOR r IN
		SELECT
			(e->>'rowNumber')::int                AS row_number,
			NULLIF(trim(e->>'studyPlanCode'), '') AS study_plan_code,
			NULLIF(trim(e->>'programCode'), '')   AS program_code,
			NULLIF(trim(e->>'level'), '')         AS level,
			NULLIF(trim(e->>'courseCode'), '')    AS course_code,
			COALESCE(e->'courseName', '{}'::jsonb) AS course_name
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.study_plan_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeEmpty'::text, NULL::integer;
		END IF;

		IF r.program_code IS NULL OR NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		END IF;

		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		END IF;

		IF NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.course_name) AS kv(k, v) WHERE NULLIF(trim(kv.v), '') IS NOT NULL) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNameEmpty'::text, NULL::integer;
		END IF;

		IF r.level IS NULL OR r.level !~ '^\\d+$' OR NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG203' AND (t.extra->>'level')::int = r.level::int
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'levelTypeInvalid'::text, NULL::integer;
		END IF;

		IF r.study_plan_code IS NOT NULL AND r.course_code IS NOT NULL AND EXISTS (
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
			RETURN QUERY SELECT r.row_number, 'courseAlreadyInStudyPlan'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T002'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	WITH plan_src AS (
		SELECT DISTINCT ON (e->>'studyPlanCode')
			trim(e->>'studyPlanCode')                AS code,
			COALESCE(e->'studyPlanName','{}'::jsonb) AS name,
			(SELECT p.id FROM academic.programs p WHERE p.code = trim(e->>'programCode')) AS program_id
		FROM jsonb_array_elements(p_rows) AS e
	)
	INSERT INTO academic.study_plans (program_id, code, name, description, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT s.program_id, s.code, s.name, '{}'::jsonb, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM plan_src s
	ON CONFLICT (code) DO NOTHING;

	INSERT INTO academic.study_plan_academic_periods (study_plan_id, academic_period_id, extra, is_active, created_at, updated_at)
	SELECT DISTINCT sp.id, p_academic_period_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.study_plan_academic_periods x
		WHERE x.study_plan_id = sp.id AND x.academic_period_id = p_academic_period_id
	);

	WITH course_src AS (
		SELECT DISTINCT ON (lower(trim(e->>'courseCode')))
			trim(e->>'courseCode')                     AS code,
			COALESCE(e->'courseName','{}'::jsonb)      AS name,
			COALESCE(e->'learningOutcome','{}'::jsonb) AS learning_outcome
		FROM jsonb_array_elements(p_rows) AS e
	)
	INSERT INTO academic.courses (code, name, description, learning_outcome, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT c.code, c.name, '{}'::jsonb, c.learning_outcome, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM course_src c
	ON CONFLICT (code) DO NOTHING;

	INSERT INTO academic.study_plan_courses
		(study_plan_academic_period_id, course_id, is_elective, level_type_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT
		spap.id,
		c.id,
		COALESCE((e->>'isElective')::boolean, false),
		t.id,
		v_log_id,
		'{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.study_plans sp ON sp.code = trim(e->>'studyPlanCode')
	JOIN academic.study_plan_academic_periods spap
		ON spap.study_plan_id = sp.id AND spap.academic_period_id = p_academic_period_id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN core.type_groups g ON g.code = 'TG203'
	JOIN core.types t ON t.type_group_id = g.id AND (t.extra->>'level')::int = NULLIF(trim(e->>'level'), '')::int;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(
			`ALTER TABLE "academic"."study_plans" ALTER COLUMN "code" TYPE character varying(10)`,
		);
	}
}
