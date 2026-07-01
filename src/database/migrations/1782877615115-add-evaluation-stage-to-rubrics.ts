import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEvaluationStageToRubrics1782877615115 implements MigrationInterface {
	name = 'AddEvaluationStageToRubrics1782877615115';

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
				'{"en":"Evaluation stage","es":"Etapa de evaluacion"}'::jsonb,
				'{"en":"Stages of a rubric-graded evaluation (Midterm, Final)","es":"Etapas de una evaluacion calificada por rubrica"}'::jsonb,
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
					('TG402-T001', '{"en":"Midterm","es":"Parcial"}'::jsonb, '{"en":"Midterm evaluation stage","es":"Etapa de evaluacion parcial"}'::jsonb),
					('TG402-T002', '{"en":"Final","es":"Final"}'::jsonb, '{"en":"Final evaluation stage","es":"Etapa de evaluacion final"}'::jsonb)
			) AS v(code, name, description)
			WHERE tg.code = 'TG402'
			  AND NOT EXISTS (
				SELECT 1 FROM core.types t WHERE t.code = v.code
			  )
		`);

		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ADD COLUMN evaluation_stage_type_id integer
		`);

		await queryRunner.query(`
			UPDATE evaluation.rubrics
			SET evaluation_stage_type_id = (SELECT id FROM core.types WHERE code = 'TG402-T001')
			WHERE evaluation_stage_type_id IS NULL
		`);

		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ALTER COLUMN evaluation_stage_type_id SET NOT NULL
		`);

		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			ADD CONSTRAINT "FK_rubrics_evaluation_stage_type_id" FOREIGN KEY (evaluation_stage_type_id)
			REFERENCES core.types(id) ON DELETE NO ACTION ON UPDATE NO ACTION
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			DROP CONSTRAINT "FK_rubrics_evaluation_stage_type_id"
		`);

		await queryRunner.query(`
			ALTER TABLE evaluation.rubrics
			DROP COLUMN evaluation_stage_type_id
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
