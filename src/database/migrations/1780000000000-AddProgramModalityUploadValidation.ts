import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Shared per-row validator for bulk uploads that reference a program (study plans,
 * outcomes, enrolled students): a program may only be loaded under an academic period
 * of the SAME modality (TG102). The upload's academic period carries the modality
 * (academic_periods.modality_type_id), so a row whose program modality differs from the
 * period modality is rejected with 'programModalityMismatch'.
 *
 * Only rows whose program code actually resolves are checked (JOIN on programs.code);
 * missing/unknown programs are already reported as 'programNotFound' by each upload
 * function. The caller runs this before the insert function and aborts the load when it
 * returns any rows, so the existing all-or-nothing semantics are preserved.
 */
export class AddProgramModalityUploadValidation1780000000000 implements MigrationInterface {
	name = 'AddProgramModalityUploadValidation1780000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE OR REPLACE FUNCTION audit.fn_validate_program_modality(
	p_rows jsonb,
	p_academic_period_id integer
)
RETURNS TABLE(row_number integer, error_code text)
LANGUAGE sql
STABLE
AS $fn$
	SELECT (e->>'rowNumber')::int AS row_number, 'programModalityMismatch'::text AS error_code
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = NULLIF(trim(e->>'programCode'), '')
	JOIN academic.academic_periods ap ON ap.id = p_academic_period_id
	WHERE p.modality_type_id <> ap.modality_type_id;
$fn$;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DROP FUNCTION IF EXISTS audit.fn_validate_program_modality(jsonb, integer)`,
		);
	}
}
