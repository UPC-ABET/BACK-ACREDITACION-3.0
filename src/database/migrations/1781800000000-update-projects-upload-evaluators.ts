import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Replaces the row-per-evaluator upload format with a column-per-evaluator-type format.
 *
 * Changes:
 * 1. Adds deactivated_by_upload_log_id to evaluation.project_evaluators so rollbacks
 *    can restore evaluators that were deactivated by an upload.
 *
 * 2. Replaces audit.fn_upload_projects with a new version that:
 *    - Accepts evaluator data as a nested object keyed by type code (e.g. 'TG403-T001'),
 *      where each value is a comma-separated list of professor codes (for committee support).
 *    - Every row must have a studentCode — evaluators are project-level columns, not rows.
 *    - Re-upload: if projectCode already exists in the period, only evaluators are updated.
 *      Evaluators not present in the new upload are deactivated; new ones are inserted.
 *      Evaluators already present with the same role stay unchanged.
 *    - New projects: full validation (name, students, evaluators) and insert as before.
 *
 * 3. Replaces audit.fn_rollback_projects with a version that:
 *    - For existing projects updated by the upload: restores deactivated evaluators
 *      and removes newly added evaluators.
 *    - For newly created projects: deletes everything as before.
 */
export class UpdateProjectsUploadEvaluators1781800000000 implements MigrationInterface {
	name = 'UpdateProjectsUploadEvaluators1781800000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ── 1. New column on project_evaluators ─────────────────────────────
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD COLUMN "deactivated_by_upload_log_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" ADD CONSTRAINT "FK_project_evaluators_deactivated_by_upload_log_id" FOREIGN KEY ("deactivated_by_upload_log_id") REFERENCES "audit"."upload_logs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		// ── 2. fn_upload_projects v2 ────────────────────────────────────────
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
    v_spc_id           integer;
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
BEGIN
    -- ── Phase 1: per-row structural validation ─────────────────────────────
    FOR r IN
        SELECT
            (e->>'rowNumber')::int               AS row_number,
            NULLIF(trim(e->>'projectCode'),  '')  AS project_code,
            NULLIF(trim(e->>'courseCode'),   '')  AS course_code,
            NULLIF(trim(e->>'studentCode'),  '')  AS student_code,
            NULLIF(trim(e->>'sectionCode'),  '')  AS section_code
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
        -- studentCode is optional (allows evaluator-only re-uploads)
        -- but sectionCode is required whenever studentCode is provided
        IF r.student_code IS NOT NULL AND r.section_code IS NULL THEN
            v_has_errors := true;
            RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty'::text, NULL::integer;
            CONTINUE;
        END IF;
    END LOOP;

    IF v_has_errors THEN RETURN; END IF;

    -- ── Phase 2: per-project cross-DB validation ───────────────────────────
    FOR r_proj IN
        SELECT
            trim(e->>'projectCode')     AS project_code,
            trim(e->>'courseCode')      AS course_code,
            MIN((e->>'rowNumber')::int) AS first_row,
            bool_or(
                NULLIF(trim(e->>'projectNameEs'), '') IS NOT NULL
                AND NULLIF(trim(e->>'projectNameEn'), '') IS NOT NULL
            )                           AS has_name
        FROM jsonb_array_elements(p_rows) AS e
        GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
    LOOP
        -- resolve course
        SELECT c.id INTO v_course_id
        FROM academic.courses c WHERE c.code = r_proj.course_code;

        IF v_course_id IS NULL THEN
            v_has_errors := true;
            RETURN QUERY SELECT r_proj.first_row, 'courseNotFound'::text, NULL::integer;
            CONTINUE;
        END IF;

        -- course must be evaluable in this period
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

        -- check if project already exists in this academic period
        SELECT p.id INTO v_existing_id
        FROM evaluation.projects p
        JOIN evaluation.project_students ps  ON ps.project_id = p.id
        JOIN academic.student_section_enrollments sse
             ON sse.id = ps.student_section_enrollment_id
        JOIN academic.course_sections cs     ON cs.id = sse.course_section_id
        WHERE p.code = r_proj.project_code
          AND cs.academic_period_id = p_academic_period_id
        LIMIT 1;

