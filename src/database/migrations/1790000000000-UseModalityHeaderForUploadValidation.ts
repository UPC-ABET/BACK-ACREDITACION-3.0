import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * The bulk-upload program/modality mismatch check now validates against the modality
 * selected in the request header (x-modality-type-id), not the academic period's modality.
 * The validator therefore takes p_modality_type_id directly instead of resolving the
 * modality from p_academic_period_id. The parameter name changes, so the function is
 * dropped and recreated (CREATE OR REPLACE cannot rename input parameters).
 */
export class UseModalityHeaderForUploadValidation1790000000000 implements MigrationInterface {
	name = 'UseModalityHeaderForUploadValidation1790000000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_validate_program_modality(jsonb, integer)`);
		await queryRunner.query(`
CREATE FUNCTION audit.fn_validate_program_modality(
	p_rows jsonb,
	p_modality_type_id integer
)
RETURNS TABLE(row_number integer, error_code text)
LANGUAGE sql
STABLE
AS $fn$
	SELECT (e->>'rowNumber')::int AS row_number, 'programModalityMismatch'::text AS error_code
	FROM jsonb_array_elements(p_rows) AS e
	JOIN academic.programs p ON p.code = NULLIF(trim(e->>'programCode'), '')
	WHERE p.modality_type_id <> p_modality_type_id;
$fn$;
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP FUNCTION IF EXISTS audit.fn_validate_program_modality(jsonb, integer)`);
		await queryRunner.query(`
CREATE FUNCTION audit.fn_validate_program_modality(
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
}
