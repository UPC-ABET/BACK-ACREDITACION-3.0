import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Redesigns the RV bulk grade upload to create a full cascade of entities
 * (rubric → rubric_questions → rubric_question_criterias → project →
 *  project_student → project_evaluator → evaluation → rubric_scores →
 *  student_course_outcome_grades), replicating the legacy stored-procedure flow.
 *
 * Excel column layout (positional, header row ignored):
 * Excel column layout (positional, header row ignored):
 *   1:ESCUELA  2:CARRERA  3:COMISION  4:CURSO  5:ALUMNO  6:SECCION
 *   7:DOCENTE  8:TIPOEVALUACION  9-15:O1-O7
 *  16:CODIGOPROYECTO  17:PROYECTO(ES)  18:PROYECTO_EN  19:DESCPROYECTO(ES)  20:DESCPROYECTO_EN
 *
 * Rules:
 *  - All rubrics: CAPSTONE + MULTIPLE competency scope.
 *  - One rubric_question per outcome (question = outcome.outcome_description).
 *  - One rubric_question_criteria per question: min_value=0, max_value=2, criteria=same text.
 *  - Evaluator type: always COM.
 *  - qualification_status: always ASISTIO.
 *  - extra.max_outcome = 2 fixed on student_course_outcome_grades.
 *  - O1-O7 map to outcomes ordered by outcome_code ASC within the commission.
 *  - projectNameEn defaults to "-" when blank; projectDesc* are nullable.
 *  - projectCode globally unique vs DB; multiple rows sharing the same code join one project.
 *  - Same student appearing twice: last row overwrites (previous cascade deleted and reinserted).
 *  - ESCUELA→CARRERA validated via organization.charts.
 */
export class RedesignGradesRvUpload1783060000000 implements MigrationInterface {
	name = 'RedesignGradesRvUpload1783060000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
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
			NULLIF(trim(e->>'escuelaCode'), '')       AS escuela_code,
			NULLIF(trim(e->>'carreraCode'), '')       AS carrera_code,
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
		-- escuelaCode
		IF r.escuela_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'escuelaCodeEmpty'::text, NULL::integer;
		ELSE
			SELECT id INTO v_school_id
			FROM organization.schools WHERE code = r.escuela_code;

			IF v_school_id IS NULL THEN
				v_has_errors := true;
				RETURN QUERY SELECT r.row_number, 'escuelaNotFound'::text, NULL::integer;
			END IF;
		END IF;

		-- carreraCode
		IF r.carrera_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'carreraCodeEmpty'::text, NULL::integer;
		ELSIF NOT EXISTS (SELECT 1 FROM academic.programs p WHERE p.code = r.carrera_code) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'carreraNotFound'::text, NULL::integer;
		ELSIF r.escuela_code IS NOT NULL AND v_school_id IS NOT NULL
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
			WHERE prog.code = r.carrera_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'carreraNotInEscuela'::text, NULL::integer;
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

		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_grades_rv(integer)`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_grades_rv(p_upload_log_id integer)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
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
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_grades_rv(integer)`);

		// Restore the previous fn_upload_grades_rv (from migration 1782757728260)
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
		IF r.grade IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeEmpty'::text, NULL::integer;
		ELSIF r.grade !~ '^-?[0-9]+(\\.[0-9]+)?$' THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'gradeInvalid'::text, NULL::integer;
		END IF;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	INSERT INTO audit.upload_logs
		(upload_type_id, status_type_id, academic_period_id, user_id, source_file, total_rows, loaded_rows, error_rows,
		 extra, is_active, created_at, updated_at)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T007'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id, p_user_id, p_source_file, v_total, v_total, 0,
		'{}'::jsonb, true, NOW(), NOW())
	RETURNING id INTO v_log_id;

	INSERT INTO evidence.student_course_outcome_grades
		(student_section_enrollment_id, outcome_id, grade, upload_log_id,
		 extra, is_active, created_at, updated_at)
	SELECT sse.id, o.id, (e->>'grade')::numeric, v_log_id, '{"max_outcome": 2}'::jsonb, true, NOW(), NOW()
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
}
