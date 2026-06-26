import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * A study plan is now identified by (program, academic period) instead of by its code:
 *
 * 1. study_plan_academic_periods gains a UNIQUE (study_plan_id, academic_period_id) constraint so a
 *    plan can be linked to a given period at most once. The upload function already looks the link
 *    up before inserting, so the constraint only hardens an invariant the code maintains.
 *
 * 2. fn_upload_study_plans is rewritten around that identity. The first upload for a (program,
 *    period) creates the plan from the file's study-plan code/name; any later upload for a program
 *    that already has a plan in that period REUSES it and only appends courses — the file's
 *    study-plan code/name are ignored. The single re-upload constraint is that a course code must
 *    not already be in that program's plan for the period ('courseAlreadyInStudyPlan'). Because the
 *    global UNIQUE (code) on study_plans is kept, creating a plan with a code already taken (in the
 *    DB or shared by two programs in the same file) now returns a graceful per-row error
 *    ('studyPlanCodeExists' / 'studyPlanCodeConflictInFile') instead of a 500.
 *
 * 3. enrolled_students.study_plan_academic_period is renamed to study_plan_academic_period_id and
 *    given a real FK to study_plan_academic_periods(id). The two upload functions that touch the
 *    column (fn_upload_enrolled_students, fn_upload_student_sections) are recreated with the new name.
 *
 * Forward-only in production: down() restores the previous (code-keyed) function body, drops the
 * uniqueness constraint, and reverts the enrolled_students rename / FK / functions.
 */
export class StudyPlanIdentityByProgramPeriod1782450894117 implements MigrationInterface {
	name = 'StudyPlanIdentityByProgramPeriod1782450894117';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_academic_periods" ADD CONSTRAINT "UQ_study_plan_academic_periods_plan_period" UNIQUE ("study_plan_id", "academic_period_id")`,
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
	-- A study plan is identified by (program, academic period). A re-upload for a program that
	-- already has a plan in this period reuses that plan (the file's study-plan code/name are
	-- ignored) and only appends courses; the first upload for a (program, period) creates the plan
	-- from the file's study-plan code/name.

