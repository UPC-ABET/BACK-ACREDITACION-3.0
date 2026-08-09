import { MigrationInterface, QueryRunner } from 'typeorm';

// Joins added by the grades-rc export when it started merging Banner with Planner
// (GradesRcExportRepository). Neither is served by an existing index: the Planner evaluación
// UNIQUE is (run_id, section_id, eval_component_id), so it cannot be used as a prefix for a
// lookup that has no section_id, and raw_horario has run_id and nrc in separate indexes while
// the section resolution needs both.
export class AddGradesRcExportIndexes1786317144777 implements MigrationInterface {
	name = 'AddGradesRcExportIndexes1786317144777';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_raw_planner_evaluacion_run_id_eval_component_id"
				ON "raw_planner_evaluacion" ("run_id", "eval_component_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_raw_horario_run_id_nrc"
				ON "raw_horario" ("run_id", "nrc")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_raw_horario_run_id_nrc"`);
		await queryRunner.query(
			`DROP INDEX IF EXISTS "IDX_raw_planner_evaluacion_run_id_eval_component_id"`,
		);
	}
}