        -- new projects require name, at least one student row, and full student validation
        IF v_existing_id IS NULL THEN
            IF NOT r_proj.has_name THEN
                v_has_errors := true;
                RETURN QUERY SELECT r_proj.first_row, 'projectNameEmpty'::text, NULL::integer;
                CONTINUE;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(p_rows) AS e
                WHERE trim(e->>'projectCode') = r_proj.project_code
                  AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
            ) THEN
                v_has_errors := true;
                RETURN QUERY SELECT r_proj.first_row, 'newProjectRequiresStudent'::text, NULL::integer;
                CONTINUE;
            END IF;

            FOR r_stu IN
                SELECT
                    (e->>'rowNumber')::int              AS row_number,
                    NULLIF(trim(e->>'studentCode'), '') AS student_code,
                    NULLIF(trim(e->>'sectionCode'), '') AS section_code
                FROM jsonb_array_elements(p_rows) AS e
                WHERE trim(e->>'projectCode') = r_proj.project_code
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
                    JOIN academic.enrolled_students es
                         ON es.student_id = st.id
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
        END IF;

        -- validate professor codes in all evaluator type columns (new and existing projects)
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

            -- only Comité (TG403-T001) allows multiple professors per type
            IF v_eval_type_code <> 'TG403-T001' AND array_length(v_prof_codes, 1) > 1 THEN
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

        -- re-check existence (same logic as Phase 2)
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
            -- ── New project: insert project + students ──────────────────────
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
            SELECT DISTINCT ON (sse.id)
                v_project_id, sse.id, v_log_id, '{}'::jsonb, true, NOW(), NOW()
            FROM jsonb_array_elements(p_rows) AS e
            JOIN academic.students st       ON st.code = trim(e->>'studentCode')
            JOIN academic.enrolled_students enr ON enr.student_id = st.id
            JOIN academic.student_section_enrollments sse ON sse.enrolled_student_id = enr.id
            JOIN academic.course_sections cs ON cs.id = sse.course_section_id
            WHERE trim(e->>'projectCode') = r_proj.project_code
              AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
              AND cs.section_code = trim(e->>'sectionCode')
              AND cs.course_id = v_course_id
              AND cs.academic_period_id = p_academic_period_id
              AND sse.is_active = true;
        ELSE
            v_project_id := v_existing_id;
        END IF;

        -- ── Insert/update evaluators (both new and existing projects) ───────
        FOREACH v_eval_type_code IN ARRAY v_eval_type_codes LOOP
            v_prof_codes_str := CASE v_eval_type_code
                WHEN 'TG403-T001' THEN r_proj.eval_t001
                WHEN 'TG403-T002' THEN r_proj.eval_t002
                WHEN 'TG403-T003' THEN r_proj.eval_t003
                WHEN 'TG403-T004' THEN r_proj.eval_t004
                WHEN 'TG403-T005' THEN r_proj.eval_t005
            END;

            SELECT t.id INTO v_eval_type_id
            FROM core.types t WHERE t.code = v_eval_type_code;

            IF v_prof_codes_str IS NULL THEN
                -- column empty: deactivate all active evaluators of this type
                UPDATE evaluation.project_evaluators
                SET    is_active = false,
                       deactivated_by_upload_log_id = v_log_id,
                       updated_at = NOW()
                WHERE  project_id = v_project_id
                  AND  evaluator_type_id = v_eval_type_id
                  AND  is_active = true;
            ELSE
                v_prof_codes := ARRAY(
                    SELECT trim(pc)
                    FROM   unnest(string_to_array(v_prof_codes_str, ',')) AS pc
                    WHERE  trim(pc) <> ''
                );

                -- deactivate active evaluators of this type NOT in the new list
                UPDATE evaluation.project_evaluators pe
                SET    is_active = false,
                       deactivated_by_upload_log_id = v_log_id,
                       updated_at = NOW()
                FROM   academic.professors pr
                WHERE  pr.id = pe.professor_id
                  AND  pe.project_id = v_project_id
                  AND  pe.evaluator_type_id = v_eval_type_id
                  AND  pe.is_active = true
                  AND  pr.code <> ALL(v_prof_codes);

                -- insert professor codes that are not already active for this role
                FOREACH v_prof_code IN ARRAY v_prof_codes LOOP
                    IF NOT EXISTS (
                        SELECT 1
                        FROM   evaluation.project_evaluators pe
                        JOIN   academic.professors pr ON pr.id = pe.professor_id
                        WHERE  pe.project_id = v_project_id
                          AND  pr.code = v_prof_code
                          AND  pe.evaluator_type_id = v_eval_type_id
                          AND  pe.is_active = true
                    ) THEN
                        INSERT INTO evaluation.project_evaluators
                            (project_id, professor_id, evaluator_type_id, upload_log_id,
                             extra, is_active, created_at, updated_at)
                        SELECT v_project_id, pr.id, v_eval_type_id, v_log_id,
                               '{}'::jsonb, true, NOW(), NOW()
                        FROM   academic.professors pr
                        WHERE  pr.code = v_prof_code;
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
`);

		// ── 3. fn_rollback_projects v2 ──────────────────────────────────────
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
		// Restore original fn_rollback_projects (no reactivation logic)
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

		// Restore original fn_upload_projects (row-per-evaluator format)
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

    FOR r_proj IN
        SELECT
            trim(e->>'projectCode')     AS project_code,
            trim(e->>'courseCode')      AS course_code,
            MIN((e->>'rowNumber')::int) AS first_row
        FROM jsonb_array_elements(p_rows) AS e
        GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
    LOOP
        SELECT c.id INTO v_course_id FROM academic.courses c WHERE c.code = r_proj.course_code;
        IF v_course_id IS NULL THEN
            v_has_errors := true;
            RETURN QUERY SELECT r_proj.first_row, 'courseNotFound'::text, NULL::integer;
            CONTINUE;
        END IF;

        SELECT spc.id INTO v_spc_id
        FROM academic.study_plan_courses spc
        JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
        WHERE spap.academic_period_id = p_academic_period_id
          AND spc.course_id = v_course_id
          AND (spc.extra->>'is_evaluable')::boolean = true
        LIMIT 1;

        IF v_spc_id IS NULL THEN
            v_has_errors := true;
            RETURN QUERY SELECT r_proj.first_row, 'courseNotEvaluable'::text, NULL::integer;
            CONTINUE;
        END IF;

        IF EXISTS (
            SELECT 1 FROM evaluation.projects p
            JOIN evaluation.project_students ps ON ps.project_id = p.id
            JOIN academic.student_section_enrollments sse ON sse.id = ps.student_section_enrollment_id
            JOIN academic.course_sections cs ON cs.id = sse.course_section_id
            WHERE p.code = r_proj.project_code AND cs.academic_period_id = p_academic_period_id
            LIMIT 1
        ) THEN
            v_has_errors := true;
            RETURN QUERY SELECT r_proj.first_row, 'projectCodeDuplicateInPeriod'::text, NULL::integer;
            CONTINUE;
        END IF;

        FOR r_stu IN
            SELECT (e->>'rowNumber')::int AS row_number,
                   NULLIF(trim(e->>'studentCode'), '') AS student_code,
                   NULLIF(trim(e->>'sectionCode'), '') AS section_code
            FROM jsonb_array_elements(p_rows) AS e
            WHERE trim(e->>'projectCode') = r_proj.project_code
              AND NULLIF(trim(e->>'studentCode'), '') IS NOT NULL
        LOOP
            IF NOT EXISTS (SELECT 1 FROM academic.students s WHERE s.code = r_stu.student_code) THEN
                v_has_errors := true;
                RETURN QUERY SELECT r_stu.row_number, 'studentNotFound'::text, NULL::integer;
                CONTINUE;
            END IF;
            IF NOT EXISTS (
                SELECT 1
                FROM academic.students st
                JOIN academic.enrolled_students es ON es.student_id = st.id
                JOIN academic.student_section_enrollments sse ON sse.enrolled_student_id = es.id
                JOIN academic.course_sections cs ON cs.id = sse.course_section_id
                WHERE st.code = r_stu.student_code AND cs.section_code = r_stu.section_code
                  AND cs.course_id = v_course_id AND cs.academic_period_id = p_academic_period_id
                  AND sse.is_active = true
            ) THEN
                v_has_errors := true;
                RETURN QUERY SELECT r_stu.row_number, 'studentNotInCourse'::text, NULL::integer;
                CONTINUE;
            END IF;
            IF EXISTS (
                SELECT 1
                FROM evaluation.project_students ps2
                JOIN evaluation.projects p2 ON p2.id = ps2.project_id
                JOIN academic.student_section_enrollments sse2 ON sse2.id = ps2.student_section_enrollment_id
                JOIN academic.course_sections cs2 ON cs2.id = sse2.course_section_id
                JOIN academic.enrolled_students es2 ON es2.id = sse2.enrolled_student_id
                WHERE es2.student_id = (SELECT s.id FROM academic.students s WHERE s.code = r_stu.student_code)
                  AND cs2.academic_period_id = p_academic_period_id AND p2.is_active = true
            ) THEN
                v_has_errors := true;
                RETURN QUERY SELECT r_stu.row_number, 'studentAlreadyInProject'::text, NULL::integer;
                CONTINUE;
            END IF;
        END LOOP;

        FOR r_eval IN
            SELECT (e->>'rowNumber')::int AS row_number,
                   NULLIF(trim(e->>'professorCode'), '') AS professor_code,
                   NULLIF(trim(e->>'evaluatorTypeCode'), '') AS evaluator_type_code
            FROM jsonb_array_elements(p_rows) AS e
            WHERE trim(e->>'projectCode') = r_proj.project_code
              AND NULLIF(trim(e->>'professorCode'), '') IS NOT NULL
        LOOP
            IF NOT EXISTS (SELECT 1 FROM academic.professors p WHERE p.code = r_eval.professor_code) THEN
                v_has_errors := true;
                RETURN QUERY SELECT r_eval.row_number, 'professorNotFound'::text, NULL::integer;
                CONTINUE;
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM core.types t JOIN core.type_groups g ON g.id = t.type_group_id
                WHERE g.code = 'TG403' AND t.code = r_eval.evaluator_type_code
            ) THEN
                v_has_errors := true;
                RETURN QUERY SELECT r_eval.row_number, 'evaluatorTypeNotFound'::text, NULL::integer;
                CONTINUE;
            END IF;
        END LOOP;

        FOR r IN
            SELECT trim(e->>'evaluatorTypeCode') AS eval_type_code, MIN((e->>'rowNumber')::int) AS first_row
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

    INSERT INTO audit.upload_logs
        (upload_type_id, status_type_id, academic_period_id, user_id, source_file,
         total_rows, loaded_rows, error_rows, extra, is_active, created_at, updated_at)
    VALUES (
        (SELECT id FROM core.types WHERE code = 'TG1101-T011'),
        (SELECT id FROM core.types WHERE code = 'TG1102-T001'),
        p_academic_period_id, p_user_id, p_source_file,
        v_total, v_total, 0, '{}', true, NOW(), NOW()
    )
    RETURNING id INTO v_log_id;

    FOR r_proj IN
        SELECT
            trim(e->>'projectCode') AS project_code,
            trim(e->>'courseCode')  AS course_code,
            MAX(NULLIF(trim(e->>'projectNameEs'), '')) AS project_name_es,
            MAX(NULLIF(trim(e->>'projectNameEn'), '')) AS project_name_en
        FROM jsonb_array_elements(p_rows) AS e
        GROUP BY trim(e->>'projectCode'), trim(e->>'courseCode')
    LOOP
        SELECT c.id INTO v_course_id FROM academic.courses c WHERE c.code = r_proj.course_code;

        INSERT INTO evaluation.projects
            (code, name, description, upload_log_id, extra, is_active, created_at, updated_at)
        VALUES (
            r_proj.project_code,
            jsonb_build_object('es', r_proj.project_name_es, 'en', r_proj.project_name_en),
            '{}', v_log_id, '{}', true, NOW(), NOW()
        )
        RETURNING id INTO v_project_id;

        INSERT INTO evaluation.project_students
            (project_id, student_section_enrollment_id, upload_log_id, extra, is_active, created_at, updated_at)
        SELECT DISTINCT ON (sse.id)
            v_project_id, sse.id, v_log_id, '{}', true, NOW(), NOW()
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

        INSERT INTO evaluation.project_evaluators
            (project_id, professor_id, evaluator_type_id, upload_log_id, extra, is_active, created_at, updated_at)
        SELECT DISTINCT ON (t.id)
            v_project_id, prof.id, t.id, v_log_id, '{}', true, NOW(), NOW()
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

		// Drop the new column
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" DROP CONSTRAINT IF EXISTS "FK_project_evaluators_deactivated_by_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_evaluators" DROP COLUMN IF EXISTS "deactivated_by_upload_log_id"`,
		);
	}
}
