import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProgramCodeToRubricsUpload1781632319244 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_rubrics(
	p_rows               jsonb,
	p_academic_period_id integer,
	p_user_id            integer,
	p_source_file        text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total         integer := jsonb_array_length(p_rows);
	v_has_errors    boolean := false;
	v_log_id        integer;
	v_rubric_id     integer;
	v_question_id   integer;
	v_spc_id        integer;
	v_grade_type_id integer;
	v_rubric_type_id integer;
	v_capstone_type_id integer;
	v_eb_grade_type_id integer;
	v_verification_outcome_type_id integer;
	v_is_capstone   boolean;
	v_is_eb         boolean;
	v_is_capstone_eb boolean;
	r               record;
	r_rub           record;
	r_q             record;
	r_c             record;
	v_min_prev      numeric;
	v_max_prev      numeric;
	v_total_max     numeric;
BEGIN
	-- Resolve fixed type IDs once
	SELECT id INTO v_capstone_type_id      FROM core.types WHERE code = 'TG401-T001';
	SELECT id INTO v_eb_grade_type_id      FROM core.types WHERE code = 'TG205-T002';
	SELECT id INTO v_verification_outcome_type_id FROM core.types WHERE code = 'TG302-T001';

	-- ── Phase 1: per-row structural validation ────────────────────────
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                        AS row_number,
			NULLIF(trim(e->>'courseCode'), '')            AS course_code,
			NULLIF(trim(e->>'programCode'), '')           AS program_code,
			NULLIF(trim(e->>'gradeTypeCode'), '')         AS grade_type_code,
			NULLIF(trim(e->>'criteriaEs'), '')            AS criteria_es,
			NULLIF(trim(e->>'criteriaEn'), '')            AS criteria_en,
			e->>'minValue'                                AS min_value_raw,
			e->>'maxValue'                                AS max_value_raw
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.program_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programCodeEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.grade_type_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeCodeEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.criteria_es IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'criteriaEsEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.criteria_en IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'criteriaEnEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- minValue/maxValue are optional (default 0 for CAPSTONE+EB); validate only if provided
		IF r.min_value_raw IS NOT NULL AND r.min_value_raw != ''
		   AND NOT r.min_value_raw ~ '^-?[0-9]+([.][0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'minValueInvalid'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.max_value_raw IS NOT NULL AND r.max_value_raw != ''
		   AND NOT r.max_value_raw ~ '^-?[0-9]+([.][0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'maxValueInvalid'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF (r.min_value_raw IS NOT NULL AND r.min_value_raw != '')
		   AND (r.max_value_raw IS NOT NULL AND r.max_value_raw != '')
		   AND r.min_value_raw::numeric > r.max_value_raw::numeric THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'minValueGreaterThanMax'::text, NULL::integer;
			CONTINUE;
		END IF;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	-- ── Phase 2: per-rubric cross-DB validation ───────────────────────
	FOR r_rub IN
		SELECT
			trim(e->>'courseCode')     AS course_code,
			trim(e->>'programCode')    AS program_code,
			trim(e->>'gradeTypeCode')  AS grade_type_code,
			MIN((e->>'rowNumber')::int) AS first_row
		FROM jsonb_array_elements(p_rows) AS e
		GROUP BY trim(e->>'courseCode'), trim(e->>'programCode'), trim(e->>'gradeTypeCode')
	LOOP
		-- Validate program exists
		IF NOT EXISTS (SELECT 1 FROM academic.programs WHERE code = r_rub.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'programNotFound'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- Validate gradeType exists
		SELECT id INTO v_grade_type_id FROM core.types WHERE code = r_rub.grade_type_code;
		IF v_grade_type_id IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'gradeTypeNotFound'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- Resolve study_plan_course for this course + program + academic period
		SELECT spc.id INTO v_spc_id
		FROM academic.study_plan_courses spc
		JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
		JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
		JOIN academic.programs p ON p.id = sp.program_id
		JOIN academic.courses c ON c.id = spc.course_id
		WHERE spap.academic_period_id = p_academic_period_id
		  AND c.code = r_rub.course_code
		  AND p.code = r_rub.program_code
		LIMIT 1;

		IF v_spc_id IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'courseNotFound'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- Check duplicate rubric
		IF EXISTS (
			SELECT 1 FROM evaluation.rubrics rb
			WHERE rb.study_plan_course_id = v_spc_id
			  AND rb.grade_type_id = v_grade_type_id
			  AND rb.is_active = true
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'rubricAlreadyExists'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- Resolve rubric type (CAPSTONE if course has verification outcomes AND gradeType is EA or EB)
		v_is_capstone := false;
		IF v_grade_type_id = v_eb_grade_type_id
		   OR EXISTS (SELECT 1 FROM core.types WHERE id = v_grade_type_id AND code = 'TG205-T001')
		THEN
			IF EXISTS (
				SELECT 1 FROM academic.course_outcome_mappings com
				WHERE com.study_plan_course_id = v_spc_id
				  AND com.outcome_type_id = v_verification_outcome_type_id
			) THEN
				v_is_capstone := true;
			END IF;
		END IF;

		v_is_eb         := v_grade_type_id = v_eb_grade_type_id;
		v_is_capstone_eb := v_is_capstone AND v_is_eb;

		-- For CAPSTONE+EB: all questions must have outcomeCode
		IF v_is_capstone_eb THEN
			IF EXISTS (
				SELECT 1 FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND NULLIF(trim(e->>'outcomeCode'), '') IS NULL
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_rub.first_row, 'outcomeRequiredCapstoneEb'::text, NULL::integer;
				CONTINUE;
			END IF;
		END IF;

		-- For non-CAPSTONE+EB: questionEs required
		IF NOT v_is_capstone_eb THEN
			IF EXISTS (
				SELECT 1 FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND NULLIF(trim(e->>'questionEs'), '') IS NULL
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_rub.first_row, 'questionRequiredNonCapstone'::text, NULL::integer;
				CONTINUE;
			END IF;
		END IF;

		-- Validate outcomeCodes if provided
		IF EXISTS (
			SELECT 1 FROM jsonb_array_elements(p_rows) AS e
			WHERE trim(e->>'courseCode') = r_rub.course_code
			  AND trim(e->>'programCode') = r_rub.program_code
			  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
			  AND NULLIF(trim(e->>'outcomeCode'), '') IS NOT NULL
		) THEN
			FOR r IN
				SELECT DISTINCT trim(e->>'outcomeCode') AS outcome_code,
				       MIN((e->>'rowNumber')::int)      AS first_row
				FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND NULLIF(trim(e->>'outcomeCode'), '') IS NOT NULL
				GROUP BY trim(e->>'outcomeCode')
			LOOP
				IF NOT EXISTS (
					SELECT 1
					FROM academic.course_outcome_mappings com
					JOIN accreditation.outcomes o ON o.id = com.outcome_id
					WHERE com.study_plan_course_id = v_spc_id
					  AND o.outcome_code = r.outcome_code
				) THEN
					v_has_errors := true;
					RETURN QUERY SELECT r.first_row, 'outcomeNotFound'::text, NULL::integer;
				END IF;
			END LOOP;
		END IF;

		-- For non-CAPSTONE+EB: validate criteria per question (no overlap, sum max = 20)
		IF NOT v_is_capstone_eb THEN
			FOR r_q IN
				SELECT
					NULLIF(trim(e->>'outcomeCode'), '')  AS outcome_code,
					NULLIF(trim(e->>'questionEs'), '')   AS question_es,
					MIN((e->>'rowNumber')::int)          AS first_row
				FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				GROUP BY NULLIF(trim(e->>'outcomeCode'), ''), NULLIF(trim(e->>'questionEs'), '')
			LOOP
				v_min_prev := NULL;
				v_max_prev := NULL;

				FOR r_c IN
					SELECT
						(e->>'rowNumber')::int AS row_number,
						COALESCE(NULLIF(trim(e->>'minValue'), ''), '0')::numeric AS min_val,
						COALESCE(NULLIF(trim(e->>'maxValue'), ''), '0')::numeric AS max_val
					FROM jsonb_array_elements(p_rows) AS e
					WHERE trim(e->>'courseCode') = r_rub.course_code
					  AND trim(e->>'programCode') = r_rub.program_code
					  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
					  AND (
					    (r_q.question_es IS NOT NULL AND NULLIF(trim(e->>'questionEs'), '') = r_q.question_es)
					    OR
					    (r_q.outcome_code IS NOT NULL AND NULLIF(trim(e->>'outcomeCode'), '') = r_q.outcome_code)
					  )
					ORDER BY (e->>'minValue')::numeric ASC
				LOOP
					IF v_max_prev IS NOT NULL AND r_c.min_val <= v_max_prev THEN
						v_has_errors := true;
						RETURN QUERY SELECT r_c.row_number, 'criteriaOverlap'::text, NULL::integer;
					END IF;
					v_min_prev := r_c.min_val;
					v_max_prev := r_c.max_val;
				END LOOP;
			END LOOP;

			-- Validate sum of max per question = 20
			SELECT COALESCE(SUM(q_max), 0) INTO v_total_max
			FROM (
				SELECT MAX(COALESCE(NULLIF(trim(e->>'maxValue'), ''), '0')::numeric) AS q_max
				FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				GROUP BY NULLIF(trim(e->>'outcomeCode'), ''), NULLIF(trim(e->>'questionEs'), '')
			) sub;

			IF ROUND(v_total_max::numeric, 6) != 20 THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_rub.first_row, 'criteriaTotalNot20'::text, NULL::integer;
			END IF;
		END IF;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	-- ── Phase 3: Insert ───────────────────────────────────────────────
	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file,
		 total_rows, loaded_rows, error_rows, extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T012'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file,
		v_total, v_total, 0, '{}'::jsonb, true, NOW(), NOW()
	)
	RETURNING id INTO v_log_id;

	FOR r_rub IN
		SELECT
			trim(e->>'courseCode')     AS course_code,
			trim(e->>'programCode')    AS program_code,
			trim(e->>'gradeTypeCode')  AS grade_type_code
		FROM jsonb_array_elements(p_rows) AS e
		GROUP BY trim(e->>'courseCode'), trim(e->>'programCode'), trim(e->>'gradeTypeCode')
	LOOP
		SELECT id INTO v_grade_type_id FROM core.types WHERE code = r_rub.grade_type_code;

		SELECT spc.id INTO v_spc_id
		FROM academic.study_plan_courses spc
		JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
		JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
		JOIN academic.programs p ON p.id = sp.program_id
		JOIN academic.courses c ON c.id = spc.course_id
		WHERE spap.academic_period_id = p_academic_period_id
		  AND c.code = r_rub.course_code
		  AND p.code = r_rub.program_code
		LIMIT 1;

		v_is_eb := v_grade_type_id = v_eb_grade_type_id;
		v_is_capstone := false;

		IF v_is_eb OR EXISTS (SELECT 1 FROM core.types WHERE id = v_grade_type_id AND code = 'TG205-T001') THEN
			IF EXISTS (
				SELECT 1 FROM academic.course_outcome_mappings com
				WHERE com.study_plan_course_id = v_spc_id
				  AND com.outcome_type_id = v_verification_outcome_type_id
			) THEN
				v_is_capstone := true;
			END IF;
		END IF;

		v_is_capstone_eb := v_is_capstone AND v_is_eb;

		IF v_is_capstone THEN
			v_rubric_type_id := v_capstone_type_id;
		ELSE
			SELECT id INTO v_rubric_type_id FROM core.types WHERE code = 'TG401-T002';
		END IF;

		INSERT INTO evaluation.rubrics
			(rubric_type_id, grade_type_id, study_plan_course_id, upload_log_id,
			 extra, is_active, created_at, updated_at)
		VALUES (
			v_rubric_type_id, v_grade_type_id, v_spc_id, v_log_id,
			'{}'::jsonb, true, NOW(), NOW()
		)
		RETURNING id INTO v_rubric_id;

		-- Insert questions grouped by (outcomeCode or questionEs)
		FOR r_q IN
			SELECT
				NULLIF(trim(e->>'outcomeCode'), '')  AS outcome_code,
				NULLIF(trim(e->>'questionEs'), '')   AS question_es,
				MAX(NULLIF(trim(e->>'questionEn'), '')) AS question_en
			FROM jsonb_array_elements(p_rows) AS e
			WHERE trim(e->>'courseCode') = r_rub.course_code
			  AND trim(e->>'programCode') = r_rub.program_code
			  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
			GROUP BY NULLIF(trim(e->>'outcomeCode'), ''), NULLIF(trim(e->>'questionEs'), '')
		LOOP
			DECLARE
				v_outcome_id integer := NULL;
				v_question_text_es text;
				v_question_text_en text;
			BEGIN
				-- Resolve outcomeId if provided
				IF r_q.outcome_code IS NOT NULL THEN
					SELECT o.id INTO v_outcome_id
					FROM accreditation.outcomes o
					JOIN academic.course_outcome_mappings com ON com.outcome_id = o.id
					WHERE com.study_plan_course_id = v_spc_id
					  AND o.outcome_code = r_q.outcome_code
					LIMIT 1;
				END IF;

				-- For CAPSTONE+EB: use outcome name as question text
				IF v_is_capstone_eb AND v_outcome_id IS NOT NULL THEN
					SELECT
						o.outcome_name->>'es',
						o.outcome_name->>'en'
					INTO v_question_text_es, v_question_text_en
					FROM accreditation.outcomes o WHERE o.id = v_outcome_id;
				ELSE
					v_question_text_es := COALESCE(r_q.question_es, '');
					v_question_text_en := COALESCE(r_q.question_en, '');
				END IF;

				INSERT INTO evaluation.rubric_questions
					(rubric_id, outcome_id, question, upload_log_id,
					 extra, is_active, created_at, updated_at)
				VALUES (
					v_rubric_id, v_outcome_id,
					jsonb_build_object('es', v_question_text_es, 'en', v_question_text_en),
					v_log_id, '{}'::jsonb, true, NOW(), NOW()
				)
				RETURNING id INTO v_question_id;

				-- Insert criteria ordered by minValue
				FOR r_c IN
					SELECT
						NULLIF(trim(e->>'criteriaEs'), '') AS criteria_es,
						NULLIF(trim(e->>'criteriaEn'), '') AS criteria_en,
						COALESCE(NULLIF(trim(e->>'minValue'), ''), '0')::numeric AS min_val,
						COALESCE(NULLIF(trim(e->>'maxValue'), ''), '0')::numeric AS max_val
					FROM jsonb_array_elements(p_rows) AS e
					WHERE trim(e->>'courseCode') = r_rub.course_code
					  AND trim(e->>'programCode') = r_rub.program_code
					  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
					  AND (
					    (r_q.question_es IS NOT NULL AND NULLIF(trim(e->>'questionEs'), '') = r_q.question_es)
					    OR
					    (r_q.outcome_code IS NOT NULL AND NULLIF(trim(e->>'outcomeCode'), '') = r_q.outcome_code)
					  )
					ORDER BY (e->>'minValue')::numeric ASC
				LOOP
					INSERT INTO evaluation.rubric_question_criterias
						(rubric_question_id, criteria, min_value, max_value, upload_log_id,
						 extra, is_active, created_at, updated_at)
					VALUES (
						v_question_id,
						jsonb_build_object('es', r_c.criteria_es, 'en', r_c.criteria_en),
						r_c.min_val, r_c.max_val, v_log_id,
						'{}'::jsonb, true, NOW(), NOW()
					);
				END LOOP;
			END;
		END LOOP;
	END LOOP;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restore previous version (without programCode)
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_rubrics(
	p_rows               jsonb,
	p_academic_period_id integer,
	p_user_id            integer,
	p_source_file        text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total         integer := jsonb_array_length(p_rows);
	v_has_errors    boolean := false;
	v_log_id        integer;
	v_rubric_id     integer;
	v_question_id   integer;
	v_spc_id        integer;
	v_grade_type_id integer;
	v_rubric_type_id integer;
	v_capstone_type_id integer;
	v_eb_grade_type_id integer;
	v_verification_outcome_type_id integer;
	v_is_capstone   boolean;
	v_is_eb         boolean;
	v_is_capstone_eb boolean;
	r               record;
	r_rub           record;
	r_q             record;
	r_c             record;
	v_min_prev      numeric;
	v_max_prev      numeric;
	v_total_max     numeric;
BEGIN
	-- Resolve fixed type IDs once
	SELECT id INTO v_capstone_type_id      FROM core.types WHERE code = 'TG401-T001';
	SELECT id INTO v_eb_grade_type_id      FROM core.types WHERE code = 'TG205-T002';
	SELECT id INTO v_verification_outcome_type_id FROM core.types WHERE code = 'TG302-T001';

	-- ── Phase 1: per-row structural validation ────────────────────────
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                        AS row_number,
			NULLIF(trim(e->>'courseCode'), '')            AS course_code,
			NULLIF(trim(e->>'gradeTypeCode'), '')         AS grade_type_code,
			NULLIF(trim(e->>'criteriaEs'), '')            AS criteria_es,
			NULLIF(trim(e->>'criteriaEn'), '')            AS criteria_en,
			e->>'minValue'                                AS min_value_raw,
			e->>'maxValue'                                AS max_value_raw
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.grade_type_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeCodeEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.criteria_es IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'criteriaEsEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.criteria_en IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'criteriaEnEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- minValue/maxValue are optional (default 0 for CAPSTONE+EB); validate only if provided
		IF r.min_value_raw IS NOT NULL AND r.min_value_raw != ''
		   AND NOT r.min_value_raw ~ '^-?[0-9]+([.][0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'minValueInvalid'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.max_value_raw IS NOT NULL AND r.max_value_raw != ''
		   AND NOT r.max_value_raw ~ '^-?[0-9]+([.][0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'maxValueInvalid'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF (r.min_value_raw IS NOT NULL AND r.min_value_raw != '')
		   AND (r.max_value_raw IS NOT NULL AND r.max_value_raw != '')
		   AND r.min_value_raw::numeric > r.max_value_raw::numeric THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'minValueGreaterThanMax'::text, NULL::integer;
			CONTINUE;
		END IF;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	-- ── Phase 2: per-rubric cross-DB validation ───────────────────────
	FOR r_rub IN
		SELECT
			trim(e->>'courseCode')     AS course_code,
			trim(e->>'gradeTypeCode')  AS grade_type_code,
			MIN((e->>'rowNumber')::int) AS first_row
		FROM jsonb_array_elements(p_rows) AS e
		GROUP BY trim(e->>'courseCode'), trim(e->>'gradeTypeCode')
	LOOP
		-- Validate gradeType exists
		SELECT id INTO v_grade_type_id FROM core.types WHERE code = r_rub.grade_type_code;
		IF v_grade_type_id IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'gradeTypeNotFound'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- Resolve study_plan_course for this course + academic period
		SELECT spc.id INTO v_spc_id
		FROM academic.study_plan_courses spc
		JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
		JOIN academic.courses c ON c.id = spc.course_id
		WHERE spap.academic_period_id = p_academic_period_id
		  AND c.code = r_rub.course_code
		LIMIT 1;

		IF v_spc_id IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'courseNotFound'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF EXISTS (
			SELECT 1 FROM evaluation.rubrics rb
			WHERE rb.study_plan_course_id = v_spc_id
			  AND rb.grade_type_id = v_grade_type_id
			  AND rb.is_active = true
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'rubricAlreadyExists'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- Resolve rubric type (CAPSTONE if course has verification outcomes AND gradeType is EA or EB)
		v_is_capstone := false;
		IF v_grade_type_id = v_eb_grade_type_id
		   OR EXISTS (SELECT 1 FROM core.types WHERE id = v_grade_type_id AND code = 'TG205-T001')
		THEN
			IF EXISTS (
				SELECT 1 FROM academic.course_outcome_mappings com
				WHERE com.study_plan_course_id = v_spc_id
				  AND com.outcome_type_id = v_verification_outcome_type_id
			) THEN
				v_is_capstone := true;
			END IF;
		END IF;

		v_is_eb         := v_grade_type_id = v_eb_grade_type_id;
		v_is_capstone_eb := v_is_capstone AND v_is_eb;

		-- For CAPSTONE+EB: all questions must have outcomeCode
		IF v_is_capstone_eb THEN
			IF EXISTS (
				SELECT 1 FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND NULLIF(trim(e->>'outcomeCode'), '') IS NULL
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_rub.first_row, 'outcomeRequiredCapstoneEb'::text, NULL::integer;
				CONTINUE;
			END IF;
		END IF;

		-- For non-CAPSTONE+EB: questionEs required
		IF NOT v_is_capstone_eb THEN
			IF EXISTS (
				SELECT 1 FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND NULLIF(trim(e->>'questionEs'), '') IS NULL
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_rub.first_row, 'questionRequiredNonCapstone'::text, NULL::integer;
				CONTINUE;
			END IF;
		END IF;

		-- Validate outcomeCodes if provided
		IF EXISTS (
			SELECT 1 FROM jsonb_array_elements(p_rows) AS e
			WHERE trim(e->>'courseCode') = r_rub.course_code
			  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
			  AND NULLIF(trim(e->>'outcomeCode'), '') IS NOT NULL
		) THEN
			FOR r IN
				SELECT DISTINCT trim(e->>'outcomeCode') AS outcome_code,
				       MIN((e->>'rowNumber')::int)      AS first_row
				FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND NULLIF(trim(e->>'outcomeCode'), '') IS NOT NULL
				GROUP BY trim(e->>'outcomeCode')
			LOOP
				IF NOT EXISTS (
					SELECT 1
					FROM academic.course_outcome_mappings com
					JOIN accreditation.outcomes o ON o.id = com.outcome_id
					WHERE com.study_plan_course_id = v_spc_id
					  AND o.outcome_code = r.outcome_code
				) THEN
					v_has_errors := true;
					RETURN QUERY SELECT r.first_row, 'outcomeNotFound'::text, NULL::integer;
				END IF;
			END LOOP;
		END IF;

		-- For non-CAPSTONE+EB: validate criteria per question (no overlap, sum max = 20)
		IF NOT v_is_capstone_eb THEN
			FOR r_q IN
				SELECT
					NULLIF(trim(e->>'outcomeCode'), '')  AS outcome_code,
					NULLIF(trim(e->>'questionEs'), '')   AS question_es,
					MIN((e->>'rowNumber')::int)          AS first_row
				FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				GROUP BY NULLIF(trim(e->>'outcomeCode'), ''), NULLIF(trim(e->>'questionEs'), '')
			LOOP
				v_min_prev := NULL;
				v_max_prev := NULL;

				FOR r_c IN
					SELECT
						(e->>'rowNumber')::int AS row_number,
						COALESCE(NULLIF(trim(e->>'minValue'), ''), '0')::numeric AS min_val,
						COALESCE(NULLIF(trim(e->>'maxValue'), ''), '0')::numeric AS max_val
					FROM jsonb_array_elements(p_rows) AS e
					WHERE trim(e->>'courseCode') = r_rub.course_code
					  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
					  AND (
					    (r_q.question_es IS NOT NULL AND NULLIF(trim(e->>'questionEs'), '') = r_q.question_es)
					    OR
					    (r_q.outcome_code IS NOT NULL AND NULLIF(trim(e->>'outcomeCode'), '') = r_q.outcome_code)
					  )
					ORDER BY (e->>'minValue')::numeric ASC
				LOOP
					IF v_max_prev IS NOT NULL AND r_c.min_val <= v_max_prev THEN
						v_has_errors := true;
						RETURN QUERY SELECT r_c.row_number, 'criteriaOverlap'::text, NULL::integer;
					END IF;
					v_min_prev := r_c.min_val;
					v_max_prev := r_c.max_val;
				END LOOP;
			END LOOP;

			-- Validate sum of max per question = 20
			SELECT COALESCE(SUM(q_max), 0) INTO v_total_max
			FROM (
				SELECT MAX(COALESCE(NULLIF(trim(e->>'maxValue'), ''), '0')::numeric) AS q_max
				FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				GROUP BY NULLIF(trim(e->>'outcomeCode'), ''), NULLIF(trim(e->>'questionEs'), '')
			) sub;

			IF ROUND(v_total_max::numeric, 6) != 20 THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_rub.first_row, 'criteriaTotalNot20'::text, NULL::integer;
			END IF;
		END IF;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	-- ── Phase 3: Insert ───────────────────────────────────────────────
	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file,
		 total_rows, loaded_rows, error_rows, extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T012'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file,
		v_total, v_total, 0, '{}'::jsonb, true, NOW(), NOW()
	)
	RETURNING id INTO v_log_id;

	FOR r_rub IN
		SELECT
			trim(e->>'courseCode')     AS course_code,
			trim(e->>'gradeTypeCode')  AS grade_type_code
		FROM jsonb_array_elements(p_rows) AS e
		GROUP BY trim(e->>'courseCode'), trim(e->>'gradeTypeCode')
	LOOP
		SELECT id INTO v_grade_type_id FROM core.types WHERE code = r_rub.grade_type_code;

		SELECT spc.id INTO v_spc_id
		FROM academic.study_plan_courses spc
		JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
		JOIN academic.courses c ON c.id = spc.course_id
		WHERE spap.academic_period_id = p_academic_period_id
		  AND c.code = r_rub.course_code
		LIMIT 1;

		v_is_eb := v_grade_type_id = v_eb_grade_type_id;
		v_is_capstone := false;

		IF v_is_eb OR EXISTS (SELECT 1 FROM core.types WHERE id = v_grade_type_id AND code = 'TG205-T001') THEN
			IF EXISTS (
				SELECT 1 FROM academic.course_outcome_mappings com
				WHERE com.study_plan_course_id = v_spc_id
				  AND com.outcome_type_id = v_verification_outcome_type_id
			) THEN
				v_is_capstone := true;
			END IF;
		END IF;

		v_is_capstone_eb := v_is_capstone AND v_is_eb;

		IF v_is_capstone THEN
			v_rubric_type_id := v_capstone_type_id;
		ELSE
			SELECT id INTO v_rubric_type_id FROM core.types WHERE code = 'TG401-T002';
		END IF;

		INSERT INTO evaluation.rubrics
			(rubric_type_id, grade_type_id, study_plan_course_id, upload_log_id,
			 extra, is_active, created_at, updated_at)
		VALUES (
			v_rubric_type_id, v_grade_type_id, v_spc_id, v_log_id,
			'{}'::jsonb, true, NOW(), NOW()
		)
		RETURNING id INTO v_rubric_id;

		-- Insert questions grouped by (outcomeCode or questionEs)
		FOR r_q IN
			SELECT
				NULLIF(trim(e->>'outcomeCode'), '')  AS outcome_code,
				NULLIF(trim(e->>'questionEs'), '')   AS question_es,
				MAX(NULLIF(trim(e->>'questionEn'), '')) AS question_en
			FROM jsonb_array_elements(p_rows) AS e
			WHERE trim(e->>'courseCode') = r_rub.course_code
			  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
			GROUP BY NULLIF(trim(e->>'outcomeCode'), ''), NULLIF(trim(e->>'questionEs'), '')
		LOOP
			DECLARE
				v_outcome_id integer := NULL;
				v_question_text_es text;
				v_question_text_en text;
			BEGIN
				-- Resolve outcomeId if provided
				IF r_q.outcome_code IS NOT NULL THEN
					SELECT o.id INTO v_outcome_id
					FROM accreditation.outcomes o
					JOIN academic.course_outcome_mappings com ON com.outcome_id = o.id
					WHERE com.study_plan_course_id = v_spc_id
					  AND o.outcome_code = r_q.outcome_code
					LIMIT 1;
				END IF;

				-- For CAPSTONE+EB: use outcome name as question text
				IF v_is_capstone_eb AND v_outcome_id IS NOT NULL THEN
					SELECT
						o.outcome_name->>'es',
						o.outcome_name->>'en'
					INTO v_question_text_es, v_question_text_en
					FROM accreditation.outcomes o WHERE o.id = v_outcome_id;
				ELSE
					v_question_text_es := COALESCE(r_q.question_es, '');
					v_question_text_en := COALESCE(r_q.question_en, '');
				END IF;

				INSERT INTO evaluation.rubric_questions
					(rubric_id, outcome_id, question, upload_log_id,
					 extra, is_active, created_at, updated_at)
				VALUES (
					v_rubric_id, v_outcome_id,
					jsonb_build_object('es', v_question_text_es, 'en', v_question_text_en),
					v_log_id, '{}'::jsonb, true, NOW(), NOW()
				)
				RETURNING id INTO v_question_id;

				-- Insert criteria ordered by minValue
				FOR r_c IN
					SELECT
						NULLIF(trim(e->>'criteriaEs'), '') AS criteria_es,
						NULLIF(trim(e->>'criteriaEn'), '') AS criteria_en,
						COALESCE(NULLIF(trim(e->>'minValue'), ''), '0')::numeric AS min_val,
						COALESCE(NULLIF(trim(e->>'maxValue'), ''), '0')::numeric AS max_val
					FROM jsonb_array_elements(p_rows) AS e
					WHERE trim(e->>'courseCode') = r_rub.course_code
					  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
					  AND (
					    (r_q.question_es IS NOT NULL AND NULLIF(trim(e->>'questionEs'), '') = r_q.question_es)
					    OR
					    (r_q.outcome_code IS NOT NULL AND NULLIF(trim(e->>'outcomeCode'), '') = r_q.outcome_code)
					  )
					ORDER BY (e->>'minValue')::numeric ASC
				LOOP
					INSERT INTO evaluation.rubric_question_criterias
						(rubric_question_id, criteria, min_value, max_value, upload_log_id,
						 extra, is_active, created_at, updated_at)
					VALUES (
						v_question_id,
						jsonb_build_object('es', r_c.criteria_es, 'en', r_c.criteria_en),
						r_c.min_val, r_c.max_val, v_log_id,
						'{}'::jsonb, true, NOW(), NOW()
					);
				END LOOP;
			END;
		END LOOP;
	END LOOP;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
		`);
	}
}
