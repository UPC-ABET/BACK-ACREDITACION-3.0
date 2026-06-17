import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Adds bulk-upload support for academic projects:
 *
 * 1. Adds upload_log_id to evaluation.projects, evaluation.project_students, and
 *    evaluation.project_evaluators so that the rollback function can delete exactly
 *    the records created by a given upload.
 *
 * 2. Inserts the TG1101-T011 type for "Academic projects" upload.
 *
 * 3. Creates audit.fn_upload_projects(jsonb, integer, integer, text):
 *    Receives rows parsed from the Excel file (one row per student or evaluator entry),
 *    groups them by project_code, runs three validation phases, then inserts projects,
 *    project_students, and project_evaluators inside a single function call.
 *
 * 4. Creates audit.fn_rollback_projects(integer):
 *    Deletes all data inserted by a given upload log id (blocks if evaluations exist).
 *
 * Excel row structure (every row must have projectCode + courseCode + at least one of
 * studentCode or professorCode; professorCode requires evaluatorTypeCode):
 *   projectCode | projectNameEs | projectNameEn | courseCode |
 *   studentCode | professorCode | evaluatorTypeCode
 */
export class AddProjectsUpload1781665812764 implements MigrationInterface {
	name = 'AddProjectsUpload1781665812764';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ── 1. Schema columns ───────────────────────────────────────────────
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" ADD COLUMN "upload_log_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" ADD CONSTRAINT "FK_projects_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" ADD COLUMN "upload_log_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" ADD CONSTRAINT "FK_project_students_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD COLUMN "upload_log_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD CONSTRAINT "FK_project_evaluators_upload_log_id" FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		// ── 2. Upload type seed ─────────────────────────────────────────────
		await queryRunner.query(`
			INSERT INTO core.types (type_group_id, extra, is_active, created_at, code, name)
			VALUES (
				(SELECT id FROM core.type_groups WHERE code = 'TG1101'),
				'{}'::jsonb, true, NOW(),
				'TG1101-T011',
				'{"es": "Proyectos académicos", "en": "Academic projects"}'::jsonb
			)
			ON CONFLICT (code) DO NOTHING
		`);

		// ── 3. fn_upload_projects ───────────────────────────────────────────
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_projects(
	p_rows              jsonb,
	p_academic_period_id integer,
	p_user_id           integer,
	p_source_file       text
)
RETURNS TABLE(row_number integer, error_code text, upload_log_id integer)
LANGUAGE plpgsql
AS $fn$
DECLARE
	v_total      integer := jsonb_array_length(p_rows);
	v_has_errors boolean := false;
	v_log_id     integer;
	v_project_id integer;
	v_course_id  integer;
	v_spc_id     integer;
	r            record;
	r_proj       record;
	r_stu        record;
	r_eval       record;
BEGIN
	-- ── Phase 1: per-row structural validation ────────────────────────────
	FOR r IN
		SELECT
			(e->>'rowNumber')::int                    AS row_number,
			NULLIF(trim(e->>'projectCode'), '')       AS project_code,
			NULLIF(trim(e->>'courseCode'), '')        AS course_code,
			NULLIF(trim(e->>'studentCode'), '')       AS student_code,
			NULLIF(trim(e->>'sectionCode'), '')       AS section_code,
			NULLIF(trim(e->>'professorCode'), '')     AS professor_code,
			NULLIF(trim(e->>'evaluatorTypeCode'), '') AS evaluator_type_code
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

		IF r.student_code IS NULL AND r.professor_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'rowMissingStudentAndEvaluator'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.student_code IS NOT NULL AND r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;

