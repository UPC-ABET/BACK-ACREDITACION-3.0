import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhaseToScrapeRuns1787270797549 implements MigrationInterface {
	name = 'AddPhaseToScrapeRuns1787270797549';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "scrape_run" ADD COLUMN "phase" TEXT`);
		await queryRunner.query(`
			ALTER TABLE "scrape_run" ADD CONSTRAINT "CK_scrape_run_phase"
				CHECK ("phase" IN ('horario', 'matricula', 'alumnosYNotas'))
		`);

		await queryRunner.query(`ALTER TABLE "planner_scrape_run" ADD COLUMN "phase" TEXT`);
		await queryRunner.query(`
			ALTER TABLE "planner_scrape_run" ADD CONSTRAINT "CK_planner_scrape_run_phase"
				CHECK ("phase" IN ('secciones', 'evaluaciones', 'notas'))
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "planner_scrape_run" DROP CONSTRAINT "CK_planner_scrape_run_phase"`,
		);
		await queryRunner.query(`ALTER TABLE "planner_scrape_run" DROP COLUMN "phase"`);

		await queryRunner.query(`ALTER TABLE "scrape_run" DROP CONSTRAINT "CK_scrape_run_phase"`);
		await queryRunner.query(`ALTER TABLE "scrape_run" DROP COLUMN "phase"`);
	}
}
