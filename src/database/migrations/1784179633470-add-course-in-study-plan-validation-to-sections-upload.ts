import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a validation to the sections upload (audit.fn_upload_sections): a section's course must
 * belong to a study plan offered in the upload's academic period (academic.study_plan_courses →
 * study_plan_academic_periods for p_academic_period_id). Previously the row only required the course
 * to exist in academic.courses, so sections for courses that aren't part of any study plan for the
 * period could be loaded. Rows that fail now return the 'courseNotInStudyPlan' error code (checked
 * only when the course exists, i.e. after 'courseNotFound'). Everything else is unchanged.
 *
 * down() restores the prior body (course existence only, no study-plan check).
 */
export class AddCourseInStudyPlanValidationToSectionsUpload1784179633470 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
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
		ELSIF NOT EXISTS (
			-- the course must belong to a study plan offered in this academic period
			SELECT 1
			FROM academic.study_plan_courses spc
			JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			JOIN academic.courses c ON c.id = spc.course_id
			WHERE spap.academic_period_id = p_academic_period_id
			  AND c.code = r.course_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'courseNotInStudyPlan'::text, NULL::integer;
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

	-- update sections whose code already existed (push prior values onto the extra.upload_undo stack)
	UPDATE academic.course_sections cs
	SET course_id = c.id,
		academic_period_id = p_academic_period_id,
		campus_id = cam.id,
		professor_id = pr.id,
		section_modality_type_id = t.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(cs.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(cs.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'course_id', cs.course_id,
				'academic_period_id', cs.academic_period_id,
				'campus_id', cs.campus_id, 'professor_id', cs.professor_id,
				'section_modality_type_id', cs.section_modality_type_id))
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
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restore the prior body: course existence only, no study-plan membership check.
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

	UPDATE academic.course_sections cs
	SET course_id = c.id,
		academic_period_id = p_academic_period_id,
		campus_id = cam.id,
		professor_id = pr.id,
		section_modality_type_id = t.id,
		updated_at = NOW(),
		extra = jsonb_set(COALESCE(cs.extra, '{}'::jsonb), '{upload_undo}',
			COALESCE(cs.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object('log_id', v_log_id, 'course_id', cs.course_id,
				'academic_period_id', cs.academic_period_id,
				'campus_id', cs.campus_id, 'professor_id', cs.professor_id,
				'section_modality_type_id', cs.section_modality_type_id))
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
	}
}
