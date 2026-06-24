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
	-- The academic period is validated in the service (request-level HTTP error), not here.

	-- intra-file duplicate (section, student)
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
			WHERE NULLIF(trim(d->>'sectionCode'), '') IS NOT NULL
			  AND NULLIF(trim(d->>'studentCode'), '') IS NOT NULL
			GROUP BY 1, 2
			HAVING count(*) > 1
		)
	LOOP
		v_has_errors := true;
		RETURN QUERY SELECT r.rn, 'duplicateRowInFile', NULL::integer;
	END LOOP;

	-- per-row validation
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

		-- the student must already be enrolled in the section, in the given academic period
		IF r.section_code IS NOT NULL AND r.student_code IS NOT NULL
		   AND EXISTS (SELECT 1 FROM academic.course_sections WHERE section_code = r.section_code)
		   AND EXISTS (SELECT 1 FROM academic.students WHERE code = r.student_code)
		   AND NOT EXISTS (
			SELECT 1
			FROM academic.student_section_enrollments sse
			JOIN academic.enrolled_students es ON es.id = sse.enrolled_student_id
			JOIN academic.students st ON st.id = es.student_id
			JOIN academic.course_sections cs ON cs.id = sse.course_section_id
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

	-- The upload is the source of truth for the sections it touches: every enrollment in an
	-- affected section becomes a representative iff the file lists it. Only rows whose flag
	-- actually changes are updated, and each records its prior value in extra->'upload_undo'
	-- so rollback can restore it. We deliberately do NOT touch upload_log_id: that column marks
	-- the enrollment upload that CREATED the row, and a flag change must not steal ownership.
	WITH file_rows AS (
		SELECT DISTINCT
			trim(e->>'sectionCode') AS section_code,
			trim(e->>'studentCode') AS student_code
		FROM jsonb_array_elements(p_rows) e
	),
	target_enrollments AS (
		SELECT sse.id
		FROM file_rows fr
		JOIN academic.course_sections cs ON cs.section_code = fr.section_code
		JOIN academic.students st ON st.code = fr.student_code
		JOIN academic.enrolled_students es ON es.student_id = st.id
		JOIN academic.student_section_enrollments sse
			ON sse.course_section_id = cs.id
		   AND sse.enrolled_student_id = es.id
	),
	affected AS (
		SELECT
			sse.id,
			sse.is_class_representative AS prev_value,
			(sse.id IN (SELECT id FROM target_enrollments)) AS new_value
		FROM academic.student_section_enrollments sse
		WHERE sse.course_section_id IN (
			SELECT DISTINCT cs.id
			FROM file_rows fr
			JOIN academic.course_sections cs ON cs.section_code = fr.section_code
		)
	)
	UPDATE academic.student_section_enrollments sse
	SET is_class_representative = a.new_value,
		extra = jsonb_set(
			COALESCE(sse.extra, '{}'::jsonb),
			'{upload_undo}',
			COALESCE(sse.extra->'upload_undo', '[]'::jsonb) ||
			jsonb_build_object(
				'log_id', v_log_id,
				'previous_is_class_representative', a.prev_value
			)
		),
		updated_at = NOW()
	FROM affected a
	WHERE sse.id = a.id
	  AND a.prev_value IS DISTINCT FROM a.new_value;

	RETURN QUERY SELECT NULL::integer, NULL::text, v_log_id;
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

	-- block out-of-order rollback: this upload must be the newest that touched each row it
	-- changed. Blocked when its id is in a row's upload_undo stack but is not the top element
	-- (a later upload changed the flag since). Roll back the newer upload first.
	IF EXISTS (
		SELECT 1 FROM academic.student_section_enrollments sse
		WHERE (sse.extra->'upload_undo') @> jsonb_build_array(jsonb_build_object('log_id', p_upload_log_id))
		  AND (sse.extra->'upload_undo' -> -1 ->> 'log_id')::int <> p_upload_log_id
	) THEN
		RAISE EXCEPTION 'rollbackBlockedNewerUpload';
	END IF;

	-- restore each affected row's prior flag value, then pop this upload's (top) undo entry
	UPDATE academic.student_section_enrollments sse
	SET is_class_representative =
			(sse.extra->'upload_undo' -> -1 ->> 'previous_is_class_representative')::boolean,
		extra = CASE
			WHEN jsonb_array_length(sse.extra->'upload_undo') <= 1 THEN sse.extra - 'upload_undo'
			ELSE jsonb_set(sse.extra, '{upload_undo}', (sse.extra->'upload_undo') - (-1))
		END,
		updated_at = NOW()
	WHERE (sse.extra->'upload_undo' -> -1 ->> 'log_id')::int = p_upload_log_id;

	UPDATE audit.upload_logs
	SET status_type_id = (
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

		// audit.upload_logs.upload_type_id FKs to core.types, so remove this type's logs before
		// the type row itself, otherwise the DELETE below fails while any upload exists.
		await queryRunner.query(`
			DELETE FROM audit.upload_logs
			WHERE upload_type_id = (SELECT id FROM core.types WHERE code = 'TG1101-T013')
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
