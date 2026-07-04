import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Seeds the report acceptance levels that the RC/RV semaphore reports classify against.
 *
 * Context: `academic.performance_levels` are per-instrument, per-academic-period. The base
 * seed only created levels for the rubric-scoring instrument (TG206-T001) and only for period
 * 202601. The reports classify against RC (TG206-T003) and RV (TG206-T004), so without levels
 * for those instruments the report legend comes back empty and every student falls "sin nivel"
 * (studentsRed/Yellow/Green = 0). This migration provisions:
 *
 *   1. RC (TG206-T003) and RV (TG206-T004): 3 acceptance bands on the /20 scale, per period.
 *        0 – 12.999999  → Necesita mejora   (nivel más bajo)
 *        13 – 15.999999 → Esperado          (nivel intermedio)
 *        16 – 20        → Sobresaliente      (nivel más alto)
 *      Colors live in extra.color (used only for styling in PDF/UI).
 *
 *   2. TG206-T001 (rubric scoring): clones the 4 base bands into every period that lacks them,
 *      so `getHighestPerformanceLevelValue` (→ extra.max_outcome) resolves to a real value
 *      instead of 0 when grading in periods other than 202601.
 *
 * Idempotent: for each (instrument, period) pair it inserts only when that pair has no levels yet,
 * so periods already configured (e.g. TG206-T001 / 202601) and any manual configuration are left
 * untouched. Codes are globally unique ("<INSTR>_L<n>_<periodCode>"), matching UQ_performance_levels_code.
 */
export class SeedRcRvPerformanceLevels1783090000000 implements MigrationInterface {
	name = 'SeedRcRvPerformanceLevels1783090000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// --- RC (TG206-T003) and RV (TG206-T004): 3 acceptance bands per period ---
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

		// --- TG206-T001 (rubric scoring): clone the 4 base bands into periods that lack them ---
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
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Only removes the rows this migration could have created (by generated code pattern).
		await queryRunner.query(`
			DELETE FROM academic.performance_levels
			WHERE code ~ '^(RC|RV)_L[1-3]_.+$'
			   OR code ~ '^PL_(STARTING|DEVELOPING|EXPECTED|EXCELLENT)_.+$';
		`);
	}
}