	-- intra-file duplicate: same program + course (the plan is keyed by program for this period)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS row_number
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'programCode')), lower(trim(e->>'courseCode'))) IN (
			SELECT lower(trim(d->>'programCode')), lower(trim(d->>'courseCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'programCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'courseCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'programCode')), lower(trim(d->>'courseCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.row_number, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- intra-file conflict: a single study-plan code shared by more than one program (code is global)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS row_number
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'studyPlanCode'), '') IS NOT NULL
		  AND lower(trim(e->>'studyPlanCode')) IN (
			SELECT lower(trim(d->>'studyPlanCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'studyPlanCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'programCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'studyPlanCode'))
			HAVING count(DISTINCT lower(trim(d->>'programCode'))) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.row_number, 'studyPlanCodeConflictInFile'::text, NULL::integer;
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

		-- When this upload would CREATE the plan (no plan yet for program+period), the study-plan code
		-- must be free, since study_plans.code is globally unique.
		IF r.study_plan_code IS NOT NULL AND r.program_code IS NOT NULL
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_academic_periods spap
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.programs p ON p.id = sp.program_id
			WHERE p.code = r.program_code AND spap.academic_period_id = p_academic_period_id
		   )
		   AND EXISTS (SELECT 1 FROM academic.study_plans sp WHERE sp.code = r.study_plan_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanCodeExists'::text, NULL::integer;
		END IF;

		-- The single re-upload constraint: the course must not already be in this program's plan for
		-- the period (the plan is matched by program + period, not by the file's study-plan code).
		IF r.program_code IS NOT NULL AND r.course_code IS NOT NULL AND EXISTS (
			SELECT 1
			FROM academic.study_plan_courses spc
			JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			JOIN academic.programs pr ON pr.id = sp.program_id
			JOIN academic.courses c ON c.id = spc.course_id
			WHERE spap.academic_period_id = p_academic_period_id
			  AND pr.code = r.program_code
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

	-- Create a plan only for programs that do not yet have one in this period (the file's study-plan
	-- code/name seed it). DISTINCT ON (program) picks one code/name per program.
	WITH plan_src AS (
		SELECT DISTINCT ON (p.id)
			p.id                                     AS program_id,
			trim(e->>'studyPlanCode')                AS code,
			COALESCE(e->'studyPlanName','{}'::jsonb) AS name
		FROM jsonb_array_elements(p_rows) AS e
		JOIN academic.programs p ON p.code = trim(e->>'programCode')
		WHERE NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_academic_periods spap
			JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			WHERE sp.program_id = p.id AND spap.academic_period_id = p_academic_period_id
		)
	)
	INSERT INTO academic.study_plans (program_id, code, name, description, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT s.program_id, s.code, s.name, '{}'::jsonb, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM plan_src s;

	-- Link the just-created plans to this period (existing plans already carry their period link).
	-- The existence check keeps the (study_plan_id, academic_period_id) uniqueness intact.
	INSERT INTO academic.study_plan_academic_periods (study_plan_id, academic_period_id, extra, is_active, created_at, updated_at)
	SELECT DISTINCT sp.id, p_academic_period_id, '{}'::jsonb, true, NOW(), NOW()
	FROM academic.study_plans sp
	WHERE sp.upload_log_id = v_log_id
	  AND NOT EXISTS (
		SELECT 1 FROM academic.study_plan_academic_periods x
		WHERE x.study_plan_id = sp.id AND x.academic_period_id = p_academic_period_id
	);

	-- Courses are shared globally by code (reused across plans/periods).
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

	-- Attach each row's course to the (program, period) plan, resolved via its period link.
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
	JOIN academic.programs p ON p.code = trim(e->>'programCode')
	JOIN academic.study_plan_academic_periods spap ON spap.academic_period_id = p_academic_period_id
	JOIN academic.study_plans sp ON sp.id = spap.study_plan_id AND sp.program_id = p.id
	JOIN academic.courses c ON c.code = trim(e->>'courseCode')
	JOIN core.type_groups g ON g.code = 'TG203'
	JOIN core.types t ON t.type_group_id = g.id AND (t.extra->>'level')::int = NULLIF(trim(e->>'level'), '')::int;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		// enrolled_students.study_plan_academic_period was a FK-by-id column misnamed without the _id
		// suffix and carrying no foreign key; rename it and add the FK.
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" RENAME COLUMN "study_plan_academic_period" TO "study_plan_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" ADD CONSTRAINT "FK_enrolled_students_study_plan_academic_period_id" FOREIGN KEY ("study_plan_academic_period_id") REFERENCES "academic"."study_plan_academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		// recreate the two upload functions that read/write the renamed column
		await queryRunner.query(ENROLLED_STUDENTS_FN('study_plan_academic_period_id'));
		await queryRunner.query(STUDENT_SECTIONS_FN('study_plan_academic_period_id'));
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(STUDENT_SECTIONS_FN('study_plan_academic_period'));
		await queryRunner.query(ENROLLED_STUDENTS_FN('study_plan_academic_period'));
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" DROP CONSTRAINT "FK_enrolled_students_study_plan_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "academic"."enrolled_students" RENAME COLUMN "study_plan_academic_period_id" TO "study_plan_academic_period"`,
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

		await queryRunner.query(
			`ALTER TABLE "academic"."study_plan_academic_periods" DROP CONSTRAINT "UQ_study_plan_academic_periods_plan_period"`,
		);
	}
}

// The enrolled_students FK column name is the only thing that changes between up/down, so both
// upload function bodies are parameterized on it (`col`).
const ENROLLED_STUDENTS_FN = (col: string) => `
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
		(student_id, ${col}, campus_id, enrollement_modality_type_id, upload_log_id,
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
		WHERE es.student_id = x.student_id AND es.${col} = x.spap_id
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
	  AND es.${col} = x.spap_id
	  AND es.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`;

const STUDENT_SECTIONS_FN = (col: string) => `
CREATE OR REPLACE FUNCTION audit.fn_upload_student_sections(
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

	-- intra-file duplicate (section, student)
	FOR r IN
		SELECT (e->>'rowNumber')::int AS rn
		FROM jsonb_array_elements(p_rows) AS e
		WHERE (lower(trim(e->>'sectionCode')), lower(trim(e->>'studentCode'))) IN (
			SELECT lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode'))
			FROM jsonb_array_elements(p_rows) AS d
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			GROUP BY lower(trim(d->>'sectionCode')), lower(trim(d->>'studentCode'))
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile'::text, NULL::integer;
	END LOOP;

	-- per-row validation
	FOR r IN
		SELECT
			(e->>'rowNumber')::int              AS row_number,
			NULLIF(trim(e->>'sectionCode'), '') AS section_code,
			NULLIF(trim(e->>'studentCode'), '') AS student_code
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

		-- the student must be enrolled in the SAME study_plan_academic_period as the section
		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections cs WHERE cs.section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.students st ON st.code = r.student_code
			JOIN academic.enrolled_students es ON es.student_id = st.id
			JOIN academic.study_plan_academic_periods spap_es
				ON spap_es.id = es.${col} AND spap_es.academic_period_id = cs.academic_period_id
			WHERE cs.section_code = r.section_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanPeriodMismatch'::text, NULL::integer;

		-- the section's course must belong to the student's study plan
		ELSIF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.students st ON st.code = r.student_code
			JOIN academic.enrolled_students es ON es.student_id = st.id
			JOIN academic.study_plan_academic_periods spap_es
				ON spap_es.id = es.${col} AND spap_es.academic_period_id = cs.academic_period_id
			JOIN academic.study_plan_courses spc
				ON spc.study_plan_academic_period_id = spap_es.id AND spc.course_id = cs.course_id
			WHERE cs.section_code = r.section_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNotInStudyPlan'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T010'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	-- insert enrollments that do not exist yet (uniqueness = enrolled_student + course_section)
	INSERT INTO academic.student_section_enrollments
		(enrolled_student_id, course_section_id, upload_log_id, extra, is_active, created_at, updated_at)
	SELECT es.id, cs.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.students st ON st.code = trim(e->>'studentCode')
	JOIN academic.enrolled_students es ON es.student_id = st.id
	JOIN academic.study_plan_academic_periods spap_es
		ON spap_es.id = es.${col} AND spap_es.academic_period_id = cs.academic_period_id
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap_es.id AND spc.course_id = cs.course_id
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		WHERE sse.enrolled_student_id = es.id AND sse.course_section_id = cs.id
	);

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`;
