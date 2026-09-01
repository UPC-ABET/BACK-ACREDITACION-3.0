import { MigrationInterface, QueryRunner } from 'typeorm';

// See ADR-005: Banner grades scraping is retired in favor of Planner alone. This table's
// FK cascaded from scrape_run, so its rows were already ephemeral (superseded by every new
// completed run under the existing retention rule) -- dropping it discards no data that
// wasn't already scrape cache.
export class DropRawNotasTable1788215961367 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE "raw_notas"`);
	}

	// Recreates the table exactly as it exists today -- including the two index names that
	// were never renamed to English by 1787346461765-rename-raw-scrape-spanish-columns.ts,
	// unlike the columns and the UNIQUE constraint they cover.
	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "raw_notas" (
				"id"            BIGSERIAL    NOT NULL,
				"run_id"        UUID         NOT NULL,
				"level"         TEXT         NOT NULL,
				"period"        TEXT         NOT NULL,
				"student_code"  TEXT         NOT NULL,
				"course_code"   TEXT         NOT NULL,
				"payload"       JSONB        NOT NULL,
				"payload_hash"  CHAR(64)     NOT NULL,
				"scraped_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_raw_notas" PRIMARY KEY ("id"),
				CONSTRAINT "FK_raw_notas_run_id"
					FOREIGN KEY ("run_id") REFERENCES "scrape_run"("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_raw_notas_run_id_student_code_course_code"
					UNIQUE ("run_id", "student_code", "course_code")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_raw_notas_run_id" ON "raw_notas" ("run_id")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_notas_periodo_curso_codigo" ON "raw_notas" ("period", "course_code")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_notas_codigo_alumno" ON "raw_notas" ("student_code")`,
		);
	}
}
