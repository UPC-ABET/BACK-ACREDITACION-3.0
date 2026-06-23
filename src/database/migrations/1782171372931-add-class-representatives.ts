import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassRepresentatives1782171372931 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE academic.student_section_enrollments
			ADD COLUMN is_class_representative boolean NOT NULL DEFAULT false
		`);

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
				'TG1101',
				'{"en":"Upload Types","es":"Tipos de Carga"}'::jsonb,
				'{}'::jsonb,
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
				'TG1101-T013',
				'{"en":"Class Representatives","es":"Delegados"}'::jsonb,
				'{}'::jsonb,
				'{}'::jsonb,
				true,
				NOW(),
				NULL
			FROM core.type_groups tg
			WHERE tg.code = 'TG1101'
			  AND NOT EXISTS (
				SELECT 1
				FROM core.types t
				WHERE t.code = 'TG1101-T013'
			  )
		`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_upload_class_representatives(
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
		FROM jsonb_array_elements(p_rows) e
		WHERE (
			lower(trim(e->>'sectionCode')),
			lower(trim(e->>'studentCode'))
		) IN (
			SELECT
				lower(trim(d->>'sectionCode')),
				lower(trim(d->>'studentCode'))
			FROM jsonb_array_elements(p_rows) d
			GROUP BY 1,2
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile', NULL::integer;
	END LOOP;

	FOR r IN
		SELECT
			(e->>'rowNumber')::int AS row_number,
			NULLIF(trim(e->>'sectionCode'), '') AS section_code,
			NULLIF(trim(e->>'studentCode'), '') AS student_code
		FROM jsonb_array_elements(p_rows) e
	LOOP

		IF r.section_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionCodeEmpty', NULL::integer;

		ELSIF NOT EXISTS (
			SELECT 1 FROM academic.course_sections
			WHERE section_code = r.section_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'sectionNotFound', NULL::integer;
		END IF;

		IF r.student_code IS NULL THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentCodeEmpty', NULL::integer;

		ELSIF NOT EXISTS (
			SELECT 1 FROM academic.students
			WHERE code = r.student_code
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentNotFound', NULL::integer;
		END IF;

		IF NOT EXISTS (
			SELECT 1
			FROM academic.student_section_enrollments sse
			JOIN academic.enrolled_students es
				ON es.id = sse.enrolled_student_id
			JOIN academic.students st
				ON st.id = es.student_id
			JOIN academic.course_sections cs
				ON cs.id = sse.course_section_id
			WHERE cs.section_code = r.section_code
			  AND st.code = r.student_code
			  AND cs.academic_period_id = p_academic_period_id
		) THEN
			v_has_errors := true;
			RETURN QUERY SELECT r.row_number, 'studentNotEnrolledInSection', NULL::integer;
		END IF;

	END LOOP;

	IF v_has_errors THEN
		RETURN;
	END IF;

	INSERT INTO audit.upload_logs (
		upload_type_id,
		status_type_id,
		academic_period_id,
		user_id,
		source_file,
		total_rows,
		loaded_rows,
		error_rows,
		extra,
		is_active,
		created_at,
		updated_at
	)
	VALUES (
		(SELECT id FROM core.types WHERE code = 'TG1101-T013'),
		(SELECT id FROM core.types WHERE code = 'TG1102-T001'),
		p_academic_period_id,
		p_user_id,
		p_source_file,
		v_total,
		v_total,
		0,
		'{}'::jsonb,
		true,
		NOW(),
		NOW()
	)
	RETURNING id INTO v_log_id;

	UPDATE academic.student_section_enrollments sse
	SET
		is_class_representative = false,
		updated_at = NOW()
	FROM (
		SELECT DISTINCT cs.id
		FROM jsonb_array_elements(p_rows) e
		JOIN academic.course_sections cs
			ON cs.section_code = trim(e->>'sectionCode')
	) sections
	WHERE sse.course_section_id = sections.id;

	UPDATE academic.student_section_enrollments sse
	SET
		is_class_representative = true,
		upload_log_id = v_log_id,
		updated_at = NOW()
	FROM (
		SELECT
			trim(e->>'sectionCode') AS section_code,
			trim(e->>'studentCode') AS student_code
		FROM jsonb_array_elements(p_rows) e
	) data
	JOIN academic.course_sections cs
		ON cs.section_code = data.section_code
	JOIN academic.enrolled_students es
		ON TRUE
	JOIN academic.students st
		ON st.id = es.student_id
		AND st.code = data.student_code
	WHERE sse.course_section_id = cs.id
	  AND sse.enrolled_student_id = es.id;

	RETURN QUERY
	SELECT NULL::integer, NULL::text, v_log_id;
END;
$fn$;
		`);

		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_rollback_class_representatives(
	p_upload_log_id integer
)
RETURNS text
LANGUAGE plpgsql
AS $fn$
BEGIN

	IF NOT EXISTS (
		SELECT 1 FROM audit.upload_logs WHERE id = p_upload_log_id
	) THEN
		RAISE EXCEPTION 'uploadLogNotFound';
	END IF;

	-- revert all affected enrollments
	UPDATE academic.student_section_enrollments
	SET
		is_class_representative = false,
		upload_log_id = NULL,
		updated_at = NOW()
	WHERE upload_log_id = p_upload_log_id;

	-- mark rollback
	UPDATE audit.upload_logs
	SET
		status_type_id = (
			SELECT id FROM core.types WHERE code = 'TG1102-T002'
		),
		rollback_at = NOW(),
		updated_at = NOW()
	WHERE id = p_upload_log_id;

	RETURN 'ok';

END;
$fn$;
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			DROP FUNCTION IF EXISTS audit.fn_rollback_class_representatives(integer)
		`);

		await queryRunner.query(`
			DROP FUNCTION IF EXISTS audit.fn_upload_class_representatives(
				jsonb,
				integer,
				integer,
				text
			)
		`);

		await queryRunner.query(`
        DELETE FROM core.types
        WHERE code = 'TG1101-T013'
		`);

		await queryRunner.query(`
			ALTER TABLE academic.student_section_enrollments
			DROP COLUMN is_class_representative
		`);
	}
}
