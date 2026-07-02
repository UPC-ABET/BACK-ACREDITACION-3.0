import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompetencyScopeToRubrics1782877615115 implements MigrationInterface {
	name = 'AddCompetencyScopeToRubrics1782877615115';

	public async up(queryRunner: QueryRunner): Promise<void> {
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
				'TG402',
				'{"en":"Competency scope","es":"Alcance de competencias"}'::jsonb,
				'{"en":"Whether a rubric evaluates a single or multiple competencies","es":"Si una rubrica evalua una unica competencia o multiples competencias"}'::jsonb,
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
				v.code,
				v.name,
				v.description,
				'{}'::jsonb,
				true,
				NOW(),
				NULL
			FROM core.type_groups tg
			CROSS JOIN (
				VALUES
					('TG402-T001', '{"en":"Single competency","es":"Unica competencia"}'::jsonb, '{"en":"Rubric evaluates a single competency","es":"Rubrica que evalua una unica competencia"}'::jsonb),
					('TG402-T002', '{"en":"Multiple competency","es":"Multiple competencia"}'::jsonb, '{"en":"Rubric evaluates multiple competencies","es":"Rubrica que evalua multiples competencias"}'::jsonb)
			) AS v(code, name, description)
			WHERE tg.code = 'TG402'
			  AND NOT EXISTS (
				SELECT 1 FROM core.types t WHERE t.code = v.code
			  )
		`);

		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ADD COLUMN competency_scope_type_id integer
		`);

		await queryRunner.query(`
			UPDATE evaluation.rubrics
			SET competency_scope_type_id = (SELECT id FROM core.types WHERE code = 'TG402-T001')
			WHERE competency_scope_type_id IS NULL
		`);

		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ALTER COLUMN competency_scope_type_id SET NOT NULL
		`);

		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ADD CONSTRAINT "FK_rubrics_competency_scope_type_id" FOREIGN KEY (competency_scope_type_id)
			REFERENCES core.types(id) ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			DROP CONSTRAINT "FK_rubrics_competency_scope_type_id"
		`);

		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			DROP COLUMN competency_scope_type_id
		`);

		await queryRunner.query(`
			DELETE FROM core.types
			WHERE code IN ('TG402-T001', 'TG402-T002')
		`);

		await queryRunner.query(`
			DELETE FROM core.type_groups
			WHERE code = 'TG402'
		`);
	}
}