		IF r.professor_code IS NOT NULL AND r.evaluator_type_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'evaluatorTypeCodeEmpty'::text, NULL::integer;
			CONTINUE;
		END IF;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	-- ── Phase 2: each projectCode must have at least one row with name ────
	-- Note: the HAVING clause cannot reference the outer set-returning alias «e» in a
	-- subquery, so we wrap the aggregation as a subquery and filter in WHERE instead.
	FOR r IN
		SELECT sub.project_code, sub.first_row
		FROM (
			SELECT
				trim(e->>'projectCode')     AS project_code,
				MIN((e->>'rowNumber')::int) AS first_row
			FROM jsonb_array_elements(p_rows) AS e
			GROUP BY trim(e->>'projectCode')
		) sub
		WHERE NOT EXISTS (
			SELECT 1 FROM jsonb_array_elements(p_rows) AS d
			WHERE trim(d->>'projectCode') = sub.project_code
			  AND NULLIF(trim(d->>'projectNameEs'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'projectNameEn'), '') IS NOT NULL
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.first_row, 'projectNameEmpty'::text, NULL::integer;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	-- ── Phase 3: per-project cross-DB validation ──────────────────────────
	FOR r_proj IN
		SELECT
			trim(e->>'projectCode')     AS project_code,
			trim(e->>'courseCode')      AS course_code,
			MIN((e->>'rowNumber')::int) AS first_row
		FROM jsonb_array_elements(p_rows) AS e
		GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
	LOOP
		-- resolve course
		SELECT c.id INTO v_course_id
		FROM academic.courses c
		WHERE c.code = r_proj.course_code;

		IF v_course_id IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_proj.first_row, 'courseNotFound'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- course must have a study_plan_course with is_evaluable=true in this period
		SELECT spc.id INTO v_spc_id
		FROM academic.study_plan_courses spc
		JOIN academic.study_plan_academic_periods spap
		     ON spap.id = spc.study_plan_academic_period_id
		WHERE spap.academic_period_id = p_academic_period_id
		  AND spc.course_id = v_course_id
		  AND (spc.extra->>'is_evaluable')::boolean = true
		LIMIT 1;

		IF v_spc_id IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_proj.first_row, 'courseNotEvaluable'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- project code must not exist in period yet
		IF EXISTS (
			SELECT 1
			FROM evaluation.projects p
			JOIN evaluation.project_students ps   ON ps.project_id = p.id
			JOIN academic.student_section_enrollments sse
			     ON sse.id = ps.student_section_enrollment_id
			JOIN academic.course_sections cs ON cs.id = sse.course_section_id
			WHERE p.code = r_proj.project_code
			  AND cs.academic_period_id = p_academic_period_id
			LIMIT 1
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r_proj.first_row, 'projectCodeDuplicateInPeriod'::text, NULL::integer;
			CONTINUE;
		END IF;

		-- validate each student row for this project
		FOR r_stu IN
			SELECT
				(e->>'rowNumber')::int              AS row_number,
				NULLIF(trim(e->>'studentCode'), '') AS student_code,
				NULLIF(trim(e->>'sectionCode'), '') AS section_code
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
				FROM academic.students st
				JOIN academic.enrolled_students es   ON es.student_id = st.id
				JOIN academic.student_section_enrollments sse
				     ON sse.enrolled_student_id = es.id
				JOIN academic.course_sections cs ON cs.id = sse.course_section_id
				WHERE st.code = r_stu.student_code
				  AND cs.section_code = r_stu.section_code
				  AND cs.course_id = v_course_id
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

		-- validate each evaluator row for this project
		FOR r_eval IN
			SELECT
				(e->>'rowNumber')::int                      AS row_number,
				NULLIF(trim(e->>'professorCode'), '')       AS professor_code,
				NULLIF(trim(e->>'evaluatorTypeCode'), '')   AS evaluator_type_code
			FROM jsonb_array_elements(p_rows) AS e
			WHERE trim(e->>'projectCode') = r_proj.project_code
			  AND NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
		LOOP
			IF NOT EXISTS (
				SELECT 1 FROM academic.professors p WHERE p.code = r_eval.professor_code
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_eval.row_number, 'professorNotFound'::text, NULL::integer;
				CONTINUE;
			END IF;

			IF NOT EXISTS (
				SELECT 1 FROM core.types t
				JOIN core.type_groups g ON g.id = t.type_group_id
				WHERE g.code = 'TG403' AND t.code = r_eval.evaluator_type_code
			) THEN
				v_has_errors := true;
				RETURN QUERY SELECT r_eval.row_number, 'evaluatorTypeNotFound'::text, NULL::integer;
				CONTINUE;
			END IF;
		END LOOP;

		-- duplicate evaluator types within the same project
		FOR r IN
			SELECT
				trim(e->>'evaluatorTypeCode') AS eval_type_code,
				MIN((e->>'rowNumber')::int)   AS first_row
			FROM jsonb_array_elements(p_rows) AS e
			WHERE trim(e->>'projectCode') = r_proj.project_code
			  AND NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
			  AND NULLIF(trim(e->>'evaluatorTypeCode'), '') IS NOT NULL
			GROUP BY trim(e->>'evaluatorTypeCode')
			HAVING count(*) > 1
		LOOP
			v_has_errors := true;
			RETURN QUERY SELECT r.first_row, 'duplicateEvaluatorType'::text, NULL::integer;
		END LOOP;
	END LOOP;

	IF v_has_errors THEN RETURN; END IF;

	-- ── Phase 4: Insert ───────────────────────────────────────────────────
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
			MAX(NULLIF(trim(e->>'projectNameEn'), '')) AS project_name_en
		FROM jsonb_array_elements(p_rows) AS e
		GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
	LOOP
		SELECT c.id INTO v_course_id
		FROM academic.courses c
		WHERE c.code = r_proj.course_code;

		INSERT INTO evaluation.projects
			(code, name, description, upload_log_id, extra, is_active, created_at, updated_at)
		VALUES (
			r_proj.project_code,
			jsonb_build_object('es', r_proj.project_name_es, 'en', r_proj.project_name_en),
			'{}'::jsonb,
			v_log_id,
			'{}'::jsonb, true, NOW(), NOW()
		)
		RETURNING id INTO v_project_id;

		-- distinct students (in case same studentCode appears on multiple rows for this project)
		INSERT INTO evaluation.project_students
			(project_id, student_section_enrollment_id, upload_log_id, extra, is_active, created_at, updated_at)
		SELECT DISTINCT ON (sse.id)
			v_project_id, sse.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
		FROM jsonb_array_elements(p_rows) AS e
		JOIN academic.students st ON st.code = trim(e->>'studentCode')
		JOIN academic.enrolled_students enr ON enr.student_id = st.id
		JOIN academic.student_section_enrollments sse ON sse.enrolled_student_id = enr.id
		JOIN academic.course_sections cs ON cs.id = sse.course_section_id
		WHERE trim(e->>'projectCode') = r_proj.project_code
		  AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
		  AND cs.section_code = trim(e->>'sectionCode')
		  AND cs.course_id = v_course_id
		  AND cs.academic_period_id = p_academic_period_id
		  AND sse.is_active = true;

		-- distinct evaluators (same evaluatorTypeCode deduped by the DISTINCT ON)
		INSERT INTO evaluation.project_evaluators
			(project_id, professor_id, evaluator_type_id, upload_log_id, extra, is_active, created_at, updated_at)
		SELECT DISTINCT ON (t.id)
			v_project_id, prof.id, t.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
		FROM jsonb_array_elements(p_rows) AS e
		JOIN academic.professors prof ON prof.code = trim(e->>'professorCode')
		JOIN core.types t             ON t.code    = trim(e->>'evaluatorTypeCode')
		WHERE trim(e->>'projectCode') = r_proj.project_code
		  AND NULLIF(trim(e->>'professorCode'), '')     IS NOT NULL
		  AND NULLIF(trim(e->>'evaluatorTypeCode'), '') IS NOT NULL;
	END LOOP;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		// ── 4. fn_rollback_projects ─────────────────────────────────────────
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_projects(p_upload_log_id integer)
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- block if any project from this upload already has rubric evaluations
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

	DELETE FROM evaluation.project_evaluators
	WHERE project_id IN (
		SELECT id FROM evaluation.projects WHERE upload_log_id = p_upload_log_id
	);

	DELETE FROM evaluation.project_students
	WHERE project_id IN (
		SELECT id FROM evaluation.projects WHERE upload_log_id = p_upload_log_id
	);

	DELETE FROM evaluation.projects WHERE upload_log_id = p_upload_log_id;

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
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_rollback_projects(integer)`);
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_upload_projects(jsonb, integer, integer, text)`,
		);
		await queryRunner.query(`DELETE FROM core.types WHERE code = 'TG1101-T011'`);

		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" DROP CONSTRAINT IF EXISTS "FK_project_evaluators_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" DROP COLUMN IF EXISTS "upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" DROP CONSTRAINT IF EXISTS "FK_project_students_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_students" DROP COLUMN IF EXISTS "upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" DROP CONSTRAINT IF EXISTS "FK_projects_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."projects" DROP COLUMN IF EXISTS "upload_log_id"`,
		);
	}
}
