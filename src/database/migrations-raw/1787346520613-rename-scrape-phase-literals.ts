import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameScrapePhaseLiterals1787346520613 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "scrape_run" DROP CONSTRAINT "CK_scrape_run_phase"`);
		await queryRunner.query(`
			UPDATE "scrape_run" SET "phase" = CASE "phase"
				WHEN 'horario' THEN 'schedule'
				WHEN 'matricula' THEN 'enrollment'
				WHEN 'alumnosYNotas' THEN 'studentsAndGrades'
				ELSE "phase"
			END
			WHERE "phase" IS NOT NULL
		`);
		await queryRunner.query(`
			ALTER TABLE "scrape_run" ADD CONSTRAINT "CK_scrape_run_phase"
				CHECK ("phase" IN ('schedule', 'enrollment', 'studentsAndGrades'))
		`);

		await queryRunner.query(
			`ALTER TABLE "planner_scrape_run" DROP CONSTRAINT "CK_planner_scrape_run_phase"`,
		);
		await queryRunner.query(`
			UPDATE "planner_scrape_run" SET "phase" = CASE "phase"
				WHEN 'secciones' THEN 'sections'
				WHEN 'evaluaciones' THEN 'evaluations'
				WHEN 'notas' THEN 'grades'
				ELSE "phase"
			END
			WHERE "phase" IS NOT NULL
		`);
		await queryRunner.query(`
			ALTER TABLE "planner_scrape_run" ADD CONSTRAINT "CK_planner_scrape_run_phase"
				CHECK ("phase" IN ('sections', 'evaluations', 'grades'))
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "planner_scrape_run" DROP CONSTRAINT "CK_planner_scrape_run_phase"`,
		);
		await queryRunner.query(`
			UPDATE "planner_scrape_run" SET "phase" = CASE "phase"
				WHEN 'sections' THEN 'secciones'
				WHEN 'evaluations' THEN 'evaluaciones'
				WHEN 'grades' THEN 'notas'
				ELSE "phase"
			END
			WHERE "phase" IS NOT NULL
		`);
		await queryRunner.query(`
			ALTER TABLE "planner_scrape_run" ADD CONSTRAINT "CK_planner_scrape_run_phase"
				CHECK ("phase" IN ('secciones', 'evaluaciones', 'notas'))
		`);

		await queryRunner.query(`ALTER TABLE "scrape_run" DROP CONSTRAINT "CK_scrape_run_phase"`);
		await queryRunner.query(`
			UPDATE "scrape_run" SET "phase" = CASE "phase"
				WHEN 'schedule' THEN 'horario'
				WHEN 'enrollment' THEN 'matricula'
				WHEN 'studentsAndGrades' THEN 'alumnosYNotas'
				ELSE "phase"
			END
			WHERE "phase" IS NOT NULL
		`);
		await queryRunner.query(`
			ALTER TABLE "scrape_run" ADD CONSTRAINT "CK_scrape_run_phase"
				CHECK ("phase" IN ('horario', 'matricula', 'alumnosYNotas'))
		`);
	}
}
