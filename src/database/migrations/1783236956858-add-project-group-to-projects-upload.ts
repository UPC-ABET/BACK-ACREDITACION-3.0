import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Adds the project group (empresa virtual) to the academic-projects bulk upload.
 *
 * Excel gains a "projectGroupCode" column between courseCode and studentCode. For every NEW
 * project the code is required; the function resolves the group by (code, academic_period_id,
 * program_id) — deriving the program (career) from the course's evaluable study plan in the period
 * — and auto-creates it (name = code) if missing, stamping upload_log_id so rollback can remove it.
 * Existing projects re-uploaded to update evaluators keep their current group (code is ignored).
 *
 * Changes to audit.fn_upload_projects (v4):
 * - Phase 2: new projects without a projectGroupCode fail with 'projectGroupCodeRequired'.
 * - Phase 3: new projects resolve-or-create the group and set projects.project_group_id.
 *
 * Changes to audit.fn_rollback_projects (v4): after deleting the upload's projects, deletes any
 * project group it auto-created that no longer has projects.
 *
 * Also adds evaluation.project_groups.upload_log_id (nullable FK to audit.upload_logs).
 */
export class AddProjectGroupToProjectsUpload1783236956858 implements MigrationInterface {
	name = 'AddProjectGroupToProjectsUpload1783236956858';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ── 1. Track which upload auto-created a group ──────────────────────
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" ADD COLUMN "upload_log_id" integer`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" ADD CONSTRAINT "FK_project_groups_upload_log_id" ` +
				`FOREIGN KEY ("upload_log_id") REFERENCES "audit"."upload_logs"("id") ` +
				`ON DELETE NO ACTION ON UPDATE NO ACTION`,
		);

		// ── 2. fn_upload_projects v4 (adds project group resolve/create) ────
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

		// ── 3. fn_rollback_projects v4 (also drops auto-created groups) ─────
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
		// ── Restore fn_rollback_projects v3 (no project-group cleanup) ──────
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

		// ── Restore fn_upload_projects v3 (no project group) ───────────────
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

		// ── Drop project_groups.upload_log_id ──────────────────────────────
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" DROP CONSTRAINT IF EXISTS "FK_project_groups_upload_log_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."project_groups" DROP COLUMN IF EXISTS "upload_log_id"`,
		);
	}
}
