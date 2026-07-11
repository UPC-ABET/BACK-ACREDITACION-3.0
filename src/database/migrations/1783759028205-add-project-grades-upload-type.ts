import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectGradesUploadType1783759028205 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		// evidence.evaluations and evaluation.rubric_scores already have upload_log_id (added by the
		// RC/RV consolidation migration) — this upload reuses that column + the extra.upload_undo
		// stack pattern already used by academic.student_course_grades (RC) for upsert-safe rollback.
		await queryRunner.query(`
			INSERT INTO core.types (type_group_id, code, name, extra, is_active, created_at, updated_at)
			SELECT tg.id, 'TG1101-T014',
				'{"es": "Notas de proyectos", "en": "Project grades"}'::jsonb,
				'{}'::jsonb, true, NOW(), NOW()
			FROM core.type_groups tg WHERE tg.code = 'TG1101'
			ON CONFLICT (code) DO NOTHING
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DELETE FROM core.types WHERE code = 'TG1101-T014'`);
	}
}
