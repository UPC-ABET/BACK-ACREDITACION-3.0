import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Two unrelated, not-yet-applied schema/logic changes bundled into one migration:
 *
 * 1. Student-section upload validation: a student may only be enrolled in a section
 *    whose course belongs to the student's study plan. fn_upload_student_sections
 *    already rejected a student that is not enrolled in the same
 *    study_plan_academic_period as the section ('studyPlanPeriodMismatch'); this adds a
 *    second check that the section's course is one of that study plan's courses
 *    ('courseNotInStudyPlan'). The check fires only when the period already matches, so
 *    a student missing the plan/period gets a single 'studyPlanPeriodMismatch' rather
 *    than both errors. The final INSERT gains the same study_plan_courses join so it can
 *    never insert a course outside the plan.
 *
 * 2. IFC notification configs are no longer scoped by school or academic period: a
 *    single config per (trigger, ifc_status) applies globally. Drop the school_id /
 *    academic_period_id columns (and their FKs), and replace the composite uniqueness
 *    with (trigger_type_id, ifc_status_type_id). down() re-adds the columns as NULLABLE:
 *    the original NOT NULL values cannot be recovered after the drop, and nullable
 *    columns keep both the FKs and the restored composite unique constraint valid on any
 *    existing rows.
 */
export class AddCourseInStudyPlanUploadValidation1781827357053 implements MigrationInterface {
	name = 'AddCourseInStudyPlanUploadValidation1781827357053';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
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
				ON spap_es.id = es.study_plan_academic_period AND spap_es.academic_period_id = cs.academic_period_id
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
				ON spap_es.id = es.study_plan_academic_period AND spap_es.academic_period_id = cs.academic_period_id
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
		ON spap_es.id = es.study_plan_academic_period AND spap_es.academic_period_id = cs.academic_period_id
	JOIN academic.study_plan_courses spc
		ON spc.study_plan_academic_period_id = spap_es.id AND spc.course_id = cs.course_id
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		WHERE sse.enrolled_student_id = es.id AND sse.course_section_id = cs.id
	);

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_notification_configs_school_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "FK_notification_configs_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "UQ_notification_configs_school_period_trigger_status"`,
		);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_configs" DROP COLUMN "school_id"`);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP COLUMN "academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "UQ_notification_configs_trigger_status" UNIQUE ("trigger_type_id", "ifc_status_type_id")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" DROP CONSTRAINT "UQ_notification_configs_trigger_status"`,
		);
		await queryRunner.query(`ALTER TABLE "ifc"."notification_configs" ADD "school_id" integer`);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD "academic_period_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_notification_configs_school_id" FOREIGN KEY ("school_id") REFERENCES "organization"."schools"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "FK_notification_configs_academic_period_id" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ifc"."notification_configs" ADD CONSTRAINT "UQ_notification_configs_school_period_trigger_status" UNIQUE ("school_id", "academic_period_id", "trigger_type_id", "ifc_status_type_id")`,
		);

		await queryRunner.query(`
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
				ON spap_es.id = es.study_plan_academic_period AND spap_es.academic_period_id = cs.academic_period_id
			WHERE cs.section_code = r.section_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studyPlanPeriodMismatch'::text, NULL::integer;
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
		ON spap_es.id = es.study_plan_academic_period AND spap_es.academic_period_id = cs.academic_period_id
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		WHERE sse.enrolled_student_id = es.id AND sse.course_section_id = cs.id
	);

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);
	}
}
