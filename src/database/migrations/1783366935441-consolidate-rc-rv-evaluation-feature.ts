import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Squash of the RC/RV evaluation feature migrations (PR #64) into a single migration.
 * Collapses the following into their net final state:
 *   - competency scope on rubrics (TG402 + evaluation.rubrics.competency_scope_type_id)
 *   - evidence.evaluations.rubric_id, upload_log_id; student_course_outcome_grades.evaluation_id
 *   - evaluation.rubric_scores.upload_log_id
 *   - TG205 grade-type / TG404 qualification-status type fixes
 *   - RC/RV + rubric performance levels
 *   - evaluation.project_groups (+ projects.project_group_id, project_groups.upload_log_id)
 *   - audit upload/rollback functions: fn_upload_rubrics, fn_upload_grades_rv,
 *     fn_rollback_grades_rv, fn_upload_grades_rc, fn_rollback_grades_rc,
 *     fn_upload_projects, fn_rollback_projects (final versions only)
 *
 * The evaluation.semaphore_thresholds table is intentionally omitted: the original
 * feature created it and then dropped it, so its net effect is nothing.
 *
 * audit.fn_rollback_grades_rv changes its return type (text -> void), so up() drops the
 * pre-feature function before recreating it (CREATE OR REPLACE cannot change return type).
 * down() restores the exact pre-feature state: pre-existing function bodies are restored
 * (fn_rollback_grades_rv back to its RETURNS text version), added columns/tables dropped.
 */
export class ConsolidateRcRvEvaluationFeature1783366935441 implements MigrationInterface {
	name = 'ConsolidateRcRvEvaluationFeature1783366935441';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ── competency scope on rubrics (TG402 + evaluation.rubrics.competency_scope_type_id) ──
		await queryRunner.query(`
			INSERT INTO core.type_groups (
				code,
				name,
				description,
				extra,
				is_active,
				created_at,
				updated_at
			)
			VALUES (
				'TG402',
				'{"en":"Competency scope","es":"Alcance de competencias"}'::jsonb,
				'{"en":"Whether a rubric evaluates a single or multiple competencies","es":"Si una rubrica evalua una unica competencia o multiples competencias"}'::jsonb,
				'{}'::jsonb,
				true,
				NOW(),
				NULL
			)
			ON CONFLICT (code) DO NOTHING
		`);
		await queryRunner.query(`
			INSERT INTO core.types (
				type_group_id,
				code,
				name,
				description,
				extra,
				is_active,
				created_at,
				updated_at
			)
			SELECT
				tg.id,
				v.code,
				v.name,
				v.description,
				'{}'::jsonb,
				true,
				NOW(),
				NULL
			FROM core.type_groups tg
			CROSS JOIN (
				VALUES
					('TG402-T001', '{"en":"Single competency","es":"Unica competencia"}'::jsonb, '{"en":"Rubric evaluates a single competency","es":"Rubrica que evalua una unica competencia"}'::jsonb),
					('TG402-T002', '{"en":"Multiple competency","es":"Multiple competencia"}'::jsonb, '{"en":"Rubric evaluates multiple competencies","es":"Rubrica que evalua multiples competencias"}'::jsonb)
			) AS v(code, name, description)
			WHERE tg.code = 'TG402'
			  AND NOT EXISTS (
				SELECT 1 FROM core.types t WHERE t.code = v.code
			  )
		`);
		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ADD COLUMN competency_scope_type_id integer
		`);
		await queryRunner.query(`
			UPDATE evaluation.rubrics
			SET competency_scope_type_id = (SELECT id FROM core.types WHERE code = 'TG402-T001')
			WHERE competency_scope_type_id IS NULL
		`);
		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ALTER COLUMN competency_scope_type_id SET NOT NULL
		`);
		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ADD CONSTRAINT "FK_rubrics_competency_scope_type_id" FOREIGN KEY (competency_scope_type_id)
			REFERENCES core.types(id) ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		// ── evidence.evaluations.rubric_id + evidence.student_course_outcome_grades.evaluation_id ──
		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			ADD COLUMN rubric_id integer
		`);
		await queryRunner.query(`
			UPDATE evidence.evaluations ev
			SET rubric_id = sub.rubric_id
			FROM (
				SELECT DISTINCT ON (rs.evaluation_id) rs.evaluation_id, rq.rubric_id
				FROM evaluation.rubric_scores rs
				JOIN evaluation.rubric_question_criterias rqc ON rqc.id = rs.rubric_question_criteria_id
				JOIN evaluation.rubric_questions rq ON rq.id = rqc.rubric_question_id
			) sub
			WHERE sub.evaluation_id = ev.id AND ev.rubric_id IS NULL
		`);
		await queryRunner.query(`
			WITH candidate AS (
				SELECT ps.id AS project_student_id, r.id AS rubric_id
				FROM evaluation.project_students ps
				JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
				JOIN academic.course_sections cs ON cs.id = sse.course_section_id
				JOIN academic.study_plan_courses spc ON spc.course_id = cs.course_id
				JOIN academic.study_plan_academic_periods spap
					ON spap.id = spc.study_plan_academic_period_id
					AND spap.academic_period_id = cs.academic_period_id
				JOIN evaluation.rubrics r ON r.study_plan_course_id = spc.id AND r.is_active = true
			),
			unambiguous AS (
				SELECT project_student_id, MIN(rubric_id) AS rubric_id
				FROM candidate
				GROUP BY project_student_id
				HAVING COUNT(*) = 1
			)
			UPDATE evidence.evaluations ev
			SET rubric_id = u.rubric_id
			FROM unambiguous u
			WHERE u.project_student_id = ev.project_student_id AND ev.rubric_id IS NULL
		`);
		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			ALTER COLUMN rubric_id SET NOT NULL
		`);
		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			ADD CONSTRAINT "FK_evaluations_rubric_id" FOREIGN KEY (rubric_id)
			REFERENCES evaluation.rubrics(id) ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			ADD COLUMN evaluation_id integer
		`);
		await queryRunner.query(`
			UPDATE evidence.student_course_outcome_grades scog
			SET evaluation_id = sub.evaluation_id
			FROM (
				SELECT DISTINCT ON (ps.student_section_enrollment_id, rq.outcome_id)
					ps.student_section_enrollment_id,
					rq.outcome_id,
					ev.id AS evaluation_id
				FROM evidence.evaluations ev
				JOIN evaluation.project_students ps ON ps.id = ev.project_student_id
				JOIN evaluation.rubric_questions rq ON rq.rubric_id = ev.rubric_id
				WHERE rq.outcome_id IS NOT NULL
			) sub
			WHERE sub.student_section_enrollment_id = scog.student_section_enrollment_id
				AND sub.outcome_id = scog.outcome_id
				AND scog.evaluation_id IS NULL
		`);
		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			ALTER COLUMN evaluation_id SET NOT NULL
		`);
		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			ADD CONSTRAINT "FK_student_course_outcome_grades_evaluation_id" FOREIGN KEY (evaluation_id)
			REFERENCES evidence.evaluations(id) ON DELETE NO ACTION ON UPDATE NO ACTION
		`);

		// ── audit.fn_upload_rubrics ──
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
	v_competency_scope_type_id integer;
	v_rubric_type_id integer;
	v_capstone_type_id integer;
	v_multiple_scope_type_id integer;
	v_verification_outcome_type_id integer;
	v_is_capstone   boolean;
	v_is_capstone_multiple boolean;
	v_has_complete_commission boolean;
	r               record;
	r_rub           record;
	r_q             record;
	r_c             record;
	r_comm          record;
	v_min_prev      numeric;
	v_max_prev      numeric;
	v_total_max     numeric;
BEGIN
	-- Resolve fixed type IDs once
	SELECT id INTO v_capstone_type_id      FROM core.types WHERE code = 'TG401-T001';
	SELECT id INTO v_multiple_scope_type_id FROM core.types WHERE code = 'TG402-T002';
	SELECT id INTO v_verification_outcome_type_id FROM core.types WHERE code = 'TG302-T001';

	-- ── Phase 1: per-row structural validation ────────────────────────
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                        AS row_number,
			NULLIF(trim(e->>'courseCode'), '')            AS course_code,
			NULLIF(trim(e->>'programCode'), '')           AS program_code,
			NULLIF(trim(e->>'gradeTypeCode'), '')         AS grade_type_code,
			NULLIF(trim(e->>'competencyScopeCode'), '')   AS competency_scope_code,
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

		IF r.competency_scope_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'competencyScopeCodeEmpty'::text, NULL::integer;
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

		-- minValue/maxValue are optional (default 0 for CAPSTONE+Multiple); validate only if provided
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
			trim(e->>'courseCode')            AS course_code,
			trim(e->>'programCode')           AS program_code,
			trim(e->>'gradeTypeCode')         AS grade_type_code,
			trim(e->>'competencyScopeCode')   AS competency_scope_code,
			MIN((e->>'rowNumber')::int) AS first_row
		FROM jsonb_array_elements(p_rows) AS e
		GROUP BY trim(e->>'courseCode'), trim(e->>'programCode'), trim(e->>'gradeTypeCode'),
			trim(e->>'competencyScopeCode')
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

		-- Validate competencyScope exists
		SELECT id INTO v_competency_scope_type_id FROM core.types WHERE code = r_rub.competency_scope_code;
		IF v_competency_scope_type_id IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'competencyScopeNotFound'::text, NULL::integer;
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

		-- Check duplicate rubric (course + grade type + competency scope)
		IF EXISTS (
			SELECT 1 FROM evaluation.rubrics rb
			WHERE rb.study_plan_course_id = v_spc_id
			  AND rb.grade_type_id = v_grade_type_id
			  AND rb.competency_scope_type_id = v_competency_scope_type_id
			  AND rb.is_active = true
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'rubricAlreadyExists'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- Resolve rubric type: CAPSTONE if the course has verification outcomes mapped,
		-- regardless of grade type (matches RubricConfigService.resolveRubricType).
		v_is_capstone := EXISTS (
			SELECT 1 FROM academic.course_outcome_mappings com
			WHERE com.study_plan_course_id = v_spc_id
			  AND com.outcome_type_id = v_verification_outcome_type_id
		);

		v_is_capstone_multiple := v_is_capstone AND v_competency_scope_type_id = v_multiple_scope_type_id;

		-- For CAPSTONE + Multiple competency scope: all questions must have outcomeCode
		IF v_is_capstone_multiple THEN
			IF EXISTS (
				SELECT 1 FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
				  AND NULLIF(trim(e->>'outcomeCode'), '') IS NULL
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_rub.first_row, 'outcomeRequiredCapstoneMultiple'::text, NULL::integer;
				CONTINUE;
			END IF;

			-- Each verification outcome belongs to a commission (ABET, CAC, etc). If any outcome
			-- of a commission is filled in, every outcome of that same commission mapped to the
			-- course must also be filled in. At least one commission must end up complete.
			v_has_complete_commission := false;
			FOR r_comm IN
				SELECT
					o.program_commission_id AS commission_id,
					array_agg(DISTINCT o.id) AS all_outcome_ids,
					array_agg(DISTINCT o.id) FILTER (
						WHERE o.outcome_code IN (
							SELECT DISTINCT trim(e->>'outcomeCode')
							FROM jsonb_array_elements(p_rows) AS e
							WHERE trim(e->>'courseCode') = r_rub.course_code
							  AND trim(e->>'programCode') = r_rub.program_code
							  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
							  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
							  AND NULLIF(trim(e->>'outcomeCode'), '') IS NOT NULL
						)
					) AS touched_outcome_ids
				FROM academic.course_outcome_mappings com
				JOIN accreditation.outcomes o ON o.id = com.outcome_id
				WHERE com.study_plan_course_id = v_spc_id
				  AND com.outcome_type_id = v_verification_outcome_type_id
				GROUP BY o.program_commission_id
			LOOP
				IF r_comm.touched_outcome_ids IS NULL THEN
					CONTINUE;
				END IF;

				IF array_length(r_comm.touched_outcome_ids, 1) < array_length(r_comm.all_outcome_ids, 1) THEN
					v_has_errors := true;
					RETURN QUERY SELECT r_rub.first_row, 'incompleteCommissionOutcomes'::text, NULL::integer;
					EXIT;
				END IF;

				v_has_complete_commission := true;
			END LOOP;

			IF v_has_errors THEN
				CONTINUE;
			END IF;

			IF NOT v_has_complete_commission THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_rub.first_row, 'atLeastOneCommissionRequired'::text, NULL::integer;
				CONTINUE;
			END IF;
		END IF;

		-- Otherwise: questionEs required
		IF NOT v_is_capstone_multiple THEN
			IF EXISTS (
				SELECT 1 FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
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
			  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
			  AND NULLIF(trim(e->>'outcomeCode'), '') IS NOT NULL
		) THEN
			FOR r IN
				SELECT DISTINCT trim(e->>'outcomeCode') AS outcome_code,
				       MIN((e->>'rowNumber')::int)      AS first_row
				FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
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

		-- Otherwise: validate criteria per question (no overlap, sum max = 20)
		IF NOT v_is_capstone_multiple THEN
			FOR r_q IN
				SELECT
					NULLIF(trim(e->>'outcomeCode'), '')  AS outcome_code,
					NULLIF(trim(e->>'questionEs'), '')   AS question_es,
					MIN((e->>'rowNumber')::int)          AS first_row
				FROM jsonb_array_elements(p_rows) AS e
				WHERE trim(e->>'courseCode') = r_rub.course_code
				  AND trim(e->>'programCode') = r_rub.program_code
				  AND trim(e->>'gradeTypeCode') = r_rub.grade_type_code
				  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
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
					  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
					  AND (
					    (r_q.question_es IS NOT NULL AND NULLIF(trim(e->>'questionEs'), '') = r_q.question_es)
					    OR
					    (r_q.outcome_code IS NOT NULL AND NULLIF(trim(e->>'outcomeCode'), '') = r_q.outcome_code)
					  )
					ORDER BY COALESCE(NULLIF(trim(e->>'minValue'), ''), '0')::numeric ASC
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
				  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
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
			trim(e->>'courseCode')            AS course_code,
			trim(e->>'programCode')           AS program_code,
			trim(e->>'gradeTypeCode')         AS grade_type_code,
			trim(e->>'competencyScopeCode')   AS competency_scope_code
		FROM jsonb_array_elements(p_rows) AS e
		GROUP BY trim(e->>'courseCode'), trim(e->>'programCode'), trim(e->>'gradeTypeCode'),
			trim(e->>'competencyScopeCode')
	LOOP
		SELECT id INTO v_grade_type_id FROM core.types WHERE code = r_rub.grade_type_code;
		SELECT id INTO v_competency_scope_type_id FROM core.types WHERE code = r_rub.competency_scope_code;

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

		v_is_capstone := EXISTS (
			SELECT 1 FROM academic.course_outcome_mappings com
			WHERE com.study_plan_course_id = v_spc_id
			  AND com.outcome_type_id = v_verification_outcome_type_id
		);

		v_is_capstone_multiple := v_is_capstone AND v_competency_scope_type_id = v_multiple_scope_type_id;

		IF v_is_capstone THEN
			v_rubric_type_id := v_capstone_type_id;
		ELSE
			SELECT id INTO v_rubric_type_id FROM core.types WHERE code = 'TG401-T002';
		END IF;

		INSERT INTO evaluation.rubrics
			(rubric_type_id, grade_type_id, competency_scope_type_id, study_plan_course_id, upload_log_id,
			 extra, is_active, created_at, updated_at)
		VALUES (
			v_rubric_type_id, v_grade_type_id, v_competency_scope_type_id, v_spc_id, v_log_id,
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
			  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
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

				-- For CAPSTONE + Multiple competency scope: use outcome name as question text
				IF v_is_capstone_multiple AND v_outcome_id IS NOT NULL THEN
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
					  AND trim(e->>'competencyScopeCode') = r_rub.competency_scope_code
					  AND (
					    (r_q.question_es IS NOT NULL AND NULLIF(trim(e->>'questionEs'), '') = r_q.question_es)
					    OR
					    (r_q.outcome_code IS NOT NULL AND NULLIF(trim(e->>'outcomeCode'), '') = r_q.outcome_code)
					  )
					ORDER BY COALESCE(NULLIF(trim(e->>'minValue'), ''), '0')::numeric ASC
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

		// ── upload_log_id on evidence.evaluations + evaluation.rubric_scores ──
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" ADD COLUMN IF NOT EXISTS "upload_log_id" integer`,
		);
		await queryRunner.query(`ALTER TABLE "evidence"."evaluations" ADD CONSTRAINT "FK_evaluations_upload_log_id"
			 FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id")
			 ON DELETE NO ACTION ON UPDATE NO ACTION`);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" ADD COLUMN IF NOT EXISTS "upload_log_id" integer`,
		);
		await queryRunner.query(`ALTER TABLE "evaluation"."rubric_scores" ADD CONSTRAINT "FK_rubric_scores_upload_log_id"
			 FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id")
			 ON DELETE NO ACTION ON UPDATE NO ACTION`);

		// ── audit.fn_upload_grades_rv (final redesign) ──
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_grades_rv(
	p_rows               jsonb,
	p_academic_period_id integer,
	p_user_id            integer,
	p_source_file        text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total                        integer := jsonb_array_length(p_rows);
	v_has_errors                   boolean := false;
	v_log_id                       integer;
	v_capstone_type_id             integer;
	v_multiple_scope_type_id       integer;
	v_com_evaluator_type_id        integer;
	v_asistio_status_type_id       integer;
	v_verification_outcome_type_id integer;
	v_school_type_id               integer;
	v_program_type_id              integer;
	v_school_id                    integer;
	v_pc_id                        integer;
	v_spc_id                       integer;
	v_grade_type_id                integer;
	v_rubric_id                    integer;
	v_question_id                  integer;
	v_criteria_id                  integer;
	v_project_id                   integer;
	v_ps_id                        integer;
	v_pe_id                        integer;
	v_eval_id                      integer;
	v_professor_id                 integer;
	v_sse_id                       integer;
	v_outcome_pos                  integer;
	v_grade_val                    text;
	v_score                        numeric;
	r                              record;
	r_grp                          record;
	r_stu                          record;
BEGIN
	-- Resolve fixed type IDs once
	SELECT id INTO v_capstone_type_id             FROM core.types WHERE code = 'TG401-T001';
	SELECT id INTO v_multiple_scope_type_id       FROM core.types WHERE code = 'TG402-T002';
	SELECT id INTO v_com_evaluator_type_id        FROM core.types WHERE code = 'TG403-T001';
	SELECT id INTO v_asistio_status_type_id       FROM core.types WHERE code = 'TG404-T001';
	SELECT id INTO v_verification_outcome_type_id FROM core.types WHERE code = 'TG302-T001';
	SELECT id INTO v_school_type_id               FROM core.types WHERE code = 'TG903-T002';
	SELECT id INTO v_program_type_id              FROM core.types WHERE code = 'TG903-T003';

	-- ── Phase 2: per-row validation ───────────────────────────────────────────
	-- Note: same student may appear multiple times with different project codes;
	-- the last row wins (overwrite). No intra-file duplicate check needed.
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                   AS row_number,
			NULLIF(trim(e->>'schoolCode'), '')        AS school_code,
			NULLIF(trim(e->>'programCode'), '')       AS program_code,
			NULLIF(trim(e->>'commissionCode'), '')    AS commission_code,
			NULLIF(trim(e->>'courseCode'), '')        AS course_code,
			NULLIF(trim(e->>'studentCode'), '')       AS student_code,
			NULLIF(trim(e->>'sectionCode'), '')       AS section_code,
			NULLIF(trim(e->>'professorCode'), '')     AS professor_code,
			NULLIF(trim(e->>'gradeTypeCode'), '')     AS grade_type_code,
			NULLIF(trim(e->>'o1'), '')                AS o1,
			NULLIF(trim(e->>'o2'), '')                AS o2,
			NULLIF(trim(e->>'o3'), '')                AS o3,
			NULLIF(trim(e->>'o4'), '')                AS o4,
			NULLIF(trim(e->>'o5'), '')                AS o5,
			NULLIF(trim(e->>'o6'), '')                AS o6,
			NULLIF(trim(e->>'o7'), '')                AS o7,
			NULLIF(trim(e->>'projectCode'), '')       AS project_code,
			NULLIF(trim(e->>'projectNameEs'), '')     AS project_name_es,
			NULLIF(trim(e->>'projectNameEn'), '')     AS project_name_en,
			NULLIF(trim(e->>'projectDescEs'), '')     AS project_desc_es,
			NULLIF(trim(e->>'projectDescEn'), '')     AS project_desc_en
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		-- schoolCode
		IF r.school_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'schoolCodeEmpty'::text, NULL::integer;
		ELSE
			SELECT id INTO v_school_id
			FROM organization.schools WHERE code = r.school_code;

			IF v_school_id IS NULL THEN
				v_has_errors := true;
				RETURN QUERY SELECT r.row_number, 'schoolNotFound'::text, NULL::integer;
			END IF;
		END IF;

		-- programCode
		IF r.program_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotFound'::text, NULL::integer;
		ELSIF r.school_code IS NOT NULL AND v_school_id IS NOT NULL
		      AND NOT EXISTS (
			SELECT 1
			FROM academic.programs prog
			JOIN organization.charts ch_prog
			     ON ch_prog.entity_code = prog.id
			     AND ch_prog.entity_type_id = v_program_type_id
			JOIN organization.charts ch_sch
			     ON ch_sch.id = ch_prog.root_chart_id
			     AND ch_sch.entity_type_id = v_school_type_id
			     AND ch_sch.entity_code = v_school_id
			WHERE prog.code = r.program_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'programNotInSchool'::text, NULL::integer;
		END IF;

		-- commissionCode
		IF r.commission_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'commissionCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1
			FROM accreditation.program_commissions pc
			JOIN accreditation.commissions c ON c.id = pc.commission_id
			WHERE c.code = r.commission_code
			  AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'commissionNotFound'::text, NULL::integer;
		END IF;

		-- courseCode: must exist in an active study plan for the period
		IF r.course_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1
			FROM academic.study_plan_courses spc
			JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			JOIN academic.courses c ON c.id = spc.course_id
			WHERE spap.academic_period_id = p_academic_period_id
			  AND c.code = r.course_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNotFound'::text, NULL::integer;
		END IF;

		-- course + commission must have at least one VERIFICATION outcome mapped
		IF r.course_code IS NOT NULL AND r.commission_code IS NOT NULL
		   AND NOT EXISTS (
			SELECT 1
			FROM accreditation.outcomes o
			JOIN accreditation.program_commissions pc ON pc.id = o.program_commission_id
			JOIN accreditation.commissions c ON c.id = pc.commission_id
			JOIN academic.study_plan_courses spc ON spc.id = (
				SELECT spc2.id
				FROM academic.study_plan_courses spc2
				JOIN academic.study_plan_academic_periods spap2 ON spap2.id = spc2.study_plan_academic_period_id
				JOIN academic.courses co2 ON co2.id = spc2.course_id
				WHERE spap2.academic_period_id = p_academic_period_id
				  AND co2.code = r.course_code
				LIMIT 1
			)
			JOIN academic.course_outcome_mappings com
			     ON com.outcome_id = o.id
			     AND com.study_plan_course_id = spc.id
			     AND com.outcome_type_id = v_verification_outcome_type_id
			WHERE c.code = r.commission_code
			  AND pc.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'noOutcomesMapped'::text, NULL::integer;
		END IF;

		-- sectionCode: must exist and match courseCode in the period
		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
		ELSIF r.course_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM academic.course_sections cs
			JOIN academic.courses c ON c.id = cs.course_id
			WHERE cs.section_code = r.section_code
			  AND cs.academic_period_id = p_academic_period_id
			  AND c.code = r.course_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionNotFound'::text, NULL::integer;
		END IF;

		-- studentCode: exists + active enrollment + not already in a project this period
		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.students st WHERE st.code = r.student_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentNotFound'::text, NULL::integer;
		ELSIF r.section_code IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM academic.student_section_enrollments sse
			JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			JOIN academic.students st ON st.id = es.student_id
			JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			WHERE st.code = r.student_code
			  AND cs.section_code = r.section_code
			  AND cs.academic_period_id = p_academic_period_id
			  AND sse.is_active = true
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'enrollmentNotFound'::text, NULL::integer;
		ELSIF EXISTS (
			SELECT 1
			FROM evaluation.project_students ps
			JOIN evaluation.projects p ON p.id = ps.project_id
			JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
			JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			JOIN academic.students st ON st.id = es.student_id
			JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			WHERE st.code = r.student_code
			  AND cs.academic_period_id = p_academic_period_id
			  AND p.is_active = true
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentAlreadyInProject'::text, NULL::integer;
		END IF;

		-- professorCode
		IF r.professor_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.professors p WHERE p.code = r.professor_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'professorNotFound'::text, NULL::integer;
		END IF;

		-- gradeTypeCode: must exist in TG205
		IF r.grade_type_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (
			SELECT 1 FROM core.types t
			JOIN core.type_groups tg ON tg.id = t.type_group_id
			WHERE tg.code = 'TG205' AND t.code = r.grade_type_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeTypeNotFound'::text, NULL::integer;
		END IF;

		-- At least one grade required
		IF r.o1 IS NULL AND r.o2 IS NULL AND r.o3 IS NULL AND r.o4 IS NULL
		   AND r.o5 IS NULL AND r.o6 IS NULL AND r.o7 IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'noGradesProvided'::text, NULL::integer;
		END IF;

		-- Each non-null Ox must be numeric in [0, 2]
		FOREACH v_grade_val IN ARRAY ARRAY[r.o1, r.o2, r.o3, r.o4, r.o5, r.o6, r.o7]
		LOOP
			IF v_grade_val IS NOT NULL THEN
				IF v_grade_val !~ '^-?[0-9]+(\\.([0-9]+))?$' THEN
					v_has_errors := true;
					RETURN QUERY SELECT r.row_number, 'gradeInvalid'::text, NULL::integer;
				ELSIF v_grade_val::numeric < 0 OR v_grade_val::numeric > 2 THEN
					v_has_errors := true;
					RETURN QUERY SELECT r.row_number, 'gradeOutOfRange'::text, NULL::integer;
				END IF;
			END IF;
		END LOOP;

		-- projectCode: required, globally unique
		IF r.project_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'projectCodeEmpty'::text, NULL::integer;
		ELSIF EXISTS (SELECT 1 FROM evaluation.projects p WHERE p.code = r.project_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'projectCodeDuplicate'::text, NULL::integer;
		END IF;

		-- projectNameEs: required
		IF r.project_name_es IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'projectNameEmpty'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	-- ── Phase 3: Create upload log ────────────────────────────────────────────
	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file,
		 total_rows, loaded_rows, error_rows, extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T007'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file,
		v_total, v_total, 0, '{}'::jsonb, true, NOW(), NOW()
	)
	RETURNING id INTO v_log_id;

	-- ── Phase 4: Find or create rubric + questions + criterias per group ──────
	-- Group = (commissionCode, courseCode, gradeTypeCode).
	-- One rubric per (studyPlanCourse, gradeType, MULTIPLE, CAPSTONE).
	FOR r_grp IN
		SELECT DISTINCT
			trim(e->>'commissionCode') AS commission_code,
			trim(e->>'courseCode')     AS course_code,
			trim(e->>'gradeTypeCode')  AS grade_type_code
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		SELECT spc.id INTO v_spc_id
		FROM academic.study_plan_courses spc
		JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
		JOIN academic.courses c ON c.id = spc.course_id
		WHERE spap.academic_period_id = p_academic_period_id
		  AND c.code = r_grp.course_code
		LIMIT 1;

		SELECT id INTO v_grade_type_id FROM core.types WHERE code = r_grp.grade_type_code;

		-- Find or create rubric
		SELECT id INTO v_rubric_id
		FROM evaluation.rubrics
		WHERE study_plan_course_id     = v_spc_id
		  AND grade_type_id            = v_grade_type_id
		  AND competency_scope_type_id = v_multiple_scope_type_id
		  AND rubric_type_id           = v_capstone_type_id
		  AND is_active                = true
		LIMIT 1;

		IF v_rubric_id IS NULL THEN
			INSERT INTO evaluation.rubrics
				(rubric_type_id, grade_type_id, competency_scope_type_id, study_plan_course_id,
				 upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (
				v_capstone_type_id, v_grade_type_id, v_multiple_scope_type_id, v_spc_id,
				v_log_id, '{}'::jsonb, true, NOW(), NOW()
			)
			RETURNING id INTO v_rubric_id;
		END IF;

		-- Resolve program_commission for this group
		SELECT pc.id INTO v_pc_id
		FROM accreditation.program_commissions pc
		JOIN accreditation.commissions c ON c.id = pc.commission_id
		WHERE c.code = r_grp.commission_code
		  AND pc.academic_period_id = p_academic_period_id
		LIMIT 1;

		-- For each verification outcome of this commission mapped to the course
		-- (ordered by outcome_code ASC = O1, O2, ...):
		-- find or create rubric_question and its single rubric_question_criteria.
		FOR r IN
			SELECT o.id AS outcome_id, o.outcome_description AS description
			FROM accreditation.outcomes o
			JOIN academic.course_outcome_mappings com
			     ON com.outcome_id = o.id
			     AND com.study_plan_course_id = v_spc_id
			     AND com.outcome_type_id = v_verification_outcome_type_id
			WHERE o.program_commission_id = v_pc_id
			ORDER BY o.outcome_code ASC
		LOOP
			SELECT id INTO v_question_id
			FROM evaluation.rubric_questions
			WHERE rubric_id = v_rubric_id AND outcome_id = r.outcome_id
			LIMIT 1;

			IF v_question_id IS NULL THEN
				INSERT INTO evaluation.rubric_questions
					(rubric_id, outcome_id, question, upload_log_id, extra, is_active, created_at, updated_at)
				VALUES (
					v_rubric_id, r.outcome_id, r.description,
					v_log_id, '{}'::jsonb, true, NOW(), NOW()
				)
				RETURNING id INTO v_question_id;
			END IF;

			SELECT id INTO v_criteria_id
			FROM evaluation.rubric_question_criterias
			WHERE rubric_question_id = v_question_id
			LIMIT 1;

			IF v_criteria_id IS NULL THEN
				INSERT INTO evaluation.rubric_question_criterias
					(rubric_question_id, criteria, min_value, max_value,
					 upload_log_id, extra, is_active, created_at, updated_at)
				VALUES (
					v_question_id, r.description, 0, 2,
					v_log_id, '{}'::jsonb, true, NOW(), NOW()
				)
				RETURNING id INTO v_criteria_id;
			END IF;
		END LOOP;
	END LOOP;

	-- ── Phase 5: Per-student cascade ──────────────────────────────────────────
	FOR r_stu IN
		SELECT
			trim(e->>'commissionCode')                        AS commission_code,
			trim(e->>'courseCode')                            AS course_code,
			trim(e->>'studentCode')                           AS student_code,
			trim(e->>'sectionCode')                           AS section_code,
			trim(e->>'professorCode')                         AS professor_code,
			trim(e->>'gradeTypeCode')                         AS grade_type_code,
			trim(e->>'projectCode')                           AS project_code,
			trim(e->>'projectNameEs')                         AS project_name_es,
			COALESCE(NULLIF(trim(e->>'projectNameEn'), ''), '-') AS project_name_en,
			NULLIF(trim(e->>'projectDescEs'), '')             AS project_desc_es,
			NULLIF(trim(e->>'projectDescEn'), '')             AS project_desc_en,
			NULLIF(trim(e->>'o1'), '')                        AS o1,
			NULLIF(trim(e->>'o2'), '')                        AS o2,
			NULLIF(trim(e->>'o3'), '')                        AS o3,
			NULLIF(trim(e->>'o4'), '')                        AS o4,
			NULLIF(trim(e->>'o5'), '')                        AS o5,
			NULLIF(trim(e->>'o6'), '')                        AS o6,
			NULLIF(trim(e->>'o7'), '')                        AS o7
		FROM jsonb_array_elements(p_rows) AS e
	LOOP
		-- Resolve rubric for this row's group
		SELECT spc.id INTO v_spc_id
		FROM academic.study_plan_courses spc
		JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
		JOIN academic.courses c ON c.id = spc.course_id
		WHERE spap.academic_period_id = p_academic_period_id
		  AND c.code = r_stu.course_code
		LIMIT 1;

		SELECT id INTO v_grade_type_id FROM core.types WHERE code = r_stu.grade_type_code;

		SELECT id INTO v_rubric_id
		FROM evaluation.rubrics
		WHERE study_plan_course_id     = v_spc_id
		  AND grade_type_id            = v_grade_type_id
		  AND competency_scope_type_id = v_multiple_scope_type_id
		  AND rubric_type_id           = v_capstone_type_id
		  AND is_active                = true
		LIMIT 1;

		SELECT id INTO v_professor_id
		FROM academic.professors WHERE code = r_stu.professor_code LIMIT 1;

		-- Resolve student_section_enrollment
		SELECT sse.id INTO v_sse_id
		FROM academic.student_section_enrollments sse
		JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
		JOIN academic.students st ON st.id = es.student_id
		JOIN academic.course_sections cs ON cs.id = sse.course_section_id
		WHERE st.code = r_stu.student_code
		  AND cs.section_code = r_stu.section_code
		  AND cs.academic_period_id = p_academic_period_id
		  AND sse.is_active = true
		LIMIT 1;

		-- Delete previous cascade for this student from this upload (overwrite if same student
		-- appears in multiple rows). Evaluated in order: grades → scores → evaluation → ps.
		-- Columns are qualified with aliases to avoid PL/pgSQL ambiguity with variable names.
		DELETE FROM evidence.student_course_outcome_grades scog
		WHERE scog.student_section_enrollment_id = v_sse_id
		  AND scog.upload_log_id = v_log_id;

		DELETE FROM evaluation.rubric_scores rs
		WHERE rs.upload_log_id = v_log_id
		  AND rs.evaluation_id IN (
			SELECT ev.id FROM evidence.evaluations ev
			JOIN evaluation.project_students ps ON ps.id = ev.project_student_id
			WHERE ps.student_section_enrollment_id = v_sse_id
			  AND ps.upload_log_id = v_log_id
		);

		DELETE FROM evidence.evaluations ev
		WHERE ev.upload_log_id = v_log_id
		  AND ev.project_student_id IN (
			SELECT ps.id FROM evaluation.project_students ps
			WHERE ps.student_section_enrollment_id = v_sse_id
			  AND ps.upload_log_id = v_log_id
		);

		DELETE FROM evaluation.project_students ps
		WHERE ps.student_section_enrollment_id = v_sse_id
		  AND ps.upload_log_id = v_log_id;

		-- Find or create project: reuse if already created by a previous row in this upload
		SELECT id INTO v_project_id FROM evaluation.projects WHERE code = r_stu.project_code;

		IF v_project_id IS NULL THEN
			INSERT INTO evaluation.projects
				(code, name, description, upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (
				r_stu.project_code,
				jsonb_build_object('es', r_stu.project_name_es, 'en', r_stu.project_name_en),
				CASE
					WHEN r_stu.project_desc_es IS NULL AND r_stu.project_desc_en IS NULL THEN NULL
					ELSE jsonb_build_object(
						'es', r_stu.project_desc_es,
						'en', r_stu.project_desc_en
					)
				END,
				v_log_id, '{}'::jsonb, true, NOW(), NOW()
			)
			RETURNING id INTO v_project_id;
		END IF;

		INSERT INTO evaluation.project_students
			(project_id, student_section_enrollment_id, upload_log_id, extra, is_active, created_at, updated_at)
		VALUES (v_project_id, v_sse_id, v_log_id, '{}'::jsonb, true, NOW(), NOW())
		RETURNING id INTO v_ps_id;

		-- Find or create evaluator: professor may already be linked if project is shared
		SELECT id INTO v_pe_id
		FROM evaluation.project_evaluators
		WHERE project_id = v_project_id AND professor_id = v_professor_id;

		IF v_pe_id IS NULL THEN
			INSERT INTO evaluation.project_evaluators
				(project_id, professor_id, evaluator_type_id, upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (v_project_id, v_professor_id, v_com_evaluator_type_id, v_log_id, '{}'::jsonb, true, NOW(), NOW())
			RETURNING id INTO v_pe_id;
		END IF;

		INSERT INTO evidence.evaluations
			(project_student_id, project_evaluator_id, rubric_id, qualification_status_type_id,
			 observation, register_at, upload_log_id, extra, is_active, created_at, updated_at)
		VALUES (
			v_ps_id, v_pe_id, v_rubric_id, v_asistio_status_type_id,
			NULL, NOW(), v_log_id, '{}'::jsonb, true, NOW(), NOW()
		)
		RETURNING id INTO v_eval_id;

		-- Resolve program_commission for this row
		SELECT pc.id INTO v_pc_id
		FROM accreditation.program_commissions pc
		JOIN accreditation.commissions c ON c.id = pc.commission_id
		WHERE c.code = r_stu.commission_code
		  AND pc.academic_period_id = p_academic_period_id
		LIMIT 1;

		-- Iterate over commission outcomes in order (O1=first, O2=second, ...)
		-- Insert rubric_score + student_course_outcome_grade for each non-null Ox.
		v_outcome_pos := 0;
		FOR r IN
			SELECT o.id AS outcome_id, rqc.id AS criteria_id
			FROM accreditation.outcomes o
			JOIN academic.course_outcome_mappings com
			     ON com.outcome_id = o.id
			     AND com.study_plan_course_id = v_spc_id
			     AND com.outcome_type_id = v_verification_outcome_type_id
			JOIN evaluation.rubric_questions rq
			     ON rq.rubric_id = v_rubric_id AND rq.outcome_id = o.id
			JOIN evaluation.rubric_question_criterias rqc
			     ON rqc.rubric_question_id = rq.id
			WHERE o.program_commission_id = v_pc_id
			ORDER BY o.outcome_code ASC
		LOOP
			v_outcome_pos := v_outcome_pos + 1;

			v_grade_val := CASE v_outcome_pos
				WHEN 1 THEN r_stu.o1
				WHEN 2 THEN r_stu.o2
				WHEN 3 THEN r_stu.o3
				WHEN 4 THEN r_stu.o4
				WHEN 5 THEN r_stu.o5
				WHEN 6 THEN r_stu.o6
				WHEN 7 THEN r_stu.o7
				ELSE NULL
			END;

			CONTINUE WHEN v_grade_val IS NULL;

			v_score := v_grade_val::numeric;

			INSERT INTO evaluation.rubric_scores
				(evaluation_id, rubric_question_criteria_id, score,
				 upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (v_eval_id, r.criteria_id, v_score,
			        v_log_id, '{}'::jsonb, true, NOW(), NOW());

			-- grade = score directly (1 criterion per outcome)
			INSERT INTO evidence.student_course_outcome_grades
				(student_section_enrollment_id, outcome_id, evaluation_id, grade,
				 upload_log_id, extra, is_active, created_at, updated_at)
			VALUES (v_sse_id, r.outcome_id, v_eval_id, v_score,
			        v_log_id, '{"max_outcome": 2}'::jsonb, true, NOW(), NOW());
		END LOOP;
	END LOOP;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		// ── drop pre-feature fn_rollback_grades_rv (return type changes text → void) ──
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_grades_rv(integer)`);

		// ── audit.fn_rollback_grades_rv (final, reuse-guarded) ──
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rv(p_upload_log_id integer)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- Block if this upload's rubric structure was reused (found, not recreated) by grades
	-- recorded in a later upload.
	IF EXISTS (
		SELECT 1
		FROM evaluation.rubric_scores rs
		JOIN evaluation.rubric_question_criterias rqc ON rqc.id = rs.rubric_question_criteria_id
		WHERE rqc.upload_log_id = p_upload_log_id
		  AND rs.upload_log_id IS DISTINCT FROM p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedEvaluations';
	END IF;

	-- Block if this upload's project was reused (shared) by another student evaluated in a
	-- later upload.
	IF EXISTS (
		SELECT 1
		FROM evidence.evaluations ev
		JOIN evaluation.project_students ps ON ps.id = ev.project_student_id
		JOIN evaluation.projects p ON p.id = ps.project_id
		WHERE p.upload_log_id = p_upload_log_id
		  AND ev.upload_log_id IS DISTINCT FROM p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedEvaluations';
	END IF;

	-- Delete in reverse cascade order so FK constraints are respected
	DELETE FROM evidence.student_course_outcome_grades WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_scores                WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evidence.evaluations                    WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.project_evaluators           WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.project_students             WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.projects                     WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_question_criterias    WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubric_questions             WHERE upload_log_id = p_upload_log_id;
	DELETE FROM evaluation.rubrics                      WHERE upload_log_id = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
	    rollback_at    = NOW(),
	    updated_at     = NOW()
	WHERE id = p_upload_log_id;
END;
$fn$;
`);

		// ── fix TG205 grade types + TG404 qualification statuses ──
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "EA1", "en": "EA1"}'::jsonb,
				description = '{"es": "Evaluacion Parcial 1", "en": "Midterm Evaluation 1"}'::jsonb
			WHERE code = 'TG205-T001'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "EB1", "en": "EB1"}'::jsonb,
				description = '{"es": "Evaluacion Final 1", "en": "Final Evaluation 1"}'::jsonb
			WHERE code = 'TG205-T002'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "TB1", "en": "TB1"}'::jsonb,
				description = '{"es": "Trabajo 1", "en": "Assignment 1"}'::jsonb
			WHERE code = 'TG205-T005'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "TB2", "en": "TB2"}'::jsonb,
				description = '{"es": "Trabajo 2", "en": "Assignment 2"}'::jsonb
			WHERE code = 'TG205-T006'
		`);
		await queryRunner.query(`
			INSERT INTO core.types (type_group_id, code, name, description, extra, is_active, created_at, updated_at)
			SELECT tg.id, v.code, v.name::jsonb, v.description::jsonb, '{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups tg
			JOIN (VALUES
				('TG205-T007', '{"es": "DD1", "en": "DD1"}', '{"es": "Evaluacion de Desempeno 1", "en": "Performance Evaluation 1"}'),
				('TG205-T008', '{"es": "PC1", "en": "PC1"}', '{"es": "Practica Calificada 1", "en": "Graded Practice 1"}'),
				('TG205-T009', '{"es": "PC2", "en": "PC2"}', '{"es": "Practica Calificada 2", "en": "Graded Practice 2"}')
			) AS v(code, name, description) ON true
			WHERE tg.code = 'TG205'
			ON CONFLICT (code) DO NOTHING
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				description = '{"es": "No Asistio - El alumno no asistio a la evaluacion", "en": "Did not attend - the student did not attend the evaluation"}'::jsonb
			WHERE code = 'TG404-T003'
		`);
		await queryRunner.query(`
			INSERT INTO core.types (type_group_id, code, name, description, extra, is_active, created_at, updated_at)
			SELECT tg.id, v.code, v.name::jsonb, v.description::jsonb, '{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups tg
			JOIN (VALUES
				('TG404-T004', '{"es": "DPI", "en": "DPI"}', '{"es": "Desaprobado por Inasistencias - El alumno reprueba por exceder el limite de inasistencias", "en": "Failed due to absences - the student fails for exceeding the absence limit"}'),
				('TG404-T005', '{"es": "RET", "en": "RET"}', '{"es": "Retirado - El alumno se retiro del curso", "en": "Withdrawn - the student withdrew from the course"}'),
				('TG404-T006', '{"es": "SAN", "en": "SAN"}', '{"es": "Sancionado - El alumno fue sancionado", "en": "Sanctioned - the student was sanctioned"}')
			) AS v(code, name, description) ON true
			WHERE tg.code = 'TG404'
			ON CONFLICT (code) DO NOTHING
		`);

		// ── seed RC/RV + rubric performance levels ──
		await queryRunner.query(`
			INSERT INTO academic.performance_levels
				(instrument_type_id, academic_period_id, name, code,
				 unique_value, min_score, max_score, max_value, extra, is_active)
			SELECT
				it.id,
				ap.id,
				v.name::jsonb,
				v.instr || '_' || v.code_suffix || '_' || ap.code,
				v.unique_value,
				v.min_score,
				v.max_score,
				20,
				v.extra::jsonb,
				true
			FROM academic.academic_periods ap
			CROSS JOIN (VALUES
				('TG206-T003', 'RC', 'L1', '{"es":"Necesita mejora","en":"Needs improvement"}', 1, 0.0,  12.999999, '{"color":"#dc2626"}'),
				('TG206-T003', 'RC', 'L2', '{"es":"Esperado","en":"Expected"}',                 2, 13.0, 15.999999, '{"color":"#f59e0b"}'),
				('TG206-T003', 'RC', 'L3', '{"es":"Sobresaliente","en":"Outstanding"}',          3, 16.0, 20.0,      '{"color":"#16a34a"}'),
				('TG206-T004', 'RV', 'L1', '{"es":"Necesita mejora","en":"Needs improvement"}', 1, 0.0,  12.999999, '{"color":"#dc2626"}'),
				('TG206-T004', 'RV', 'L2', '{"es":"Esperado","en":"Expected"}',                 2, 13.0, 15.999999, '{"color":"#f59e0b"}'),
				('TG206-T004', 'RV', 'L3', '{"es":"Sobresaliente","en":"Outstanding"}',          3, 16.0, 20.0,      '{"color":"#16a34a"}')
			) AS v(instr_code, instr, code_suffix, name, unique_value, min_score, max_score, extra)
			JOIN core.types it ON it.code = v.instr_code
			WHERE NOT EXISTS (
				SELECT 1 FROM academic.performance_levels pl
				WHERE pl.instrument_type_id = it.id AND pl.academic_period_id = ap.id
			);
		`);
		await queryRunner.query(`
			INSERT INTO academic.performance_levels
				(instrument_type_id, academic_period_id, name, code,
				 unique_value, min_score, max_score, max_value, extra, is_active)
			SELECT
				it.id,
				ap.id,
				v.name::jsonb,
				'PL_' || v.code_suffix || '_' || ap.code,
				v.unique_value,
				v.min_score,
				v.max_score,
				20,
				'{}'::jsonb,
				true
			FROM academic.academic_periods ap
			CROSS JOIN (VALUES
				('STARTING',   '{"es":"Inicial","en":"Starting"}',       1, 0.0,  10.999999),
				('DEVELOPING', '{"es":"En desarrollo","en":"Developing"}', 2, 11.0, 13.999999),
				('EXPECTED',   '{"es":"Esperado","en":"Expected"}',       3, 14.0, 16.999999),
				('EXCELLENT',  '{"es":"Excelente","en":"Excellent"}',     4, 17.0, 20.0)
			) AS v(code_suffix, name, unique_value, min_score, max_score)
			JOIN core.types it ON it.code = 'TG206-T001'
			WHERE NOT EXISTS (
				SELECT 1 FROM academic.performance_levels pl
				WHERE pl.instrument_type_id = it.id AND pl.academic_period_id = ap.id
			);
		`);

		// ── audit.fn_rollback_grades_rc ──
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

	-- restore updated grades by popping this upload's (top) upload_undo entry, then drop inserts.
	-- qualification_status_type_id is restored from the popped snapshot (removed if it was unset
	-- before this upload touched the row); every other key in extra is left untouched.
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (scg.extra->'upload_undo' -> -1 ->> 'grade_type_percentage')::numeric,
		grade = (scg.extra->'upload_undo' -> -1 ->> 'grade')::numeric,
		extra = (
			(CASE
				WHEN jsonb_array_length(scg.extra->'upload_undo') <= 1 THEN scg.extra - 'upload_undo'
				ELSE jsonb_set(scg.extra, '{upload_undo}', (scg.extra->'upload_undo') - (-1))
			END) - 'qualification_status_type_id'
			|| CASE
				WHEN (scg.extra->'upload_undo' -> -1 ->> 'qualification_status_type_id') IS NOT NULL
				THEN jsonb_build_object(
					'qualification_status_type_id',
					(scg.extra->'upload_undo' -> -1 ->> 'qualification_status_type_id')::int
				)
				ELSE '{}'::jsonb
			END
		),
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

		// ── audit.fn_upload_grades_rc (final, auto-create qualification status) ──
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
			NULLIF(trim(e->>'grade'), '')                AS grade,
			NULLIF(trim(e->>'qualificationStatusCode'), '') AS qualification_status_code
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

		-- qualification status code/text is required; it no longer has to already exist in TG404 --
		-- unrecognized values (by code or by name) are auto-provisioned below, before the insert.
		IF r.qualification_status_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'qualificationStatusEmpty'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	-- Auto-provision any qualificationStatusCode value (matched by code OR name) that TG404
	-- doesn't have yet. Banner (or the notas-rc scraping export) may hand us either the real code
	-- (TG404-Txxx) or the raw status text (e.g. "PEN") when it isn't in the catalog yet; either
	-- way, resolve or create it here so the insert/update join below always finds a match.
	FOR r IN
		SELECT DISTINCT trim(e->>'qualificationStatusCode') AS raw_code
		FROM jsonb_array_elements(p_rows) AS e
		WHERE NULLIF(trim(e->>'qualificationStatusCode'), '') IS NOT NULL
	LOOP
		IF NOT EXISTS (
			SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
			WHERE g.code = 'TG404'
			  AND (t.code = r.raw_code OR UPPER(t.name->>'es') = UPPER(r.raw_code))
		) THEN
			INSERT INTO core.types
				(type_group_id, code, name, description, extra, is_active, created_at, updated_at)
			SELECT
				tg.id,
				'TG404-T' || LPAD((
					COALESCE(MAX(SUBSTRING(t2.code FROM 'T(\\d+)$')::int), 0) + 1
				)::text, 3, '0'),
				jsonb_build_object('es', r.raw_code, 'en', r.raw_code),
				jsonb_build_object('es', r.raw_code, 'en', r.raw_code),
				'{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups tg
			LEFT JOIN core.types t2 ON t2.type_group_id = tg.id
			WHERE tg.code = 'TG404'
			GROUP BY tg.id;
		END IF;
	END LOOP;

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
		jsonb_build_object('qualification_status_type_id', qt.id),
		true, NOW(), NOW()
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	JOIN core.type_groups qg ON qg.code = 'TG404'
	JOIN core.types qt ON qt.type_group_id = qg.id
		AND (qt.code = trim(e->>'qualificationStatusCode')
		     OR UPPER(qt.name->>'es') = UPPER(trim(e->>'qualificationStatusCode')))
	WHERE NOT EXISTS (
		SELECT 1 FROM academic.student_course_grades scg
		WHERE scg.student_section_enrollment_id = sse.id AND scg.grade_type_id = t.id
	);

	-- update grades that already existed (push prior values onto the extra.upload_undo stack).
	-- extra is rebuilt from the row's own current extra: jsonb_set only replaces the upload_undo
	-- key, and the concatenation on top only replaces qualification_status_type_id -- any other
	-- key already in extra (added by another flow) survives untouched.
	UPDATE academic.student_course_grades scg
	SET grade_type_percentage = (e->>'gradeTypePercentage')::numeric,
		grade = (e->>'grade')::numeric,
		updated_at = NOW(),
		extra = (
			jsonb_set(COALESCE(scg.extra, '{}'::jsonb), '{upload_undo}',
				COALESCE(scg.extra->'upload_undo', '[]'::jsonb) ||
				jsonb_build_object(
					'log_id', v_log_id,
					'grade_type_percentage', scg.grade_type_percentage,
					'grade', scg.grade,
					'qualification_status_type_id', scg.extra->'qualification_status_type_id'
				))
			|| jsonb_build_object('qualification_status_type_id', qt.id)
		)
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.course_sections cs ON cs.section_code = trim(e->>'sectionCode')
	JOIN academic.student_section_enrollments sse ON sse.course_section_id = cs.id
	JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
	JOIN academic.students st ON st.id = es.student_id AND st.code = trim(e->>'studentCode')
	JOIN core.type_groups g ON g.code = 'TG205'
	JOIN core.types t ON t.type_group_id = g.id AND t.code = trim(e->>'gradeTypeCode')
	JOIN core.type_groups qg ON qg.code = 'TG404'
	JOIN core.types qt ON qt.type_group_id = qg.id
		AND (qt.code = trim(e->>'qualificationStatusCode')
		     OR UPPER(qt.name->>'es') = UPPER(trim(e->>'qualificationStatusCode')))
	WHERE scg.student_section_enrollment_id = sse.id
	  AND scg.grade_type_id = t.id
	  AND scg.upload_log_id IS DISTINCT FROM v_log_id;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		// ── evaluation.project_groups table + evaluation.projects.project_group_id ──
		await queryRunner.query(
			`CREATE TABLE "evaluation"."project_groups" (` +
				`"id" SERIAL NOT NULL, ` +
				`"extra" jsonb NOT NULL DEFAULT '{}'::jsonb, ` +
				`"is_active" boolean NOT NULL DEFAULT true, ` +
				`"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(), ` +
				`"updated_at" TIMESTAMP WITH TIME ZONE, ` +
				`"code" character varying(50) NOT NULL, ` +
				`"name" jsonb NOT NULL DEFAULT '{}'::jsonb, ` +
				`"description" jsonb DEFAULT '{}'::jsonb, ` +
				`"academic_period_id" integer NOT NULL, ` +
				`"program_id" integer NOT NULL, ` +
				`CONSTRAINT "PK_project_groups" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_project_groups_code_period_program" ` +
				`ON "evaluation"."project_groups" ("code", "academic_period_id", "program_id")`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" ADD CONSTRAINT "FK_project_groups_academic_period_id" ` +
				`FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ` +
				`ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" ADD CONSTRAINT "FK_project_groups_program_id" ` +
				`FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ` +
				`ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" ADD COLUMN "project_group_id" integer`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_projects_project_group_id" ON "evaluation"."projects" ("project_group_id")`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" ADD CONSTRAINT "FK_projects_project_group_id" ` +
				`FOREIGN KEY ("project_group_id") REFERENCES "evaluation"."project_groups"("id") ` +
				`ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		// ── project_groups.upload_log_id + audit.fn_upload_projects / fn_rollback_projects ──
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" ADD COLUMN "upload_log_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" ADD CONSTRAINT "FK_project_groups_upload_log_id" ` +
				`FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ` +
				`ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);
		await queryRunner.query(`
            CREATE OR REPLACE FUNCTION audit.fn_upload_projects(
                p_rows               jsonb,
                p_academic_period_id integer,
                p_user_id            integer,
                p_source_file        text
            )
            RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
            LANGUAGE plpgsql
            AS $fn$
            DECLARE
                v_eval_type_codes  text[]  := ARRAY['TG403-T001','TG403-T002','TG403-T003','TG403-T004','TG403-T005'];
                v_total            integer := jsonb_array_length(p_rows);
                v_has_errors       boolean := false;
                v_log_id           integer;
                v_project_id       integer;
                v_course_id        integer;
                v_existing_id      integer;
                v_eval_type_id     integer;
                v_program_id       integer;
                v_project_group_id integer;
                r                  record;
                r_proj             record;
                r_stu              record;
                v_eval_type_code   text;
                v_prof_code        text;
                v_prof_codes_str   text;
                v_prof_codes       text[];
                v_err_row          integer;
                v_max_evaluators   integer;
            BEGIN
                -- ── Phase 1: per-row structural validation ─────────────────────────────
                FOR r IN
                    SELECT
                        (e->>'rowNumber')::int                AS row_number,
                        NULLIF(trim(e->>'projectCode'),  '')  AS project_code,
                        NULLIF(trim(e->>'courseCode'),   '')  AS course_code,
                        NULLIF(trim(e->>'studentCode'),  '')  AS student_code
                    FROM jsonb_array_elements(p_rows) AS e
                LOOP
                    IF r.project_code IS NULL THEN
                        v_has_errors := true;
                        RETURN QUERY SELECT r.row_number, 'projectCodeEmpty'::text, NULL::integer;
                        CONTINUE;
                    END IF;
                    IF char_length(r.project_code) > 50 THEN
                        v_has_errors := true;
                        RETURN QUERY SELECT r.row_number, 'projectCodeTooLong'::text, NULL::integer;
                        CONTINUE;
                    END IF;
                    IF r.course_code IS NULL THEN
                        v_has_errors := true;
                        RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
                        CONTINUE;
                    END IF;
                END LOOP;

                IF v_has_errors THEN RETURN; END IF;

                -- ── Phase 2: cross-DB validation per project ───────────────────────────
                FOR r_proj IN
                    SELECT
                        trim(e->>'projectCode')                       AS project_code,
                        trim(e->>'courseCode')                        AS course_code,
                        MAX(NULLIF(trim(e->>'projectNameEs'), ''))    AS project_name_es,
                        MAX(NULLIF(trim(e->>'projectNameEn'), ''))    AS project_name_en,
                        MAX(NULLIF(trim(e->>'projectGroupCode'), '')) AS project_group_code,
                        bool_or(NULLIF(trim(e->>'studentCode'), '') IS NOT NULL) AS has_student
                    FROM jsonb_array_elements(p_rows) AS e
                    GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
                LOOP
                    IF NOT EXISTS (
                        SELECT 1 FROM academic.courses c WHERE c.code = r_proj.course_code
                    ) THEN
                        v_has_errors := true;
                        RETURN QUERY
                            SELECT (e->>'rowNumber')::int, 'courseNotFound'::text, NULL::integer
                            FROM jsonb_array_elements(p_rows) AS e
                            WHERE trim(e->>'projectCode') = r_proj.project_code
                            LIMIT 1;
                        CONTINUE;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1
                        FROM academic.study_plan_courses spc
                        JOIN academic.study_plan_academic_periods spap
                             ON spap.id = spc.study_plan_academic_period_id
                        WHERE spc.course_id = (SELECT id FROM academic.courses WHERE code = r_proj.course_code)
                          AND spap.academic_period_id = p_academic_period_id
                          AND (spc.extra->>'is_evaluable')::boolean = true
                    ) THEN
                        v_has_errors := true;
                        RETURN QUERY
                            SELECT (e->>'rowNumber')::int, 'courseNotEvaluable'::text, NULL::integer
                            FROM jsonb_array_elements(p_rows) AS e
                            WHERE trim(e->>'projectCode') = r_proj.project_code
                            LIMIT 1;
                        CONTINUE;
                    END IF;

                    SELECT p.id INTO v_existing_id
                    FROM evaluation.projects p
                    JOIN evaluation.project_students ps  ON ps.project_id = p.id
                    JOIN academic.student_section_enrollments sse
                         ON sse.id = ps.student_section_enrollment_id
                    JOIN academic.course_sections cs     ON cs.id = sse.course_section_id
                    WHERE p.code = r_proj.project_code
                      AND cs.academic_period_id = p_academic_period_id
                    LIMIT 1;

                    IF v_existing_id IS NULL THEN
                        IF r_proj.project_name_es IS NULL OR r_proj.project_name_en IS NULL THEN
                            v_has_errors := true;
                            RETURN QUERY
                                SELECT (e->>'rowNumber')::int, 'projectNameEmpty'::text, NULL::integer
                                FROM jsonb_array_elements(p_rows) AS e
                                WHERE trim(e->>'projectCode') = r_proj.project_code
                                LIMIT 1;
                            CONTINUE;
                        END IF;

                        IF NOT r_proj.has_student THEN
                            v_has_errors := true;
                            RETURN QUERY
                                SELECT (e->>'rowNumber')::int, 'newProjectRequiresStudent'::text, NULL::integer
                                FROM jsonb_array_elements(p_rows) AS e
                                WHERE trim(e->>'projectCode') = r_proj.project_code
                                LIMIT 1;
                            CONTINUE;
                        END IF;

                        -- new projects must declare a project group (empresa virtual)
                        IF r_proj.project_group_code IS NULL THEN
                            v_has_errors := true;
                            RETURN QUERY
                                SELECT (e->>'rowNumber')::int, 'projectGroupCodeRequired'::text, NULL::integer
                                FROM jsonb_array_elements(p_rows) AS e
                                WHERE trim(e->>'projectCode') = r_proj.project_code
                                LIMIT 1;
                            CONTINUE;
                        END IF;

                        FOR r_stu IN
                            SELECT
                                (e->>'rowNumber')::int               AS row_number,
                                NULLIF(trim(e->>'studentCode'), '')  AS student_code
                            FROM jsonb_array_elements(p_rows) AS e
                            WHERE trim(e->>'projectCode') = r_proj.project_code
                              AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
                        LOOP
                            IF NOT EXISTS (
                                SELECT 1 FROM academic.students s WHERE s.code = r_stu.student_code
                            ) THEN
                                v_has_errors := true;
                                RETURN QUERY SELECT r_stu.row_number, 'studentNotFound'::text, NULL::integer;
                                CONTINUE;
                            END IF;

                            IF NOT EXISTS (
                                SELECT 1
                                FROM academic.student_section_enrollments sse
                                JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
                                JOIN academic.course_sections cs   ON cs.id = sse.course_section_id
                                JOIN academic.courses c            ON c.id  = cs.course_id
                                WHERE es.student_id = (SELECT id FROM academic.students WHERE code = r_stu.student_code)
                                  AND c.code = r_proj.course_code
                                  AND cs.academic_period_id = p_academic_period_id
                                  AND sse.is_active = true
                            ) THEN
                                v_has_errors := true;
                                RETURN QUERY SELECT r_stu.row_number, 'studentNotInCourse'::text, NULL::integer;
                                CONTINUE;
                            END IF;

                            IF EXISTS (
                                SELECT 1
                                FROM evaluation.project_students ps2
                                JOIN evaluation.projects p2  ON p2.id = ps2.project_id
                                JOIN academic.student_section_enrollments sse2
                                     ON sse2.id = ps2.student_section_enrollment_id
                                JOIN academic.course_sections cs2 ON cs2.id = sse2.course_section_id
                                JOIN academic.enrolled_students es2 ON es2.id = sse2.enrolled_student_id
                                WHERE es2.student_id = (
                                    SELECT s.id FROM academic.students s WHERE s.code = r_stu.student_code
                                )
                                  AND cs2.academic_period_id = p_academic_period_id
                                  AND p2.is_active = true
                            ) THEN
                                v_has_errors := true;
                                RETURN QUERY SELECT r_stu.row_number, 'studentAlreadyInProject'::text, NULL::integer;
                                CONTINUE;
                            END IF;
                        END LOOP;
                    END IF;

                    FOREACH v_eval_type_code IN ARRAY v_eval_type_codes LOOP
                        v_err_row        := NULL;
                        v_prof_codes_str := NULL;

                        SELECT (e->>'rowNumber')::int,
                               NULLIF(trim(e->'evaluators'->>v_eval_type_code), '')
                        INTO   v_err_row, v_prof_codes_str
                        FROM   jsonb_array_elements(p_rows) AS e
                        WHERE  trim(e->>'projectCode') = r_proj.project_code
                          AND  NULLIF(trim(e->'evaluators'->>v_eval_type_code), '') IS NOT NULL
                        LIMIT 1;

                        CONTINUE WHEN v_prof_codes_str IS NULL;

                        v_prof_codes := ARRAY(
                            SELECT trim(pc)
                            FROM   unnest(string_to_array(v_prof_codes_str, ',')) AS pc
                            WHERE  trim(pc) <> ''
                        );

                        SELECT (t.extra->>'max_evaluators')::int
                        INTO   v_max_evaluators
                        FROM   core.types t
                        WHERE  t.code = v_eval_type_code;

                        IF v_max_evaluators IS NOT NULL AND array_length(v_prof_codes, 1) > v_max_evaluators THEN
                            v_has_errors := true;
                            RETURN QUERY SELECT v_err_row, 'multipleEvaluatorsNotAllowed'::text, NULL::integer;
                            CONTINUE;
                        END IF;

                        FOREACH v_prof_code IN ARRAY v_prof_codes LOOP
                            IF NOT EXISTS (
                                SELECT 1 FROM academic.professors p WHERE p.code = v_prof_code
                            ) THEN
                                v_has_errors := true;
                                RETURN QUERY SELECT v_err_row, 'professorNotFound'::text, NULL::integer;
                            END IF;
                        END LOOP;
                    END LOOP;
                END LOOP;

                IF v_has_errors THEN RETURN; END IF;

                -- ── Phase 3: Insert / Update ───────────────────────────────────────────
                INSERT INTO audit.upload_logs
                    (upload_type_id, status_type_id, academic_period_id, user_id, source_file,
                     total_rows, loaded_rows, error_rows, extra, is_active, created_at, updated_at)
                VALUES (
                    (SELECT id FROM core.types WHERE code = 'TG1101-T011'),
                    (SELECT id FROM core.types WHERE code = 'TG1102-T001'),
                    p_academic_period_id, p_user_id, p_source_file,
                    v_total, v_total, 0, '{}'::jsonb, true, NOW(), NOW()
                )
                RETURNING id INTO v_log_id;

                FOR r_proj IN
                    SELECT
                        trim(e->>'projectCode')                       AS project_code,
                        trim(e->>'courseCode')                        AS course_code,
                        MAX(NULLIF(trim(e->>'projectNameEs'), ''))    AS project_name_es,
                        MAX(NULLIF(trim(e->>'projectNameEn'), ''))    AS project_name_en,
                        MAX(NULLIF(trim(e->>'projectGroupCode'), '')) AS project_group_code,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T001'), '')) AS eval_t001,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T002'), '')) AS eval_t002,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T003'), '')) AS eval_t003,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T004'), '')) AS eval_t004,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T005'), '')) AS eval_t005
                    FROM jsonb_array_elements(p_rows) AS e
                    GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
                LOOP
                    SELECT c.id INTO v_course_id
                    FROM academic.courses c WHERE c.code = r_proj.course_code;

                    SELECT p.id INTO v_existing_id
                    FROM evaluation.projects p
                    JOIN evaluation.project_students ps  ON ps.project_id = p.id
                    JOIN academic.student_section_enrollments sse
                         ON sse.id = ps.student_section_enrollment_id
                    JOIN academic.course_sections cs     ON cs.id = sse.course_section_id
                    WHERE p.code = r_proj.project_code
                      AND cs.academic_period_id = p_academic_period_id
                    LIMIT 1;

                    IF v_existing_id IS NULL THEN
                        -- derive the program (career) from the course's evaluable study plan
                        SELECT sp.program_id INTO v_program_id
                        FROM academic.study_plan_courses spc
                        JOIN academic.study_plan_academic_periods spap
                             ON spap.id = spc.study_plan_academic_period_id
                        JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
                        WHERE spc.course_id = v_course_id
                          AND spap.academic_period_id = p_academic_period_id
                          AND (spc.extra->>'is_evaluable')::boolean = true
                        ORDER BY sp.program_id
                        LIMIT 1;

                        -- resolve or create the project group (empresa virtual)
                        SELECT pg.id INTO v_project_group_id
                        FROM evaluation.project_groups pg
                        WHERE pg.code = r_proj.project_group_code
                          AND pg.academic_period_id = p_academic_period_id
                          AND pg.program_id = v_program_id
                        LIMIT 1;

                        IF v_project_group_id IS NULL THEN
                            INSERT INTO evaluation.project_groups
                                (code, name, description, academic_period_id, program_id,
                                 upload_log_id, extra, is_active, created_at, updated_at)
                            VALUES (
                                r_proj.project_group_code,
                                jsonb_build_object('es', r_proj.project_group_code, 'en', r_proj.project_group_code),
                                '{}'::jsonb, p_academic_period_id, v_program_id,
                                v_log_id, '{}'::jsonb, true, NOW(), NOW()
                            )
                            RETURNING id INTO v_project_group_id;
                        END IF;

                        INSERT INTO evaluation.projects
                            (code, name, description, project_group_id, upload_log_id,
                             extra, is_active, created_at, updated_at)
                        VALUES (
                            r_proj.project_code,
                            jsonb_build_object('es', r_proj.project_name_es, 'en', r_proj.project_name_en),
                            '{}'::jsonb, v_project_group_id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
                        )
                        RETURNING id INTO v_project_id;

                        -- auto-select first section (alphabetically by section_code) per student
                        INSERT INTO evaluation.project_students
                            (project_id, student_section_enrollment_id, upload_log_id, extra, is_active, created_at, updated_at)
                        SELECT DISTINCT ON (st.code)
                            v_project_id, sse.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
                        FROM jsonb_array_elements(p_rows) AS e
                        JOIN academic.students st           ON st.code = trim(e->>'studentCode')
                        JOIN academic.enrolled_students enr ON enr.student_id = st.id
                        JOIN academic.student_section_enrollments sse ON sse.enrolled_student_id = enr.id
                        JOIN academic.course_sections cs    ON cs.id = sse.course_section_id
                        WHERE trim(e->>'projectCode') = r_proj.project_code
                          AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
                          AND cs.course_id = v_course_id
                          AND cs.academic_period_id = p_academic_period_id
                          AND sse.is_active = true
                        ORDER BY st.code, cs.section_code ASC;
                    ELSE
                        v_project_id := v_existing_id;
                    END IF;

                    FOREACH v_eval_type_code IN ARRAY v_eval_type_codes LOOP
                        DECLARE
                            v_eval_codes_str text;
                            v_eval_codes     text[];
                        BEGIN
                            CASE v_eval_type_code
                                WHEN 'TG403-T001' THEN v_eval_codes_str := r_proj.eval_t001;
                                WHEN 'TG403-T002' THEN v_eval_codes_str := r_proj.eval_t002;
                                WHEN 'TG403-T003' THEN v_eval_codes_str := r_proj.eval_t003;
                                WHEN 'TG403-T004' THEN v_eval_codes_str := r_proj.eval_t004;
                                WHEN 'TG403-T005' THEN v_eval_codes_str := r_proj.eval_t005;
                                ELSE v_eval_codes_str := NULL;
                            END CASE;

                            -- empty cell → v_eval_codes = '{}' → UPDATE deactivates all of this type
                            v_eval_codes := ARRAY(
                                SELECT trim(pc)
                                FROM   unnest(string_to_array(v_eval_codes_str, ',')) AS pc
                                WHERE  trim(pc) <> ''
                            );

                            SELECT t.id INTO v_eval_type_id
                            FROM core.types t WHERE t.code = v_eval_type_code;

                            -- deactivate all evaluators of this type not in the new list
                            -- (if new list is empty, all are deactivated)
                            UPDATE evaluation.project_evaluators pe
                            SET    is_active = false,
                                   deactivated_by_upload_log_id = v_log_id,
                                   updated_at = NOW()
                            WHERE  pe.project_id       = v_project_id
                              AND  pe.evaluator_type_id = v_eval_type_id
                              AND  pe.is_active         = true
                              AND  pe.professor_id NOT IN (
                                  SELECT p.id FROM academic.professors p
                                  WHERE p.code = ANY(v_eval_codes)
                              );

                            INSERT INTO evaluation.project_evaluators
                                (project_id, professor_id, evaluator_type_id, upload_log_id,
                                 is_active, created_at, updated_at)
                            SELECT
                                v_project_id, p.id, v_eval_type_id, v_log_id, true, NOW(), NOW()
                            FROM academic.professors p
                            WHERE p.code = ANY(v_eval_codes)
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM evaluation.project_evaluators pe2
                                  WHERE pe2.project_id       = v_project_id
                                    AND pe2.professor_id     = p.id
                                    AND pe2.evaluator_type_id = v_eval_type_id
                                    AND pe2.is_active         = true
                              );
                        END;
                    END LOOP;
                END LOOP;

                RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
            END;
            $fn$;
        `);
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_projects(p_upload_log_id integer)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
        RAISE EXCEPTION 'uploadLogNotFound';
    END IF;

    -- block if any project newly created by this upload already has rubric evaluations
    IF EXISTS (
        SELECT 1
        FROM evaluation.rubric_scores rs
        JOIN evidence.evaluations ev        ON ev.id  = rs.evaluation_id
        JOIN evaluation.project_students ps ON ps.id  = ev.project_student_id
        JOIN evaluation.projects p          ON p.id   = ps.project_id
        WHERE p.upload_log_id = p_upload_log_id
    ) THEN
        RAISE EXCEPTION 'rollbackBlockedEvaluations';
    END IF;

    -- restore evaluators deactivated by this upload (on pre-existing projects)
    UPDATE evaluation.project_evaluators
    SET    is_active = true,
           deactivated_by_upload_log_id = NULL,
           updated_at = NOW()
    WHERE  deactivated_by_upload_log_id = p_upload_log_id;

    -- remove evaluators added by this upload to pre-existing projects
    DELETE FROM evaluation.project_evaluators
    WHERE  upload_log_id = p_upload_log_id
      AND  project_id NOT IN (
               SELECT id FROM evaluation.projects WHERE upload_log_id = p_upload_log_id
           );

    -- remove all data for newly created projects
    DELETE FROM evaluation.project_evaluators
    WHERE  project_id IN (
               SELECT id FROM evaluation.projects WHERE upload_log_id = p_upload_log_id
           );

    DELETE FROM evaluation.project_students
    WHERE  project_id IN (
               SELECT id FROM evaluation.projects WHERE upload_log_id = p_upload_log_id
           );

    DELETE FROM evaluation.projects WHERE upload_log_id = p_upload_log_id;

    -- drop project groups this upload auto-created that no longer have any projects
    DELETE FROM evaluation.project_groups pg
    WHERE  pg.upload_log_id = p_upload_log_id
      AND  NOT EXISTS (
               SELECT 1 FROM evaluation.projects p WHERE p.project_group_id = pg.id
           );

    UPDATE audit.upload_logs
    SET    status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
           rollback_at    = NOW(),
           updated_at     = NOW()
    WHERE  id = p_upload_log_id;
END;
$fn$;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// ── restore fn_rollback_projects / fn_upload_projects; drop project_groups.upload_log_id ──
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_projects(p_upload_log_id integer)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
        RAISE EXCEPTION 'uploadLogNotFound';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM evaluation.rubric_scores rs
        JOIN evidence.evaluations ev        ON ev.id  = rs.evaluation_id
        JOIN evaluation.project_students ps ON ps.id  = ev.project_student_id
        JOIN evaluation.projects p          ON p.id   = ps.project_id
        WHERE p.upload_log_id = p_upload_log_id
    ) THEN
        RAISE EXCEPTION 'rollbackBlockedEvaluations';
    END IF;

    UPDATE evaluation.project_evaluators
    SET    is_active = true,
           deactivated_by_upload_log_id = NULL,
           updated_at = NOW()
    WHERE  deactivated_by_upload_log_id = p_upload_log_id;

    DELETE FROM evaluation.project_evaluators
    WHERE  upload_log_id = p_upload_log_id
      AND  project_id NOT IN (
               SELECT id FROM evaluation.projects WHERE upload_log_id = p_upload_log_id
           );

    DELETE FROM evaluation.project_evaluators
    WHERE  project_id IN (
               SELECT id FROM evaluation.projects WHERE upload_log_id = p_upload_log_id
           );

    DELETE FROM evaluation.project_students
    WHERE  project_id IN (
               SELECT id FROM evaluation.projects WHERE upload_log_id = p_upload_log_id
           );

    DELETE FROM evaluation.projects WHERE upload_log_id = p_upload_log_id;

    UPDATE audit.upload_logs
    SET    status_type_id = (SELECT id FROM core.types WHERE code = 'TG1102-T002'),
           rollback_at    = NOW(),
           updated_at     = NOW()
    WHERE  id = p_upload_log_id;
END;
$fn$;
`);
		await queryRunner.query(`
            CREATE OR REPLACE FUNCTION audit.fn_upload_projects(
                p_rows               jsonb,
                p_academic_period_id integer,
                p_user_id            integer,
                p_source_file        text
            )
            RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
            LANGUAGE plpgsql
            AS $fn$
            DECLARE
                v_eval_type_codes  text[]  := ARRAY['TG403-T001','TG403-T002','TG403-T003','TG403-T004','TG403-T005'];
                v_total            integer := jsonb_array_length(p_rows);
                v_has_errors       boolean := false;
                v_log_id           integer;
                v_project_id       integer;
                v_course_id        integer;
                v_existing_id      integer;
                v_eval_type_id     integer;
                r                  record;
                r_proj             record;
                r_stu              record;
                v_eval_type_code   text;
                v_prof_code        text;
                v_prof_codes_str   text;
                v_prof_codes       text[];
                v_err_row          integer;
                v_max_evaluators   integer;
            BEGIN
                FOR r IN
                    SELECT
                        (e->>'rowNumber')::int                AS row_number,
                        NULLIF(trim(e->>'projectCode'),  '')  AS project_code,
                        NULLIF(trim(e->>'courseCode'),   '')  AS course_code,
                        NULLIF(trim(e->>'studentCode'),  '')  AS student_code
                    FROM jsonb_array_elements(p_rows) AS e
                LOOP
                    IF r.project_code IS NULL THEN
                        v_has_errors := true;
                        RETURN QUERY SELECT r.row_number, 'projectCodeEmpty'::text, NULL::integer;
                        CONTINUE;
                    END IF;
                    IF char_length(r.project_code) > 50 THEN
                        v_has_errors := true;
                        RETURN QUERY SELECT r.row_number, 'projectCodeTooLong'::text, NULL::integer;
                        CONTINUE;
                    END IF;
                    IF r.course_code IS NULL THEN
                        v_has_errors := true;
                        RETURN QUERY SELECT r.row_number, 'courseCodeEmpty'::text, NULL::integer;
                        CONTINUE;
                    END IF;
                END LOOP;

                IF v_has_errors THEN RETURN; END IF;

                FOR r_proj IN
                    SELECT
                        trim(e->>'projectCode')                    AS project_code,
                        trim(e->>'courseCode')                     AS course_code,
                        MAX(NULLIF(trim(e->>'projectNameEs'), '')) AS project_name_es,
                        MAX(NULLIF(trim(e->>'projectNameEn'), '')) AS project_name_en,
                        bool_or(NULLIF(trim(e->>'studentCode'), '') IS NOT NULL) AS has_student
                    FROM jsonb_array_elements(p_rows) AS e
                    GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
                LOOP
                    IF NOT EXISTS (
                        SELECT 1 FROM academic.courses c WHERE c.code = r_proj.course_code
                    ) THEN
                        v_has_errors := true;
                        RETURN QUERY
                            SELECT (e->>'rowNumber')::int, 'courseNotFound'::text, NULL::integer
                            FROM jsonb_array_elements(p_rows) AS e
                            WHERE trim(e->>'projectCode') = r_proj.project_code
                            LIMIT 1;
                        CONTINUE;
                    END IF;

                    IF NOT EXISTS (
                        SELECT 1
                        FROM academic.study_plan_courses spc
                        JOIN academic.study_plan_academic_periods spap
                             ON spap.id = spc.study_plan_academic_period_id
                        WHERE spc.course_id = (SELECT id FROM academic.courses WHERE code = r_proj.course_code)
                          AND spap.academic_period_id = p_academic_period_id
                          AND (spc.extra->>'is_evaluable')::boolean = true
                    ) THEN
                        v_has_errors := true;
                        RETURN QUERY
                            SELECT (e->>'rowNumber')::int, 'courseNotEvaluable'::text, NULL::integer
                            FROM jsonb_array_elements(p_rows) AS e
                            WHERE trim(e->>'projectCode') = r_proj.project_code
                            LIMIT 1;
                        CONTINUE;
                    END IF;

                    SELECT p.id INTO v_existing_id
                    FROM evaluation.projects p
                    JOIN evaluation.project_students ps  ON ps.project_id = p.id
                    JOIN academic.student_section_enrollments sse
                         ON sse.id = ps.student_section_enrollment_id
                    JOIN academic.course_sections cs     ON cs.id = sse.course_section_id
                    WHERE p.code = r_proj.project_code
                      AND cs.academic_period_id = p_academic_period_id
                    LIMIT 1;

                    IF v_existing_id IS NULL THEN
                        IF r_proj.project_name_es IS NULL OR r_proj.project_name_en IS NULL THEN
                            v_has_errors := true;
                            RETURN QUERY
                                SELECT (e->>'rowNumber')::int, 'projectNameEmpty'::text, NULL::integer
                                FROM jsonb_array_elements(p_rows) AS e
                                WHERE trim(e->>'projectCode') = r_proj.project_code
                                LIMIT 1;
                            CONTINUE;
                        END IF;

                        IF NOT r_proj.has_student THEN
                            v_has_errors := true;
                            RETURN QUERY
                                SELECT (e->>'rowNumber')::int, 'newProjectRequiresStudent'::text, NULL::integer
                                FROM jsonb_array_elements(p_rows) AS e
                                WHERE trim(e->>'projectCode') = r_proj.project_code
                                LIMIT 1;
                            CONTINUE;
                        END IF;

                        FOR r_stu IN
                            SELECT
                                (e->>'rowNumber')::int               AS row_number,
                                NULLIF(trim(e->>'studentCode'), '')  AS student_code
                            FROM jsonb_array_elements(p_rows) AS e
                            WHERE trim(e->>'projectCode') = r_proj.project_code
                              AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
                        LOOP
                            IF NOT EXISTS (
                                SELECT 1 FROM academic.students s WHERE s.code = r_stu.student_code
                            ) THEN
                                v_has_errors := true;
                                RETURN QUERY SELECT r_stu.row_number, 'studentNotFound'::text, NULL::integer;
                                CONTINUE;
                            END IF;

                            IF NOT EXISTS (
                                SELECT 1
                                FROM academic.student_section_enrollments sse
                                JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
                                JOIN academic.course_sections cs   ON cs.id = sse.course_section_id
                                JOIN academic.courses c            ON c.id  = cs.course_id
                                WHERE es.student_id = (SELECT id FROM academic.students WHERE code = r_stu.student_code)
                                  AND c.code = r_proj.course_code
                                  AND cs.academic_period_id = p_academic_period_id
                                  AND sse.is_active = true
                            ) THEN
                                v_has_errors := true;
                                RETURN QUERY SELECT r_stu.row_number, 'studentNotInCourse'::text, NULL::integer;
                                CONTINUE;
                            END IF;

                            IF EXISTS (
                                SELECT 1
                                FROM evaluation.project_students ps2
                                JOIN evaluation.projects p2  ON p2.id = ps2.project_id
                                JOIN academic.student_section_enrollments sse2
                                     ON sse2.id = ps2.student_section_enrollment_id
                                JOIN academic.course_sections cs2 ON cs2.id = sse2.course_section_id
                                JOIN academic.enrolled_students es2 ON es2.id = sse2.enrolled_student_id
                                WHERE es2.student_id = (
                                    SELECT s.id FROM academic.students s WHERE s.code = r_stu.student_code
                                )
                                  AND cs2.academic_period_id = p_academic_period_id
                                  AND p2.is_active = true
                            ) THEN
                                v_has_errors := true;
                                RETURN QUERY SELECT r_stu.row_number, 'studentAlreadyInProject'::text, NULL::integer;
                                CONTINUE;
                            END IF;
                        END LOOP;
                    END IF;

                    FOREACH v_eval_type_code IN ARRAY v_eval_type_codes LOOP
                        v_err_row        := NULL;
                        v_prof_codes_str := NULL;

                        SELECT (e->>'rowNumber')::int,
                               NULLIF(trim(e->'evaluators'->>v_eval_type_code), '')
                        INTO   v_err_row, v_prof_codes_str
                        FROM   jsonb_array_elements(p_rows) AS e
                        WHERE  trim(e->>'projectCode') = r_proj.project_code
                          AND  NULLIF(trim(e->'evaluators'->>v_eval_type_code), '') IS NOT NULL
                        LIMIT 1;

                        CONTINUE WHEN v_prof_codes_str IS NULL;

                        v_prof_codes := ARRAY(
                            SELECT trim(pc)
                            FROM   unnest(string_to_array(v_prof_codes_str, ',')) AS pc
                            WHERE  trim(pc) <> ''
                        );

                        SELECT (t.extra->>'max_evaluators')::int
                        INTO   v_max_evaluators
                        FROM   core.types t
                        WHERE  t.code = v_eval_type_code;

                        IF v_max_evaluators IS NOT NULL AND array_length(v_prof_codes, 1) > v_max_evaluators THEN
                            v_has_errors := true;
                            RETURN QUERY SELECT v_err_row, 'multipleEvaluatorsNotAllowed'::text, NULL::integer;
                            CONTINUE;
                        END IF;

                        FOREACH v_prof_code IN ARRAY v_prof_codes LOOP
                            IF NOT EXISTS (
                                SELECT 1 FROM academic.professors p WHERE p.code = v_prof_code
                            ) THEN
                                v_has_errors := true;
                                RETURN QUERY SELECT v_err_row, 'professorNotFound'::text, NULL::integer;
                            END IF;
                        END LOOP;
                    END LOOP;
                END LOOP;

                IF v_has_errors THEN RETURN; END IF;

                INSERT INTO audit.upload_logs
                    (upload_type_id, status_type_id, academic_period_id, user_id, source_file,
                     total_rows, loaded_rows, error_rows, extra, is_active, created_at, updated_at)
                VALUES (
                    (SELECT id FROM core.types WHERE code = 'TG1101-T011'),
                    (SELECT id FROM core.types WHERE code = 'TG1102-T001'),
                    p_academic_period_id, p_user_id, p_source_file,
                    v_total, v_total, 0, '{}'::jsonb, true, NOW(), NOW()
                )
                RETURNING id INTO v_log_id;

                FOR r_proj IN
                    SELECT
                        trim(e->>'projectCode')                    AS project_code,
                        trim(e->>'courseCode')                     AS course_code,
                        MAX(NULLIF(trim(e->>'projectNameEs'), '')) AS project_name_es,
                        MAX(NULLIF(trim(e->>'projectNameEn'), '')) AS project_name_en,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T001'), '')) AS eval_t001,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T002'), '')) AS eval_t002,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T003'), '')) AS eval_t003,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T004'), '')) AS eval_t004,
                        MAX(NULLIF(trim(e->'evaluators'->>'TG403-T005'), '')) AS eval_t005
                    FROM jsonb_array_elements(p_rows) AS e
                    GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
                LOOP
                    SELECT c.id INTO v_course_id
                    FROM academic.courses c WHERE c.code = r_proj.course_code;

                    SELECT p.id INTO v_existing_id
                    FROM evaluation.projects p
                    JOIN evaluation.project_students ps  ON ps.project_id = p.id
                    JOIN academic.student_section_enrollments sse
                         ON sse.id = ps.student_section_enrollment_id
                    JOIN academic.course_sections cs     ON cs.id = sse.course_section_id
                    WHERE p.code = r_proj.project_code
                      AND cs.academic_period_id = p_academic_period_id
                    LIMIT 1;

                    IF v_existing_id IS NULL THEN
                        INSERT INTO evaluation.projects
                            (code, name, description, upload_log_id, extra, is_active, created_at, updated_at)
                        VALUES (
                            r_proj.project_code,
                            jsonb_build_object('es', r_proj.project_name_es, 'en', r_proj.project_name_en),
                            '{}'::jsonb, v_log_id, '{}'::jsonb, true, NOW(), NOW()
                        )
                        RETURNING id INTO v_project_id;

                        INSERT INTO evaluation.project_students
                            (project_id, student_section_enrollment_id, upload_log_id, extra, is_active, created_at, updated_at)
                        SELECT DISTINCT ON (st.code)
                            v_project_id, sse.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
                        FROM jsonb_array_elements(p_rows) AS e
                        JOIN academic.students st           ON st.code = trim(e->>'studentCode')
                        JOIN academic.enrolled_students enr ON enr.student_id = st.id
                        JOIN academic.student_section_enrollments sse ON sse.enrolled_student_id = enr.id
                        JOIN academic.course_sections cs    ON cs.id = sse.course_section_id
                        WHERE trim(e->>'projectCode') = r_proj.project_code
                          AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
                          AND cs.course_id = v_course_id
                          AND cs.academic_period_id = p_academic_period_id
                          AND sse.is_active = true
                        ORDER BY st.code, cs.section_code ASC;
                    ELSE
                        v_project_id := v_existing_id;
                    END IF;

                    FOREACH v_eval_type_code IN ARRAY v_eval_type_codes LOOP
                        DECLARE
                            v_eval_codes_str text;
                            v_eval_codes     text[];
                        BEGIN
                            CASE v_eval_type_code
                                WHEN 'TG403-T001' THEN v_eval_codes_str := r_proj.eval_t001;
                                WHEN 'TG403-T002' THEN v_eval_codes_str := r_proj.eval_t002;
                                WHEN 'TG403-T003' THEN v_eval_codes_str := r_proj.eval_t003;
                                WHEN 'TG403-T004' THEN v_eval_codes_str := r_proj.eval_t004;
                                WHEN 'TG403-T005' THEN v_eval_codes_str := r_proj.eval_t005;
                                ELSE v_eval_codes_str := NULL;
                            END CASE;

                            v_eval_codes := ARRAY(
                                SELECT trim(pc)
                                FROM   unnest(string_to_array(v_eval_codes_str, ',')) AS pc
                                WHERE  trim(pc) <> ''
                            );

                            SELECT t.id INTO v_eval_type_id
                            FROM core.types t WHERE t.code = v_eval_type_code;

                            UPDATE evaluation.project_evaluators pe
                            SET    is_active = false,
                                   deactivated_by_upload_log_id = v_log_id,
                                   updated_at = NOW()
                            WHERE  pe.project_id       = v_project_id
                              AND  pe.evaluator_type_id = v_eval_type_id
                              AND  pe.is_active         = true
                              AND  pe.professor_id NOT IN (
                                  SELECT p.id FROM academic.professors p
                                  WHERE p.code = ANY(v_eval_codes)
                              );

                            INSERT INTO evaluation.project_evaluators
                                (project_id, professor_id, evaluator_type_id, upload_log_id,
                                 is_active, created_at, updated_at)
                            SELECT
                                v_project_id, p.id, v_eval_type_id, v_log_id, true, NOW(), NOW()
                            FROM academic.professors p
                            WHERE p.code = ANY(v_eval_codes)
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM evaluation.project_evaluators pe2
                                  WHERE pe2.project_id       = v_project_id
                                    AND pe2.professor_id     = p.id
                                    AND pe2.evaluator_type_id = v_eval_type_id
                                    AND pe2.is_active         = true
                              );
                        END;
                    END LOOP;
                END LOOP;

                RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
            END;
            $fn$;
        `);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" DROP CONSTRAINT IF EXISTS "FK_project_groups_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" DROP COLUMN IF EXISTS "upload_log_id"`,
		);

		// ── drop evaluation.projects.project_group_id + evaluation.project_groups table ──
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" DROP CONSTRAINT IF EXISTS "FK_projects_project_group_id"`,
		);
		await queryRunner.query(`DROP INDEX IF EXISTS "evaluation"."IDX_projects_project_group_id"`);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" DROP COLUMN IF EXISTS "project_group_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" DROP CONSTRAINT IF EXISTS "FK_project_groups_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" DROP CONSTRAINT IF EXISTS "FK_project_groups_academic_period_id"`,
		);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "evaluation"."UQ_project_groups_code_period_program"`,
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "evaluation"."project_groups"`);

		// ── restore pre-feature fn_upload_grades_rc + fn_rollback_grades_rc ──
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
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rc(p_upload_log_id integer)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

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

		// ── remove seeded performance levels ──
		await queryRunner.query(`
			DELETE FROM academic.performance_levels
			WHERE code ~ '^(RC|RV)_L[1-3]_.+$'
			   OR code ~ '^PL_(STARTING|DEVELOPING|EXPECTED|EXCELLENT)_.+$';
		`);

		// ── revert TG205 / TG404 type fixes ──
		await queryRunner.query(
			`DELETE FROM core.types WHERE code IN ('TG404-T004', 'TG404-T005', 'TG404-T006')`,
		);
		await queryRunner.query(`
			UPDATE core.types SET
				description = '{"es": "No Asistio - El evaluador no asistio a la evaluacion", "en": "Did not attend - the evaluator did not attend the evaluation"}'::jsonb
			WHERE code = 'TG404-T003'
		`);
		await queryRunner.query(
			`DELETE FROM core.types WHERE code IN ('TG205-T007', 'TG205-T008', 'TG205-T009')`,
		);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "TF", "en": "TF"}'::jsonb,
				description = '{"es": "Trabajo Final", "en": "Final assignment"}'::jsonb
			WHERE code = 'TG205-T006'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "TP", "en": "TP"}'::jsonb,
				description = '{"es": "Trabajo Parcial", "en": "Midterm assignment"}'::jsonb
			WHERE code = 'TG205-T005'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "EB", "en": "EB"}'::jsonb,
				description = '{"es": "Evaluacion Final", "en": "Final evaluation"}'::jsonb
			WHERE code = 'TG205-T002'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "EA", "en": "EA"}'::jsonb,
				description = '{"es": "Evaluacion Parcial", "en": "Midterm evaluation"}'::jsonb
			WHERE code = 'TG205-T001'
		`);

		// ── drop audit.fn_rollback_grades_rv (feature version, RETURNS void) ──
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_grades_rv(integer)`);

		// ── restore pre-feature audit.fn_rollback_grades_rv (RETURNS text) ──
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

		// ── drop upload_log_id from evidence.evaluations + evaluation.rubric_scores ──
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" DROP CONSTRAINT IF EXISTS "FK_rubric_scores_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."rubric_scores" DROP COLUMN IF EXISTS "upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" DROP CONSTRAINT IF EXISTS "FK_evaluations_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evidence"."evaluations" DROP COLUMN IF EXISTS "upload_log_id"`,
		);

		// ── restore pre-feature audit.fn_upload_rubrics ──
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
		IF NOT EXISTS (SELECT 1 FROM academic.programs WHERE code = r_rub.program_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'programNotFound'::text, NULL::integer;
			CONTINUE;
		END IF;

		SELECT id INTO v_grade_type_id FROM core.types WHERE code = r_rub.grade_type_code;
		IF v_grade_type_id IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_rub.first_row, 'gradeTypeNotFound'::text, NULL::integer;
			CONTINUE;
		END IF;

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
				IF r_q.outcome_code IS NOT NULL THEN
					SELECT o.id INTO v_outcome_id
					FROM accreditation.outcomes o
					JOIN academic.course_outcome_mappings com ON com.outcome_id = o.id
					WHERE com.study_plan_course_id = v_spc_id
					  AND o.outcome_code = r_q.outcome_code
					LIMIT 1;
				END IF;

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

		// ── drop evaluation_id + rubric_id columns ──
		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			DROP CONSTRAINT IF EXISTS "FK_student_course_outcome_grades_evaluation_id"
		`);
		await queryRunner.query(`
			ALTER TABLE evidence.student_course_outcome_grades
			DROP COLUMN IF EXISTS evaluation_id
		`);
		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			DROP CONSTRAINT IF EXISTS "FK_evaluations_rubric_id"
		`);
		await queryRunner.query(`
			ALTER TABLE evidence.evaluations
			DROP COLUMN IF EXISTS rubric_id
		`);

		// ── drop competency scope column + TG402 types ──
		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			DROP CONSTRAINT IF EXISTS "FK_rubrics_competency_scope_type_id"
		`);
		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			DROP COLUMN IF EXISTS competency_scope_type_id
		`);
		await queryRunner.query(`
			DELETE FROM core.types
			WHERE code IN ('TG402-T001', 'TG402-T002')
		`);
		await queryRunner.query(`
			DELETE FROM core.type_groups
			WHERE code = 'TG402'
		`);

		// ── restore pre-feature audit.fn_upload_grades_rv ──
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
	}
}
