import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetFixedMaxOutcomeOnBulkGradeUpload1782757728260 implements MigrationInterface {
	name = 'SetFixedMaxOutcomeOnBulkGradeUpload1782757728260';

	public async up(queryRunner: QueryRunner): Promise<void> {
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
	-- max_outcome is fixed at 2 for grades loaded via bulk upload (not computed from rubric criteria/performance levels)
	INSERT INTO evidence.student_course_outcome_grades
		(student_section_enrollment_id, outcome_id, grade, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT
		sse.id, o.id, (e->>'grade')::numeric, v_log_id, '{"max_outcome": 2}'::jsonb, true, NOW(), NOW()
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

	-- update outcome grades that already existed (push prior grade onto the extra.uploadUndo stack, fix max_outcome at 2)
	UPDATE evidence.student_course_outcome_grades g
	SET grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = jsonb_set(
			jsonb_set(COALESCE(g.extra, '{}'::jsonb), '{uploadUndo}',
				COALESCE(g.extra->'uploadUndo', '[]'::jsonb) ||
				jsonb_build_object('logId', v_log_id, 'grade', g.grade)),
			'{max_outcome}', '2'::jsonb)
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
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
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
	}
}
