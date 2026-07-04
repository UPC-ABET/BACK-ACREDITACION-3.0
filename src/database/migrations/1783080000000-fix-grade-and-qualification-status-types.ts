import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * Corrects the naming of existing grade types (TG205) and the qualification status (TG404) that
 * were seeded with placeholder/wrong wording, and adds the codes that were missing. This is a
 * migration (not a seed patch) because it must run against databases that already have these
 * rows — the seed's INSERT is `WHERE NOT EXISTS`, so it never touches a code that already exists.
 *
 * TG205 (grade type):
 *   - TG205-T001 EA -> EA1 (Evaluacion Parcial 1)
 *   - TG205-T002 EB -> EB1 (Evaluacion Final 1)
 *   - TG205-T005 TP -> TB1 (Trabajo 1)
 *   - TG205-T006 TF -> TB2 (Trabajo 2)
 *   - TG205-T003 PA and TG205-T004 TA are left untouched.
 *   - New: TG205-T007 DD1, TG205-T008 PC1, TG205-T009 PC2.
 *
 * TG404 (qualification status):
 *   - TG404-T003 NA: description corrected (previously described the evaluator not attending;
 *     it's the student's attendance status, consistent with the new DPI/RET/SAN codes).
 *   - New: TG404-T004 DPI, TG404-T005 RET, TG404-T006 SAN.
 */
export class FixGradeAndQualificationStatusTypes1783080000000 implements MigrationInterface {
	name = 'FixGradeAndQualificationStatusTypes1783080000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// ── TG205: correct existing wording ────────────────────────────────
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "EA1", "en": "EA1"}'::jsonb,
				description = '{"es": "Evaluacion Parcial 1", "en": "Midterm Evaluation 1"}'::jsonb
			WHERE code = 'TG205-T001'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "EB1", "en": "EB1"}'::jsonb,
				description = '{"es": "Evaluacion Final 1", "en": "Final Evaluation 1"}'::jsonb
			WHERE code = 'TG205-T002'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "TB1", "en": "TB1"}'::jsonb,
				description = '{"es": "Trabajo 1", "en": "Assignment 1"}'::jsonb
			WHERE code = 'TG205-T005'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "TB2", "en": "TB2"}'::jsonb,
				description = '{"es": "Trabajo 2", "en": "Assignment 2"}'::jsonb
			WHERE code = 'TG205-T006'
		`);

		// ── TG205: add missing codes ────────────────────────────────────────
		await queryRunner.query(`
			INSERT INTO core.types (type_group_id, code, name, description, extra, is_active, created_at, updated_at)
			SELECT tg.id, v.code, v.name::jsonb, v.description::jsonb, '{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups tg
			JOIN (VALUES
				('TG205-T007', '{"es": "DD1", "en": "DD1"}', '{"es": "Evaluacion de Desempeno 1", "en": "Performance Evaluation 1"}'),
				('TG205-T008', '{"es": "PC1", "en": "PC1"}', '{"es": "Practica Calificada 1", "en": "Graded Practice 1"}'),
				('TG205-T009', '{"es": "PC2", "en": "PC2"}', '{"es": "Practica Calificada 2", "en": "Graded Practice 2"}')
			) AS v(code, name, description) ON true
			WHERE tg.code = 'TG205'
			ON CONFLICT (code) DO NOTHING
		`);

		// ── TG404: correct existing wording ─────────────────────────────────
		await queryRunner.query(`
			UPDATE core.types SET
				description = '{"es": "No Asistio - El alumno no asistio a la evaluacion", "en": "Did not attend - the student did not attend the evaluation"}'::jsonb
			WHERE code = 'TG404-T003'
		`);

		// ── TG404: add missing codes ─────────────────────────────────────────
		await queryRunner.query(`
			INSERT INTO core.types (type_group_id, code, name, description, extra, is_active, created_at, updated_at)
			SELECT tg.id, v.code, v.name::jsonb, v.description::jsonb, '{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups tg
			JOIN (VALUES
				('TG404-T004', '{"es": "DPI", "en": "DPI"}', '{"es": "Desaprobado por Inasistencias - El alumno reprueba por exceder el limite de inasistencias", "en": "Failed due to absences - the student fails for exceeding the absence limit"}'),
				('TG404-T005', '{"es": "RET", "en": "RET"}', '{"es": "Retirado - El alumno se retiro del curso", "en": "Withdrawn - the student withdrew from the course"}'),
				('TG404-T006', '{"es": "SAN", "en": "SAN"}', '{"es": "Sancionado - El alumno fue sancionado", "en": "Sanctioned - the student was sanctioned"}')
			) AS v(code, name, description) ON true
			WHERE tg.code = 'TG404'
			ON CONFLICT (code) DO NOTHING
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`DELETE FROM core.types WHERE code IN ('TG404-T004', 'TG404-T005', 'TG404-T006')`,
		);
		await queryRunner.query(`
			UPDATE core.types SET
				description = '{"es": "No Asistio - El evaluador no asistio a la evaluacion", "en": "Did not attend - the evaluator did not attend the evaluation"}'::jsonb
			WHERE code = 'TG404-T003'
		`);

		await queryRunner.query(
			`DELETE FROM core.types WHERE code IN ('TG205-T007', 'TG205-T008', 'TG205-T009')`,
		);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "TF", "en": "TF"}'::jsonb,
				description = '{"es": "Trabajo Final", "en": "Final assignment"}'::jsonb
			WHERE code = 'TG205-T006'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "TP", "en": "TP"}'::jsonb,
				description = '{"es": "Trabajo Parcial", "en": "Midterm assignment"}'::jsonb
			WHERE code = 'TG205-T005'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "EB", "en": "EB"}'::jsonb,
				description = '{"es": "Evaluacion Final", "en": "Final evaluation"}'::jsonb
			WHERE code = 'TG205-T002'
		`);
		await queryRunner.query(`
			UPDATE core.types SET
				name = '{"es": "EA", "en": "EA"}'::jsonb,
				description = '{"es": "Evaluacion Parcial", "en": "Midterm evaluation"}'::jsonb
			WHERE code = 'TG205-T001'
		`);
	}
}
