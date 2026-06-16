import { MigrationInterface, QueryRunner } from 'typeorm';

// Planner (u-planner) raw capture tables, the Planner analogue of the Banner raw tables
// (1781545794438-create-raw-banner-tables). Same separate scraping DB. Three phases:
// seccion -> evaluacion (per section) -> nota (per component, exploded by student). Payloads
// stored verbatim (jsonb) with only the join keys extracted + a sha256 hash, append-per-run,
// run_id FK ON DELETE CASCADE, idempotency UNIQUE keys for ON CONFLICT DO NOTHING writers.
export class CreateRawPlannerTables1781600000000 implements MigrationInterface {
	name = 'CreateRawPlannerTables1781600000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

		await queryRunner.query(`
			CREATE TABLE "planner_scrape_run" (
				"id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
				"periodo"      TEXT         NOT NULL,
				"escuela"      TEXT,
				"status"       TEXT         NOT NULL,
				"started_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
				"finished_at"  TIMESTAMPTZ,
				"stats"        JSONB,
				"triggered_by" TEXT,
				CONSTRAINT "PK_planner_scrape_run" PRIMARY KEY ("id"),
				CONSTRAINT "CK_planner_scrape_run_status"
					CHECK ("status" IN ('running', 'completed', 'partial', 'failed', 'expired'))
			)
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_planner_scrape_run_periodo_started_at"
				ON "planner_scrape_run" ("periodo", "started_at" DESC)
				WHERE "status" = 'completed'
		`);

		await queryRunner.query(`
			CREATE TABLE "raw_planner_seccion" (
				"id"           BIGSERIAL    NOT NULL,
				"run_id"       UUID         NOT NULL,
				"periodo"      TEXT         NOT NULL,
				"section_id"   TEXT,
				"payload"      JSONB        NOT NULL,
				"payload_hash" CHAR(64)     NOT NULL,
				"scraped_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_raw_planner_seccion" PRIMARY KEY ("id"),
				CONSTRAINT "FK_raw_planner_seccion_run_id"
					FOREIGN KEY ("run_id") REFERENCES "planner_scrape_run"("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_raw_planner_seccion_run_id_section_id"
					UNIQUE ("run_id", "section_id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_planner_seccion_run_id" ON "raw_planner_seccion" ("run_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_planner_seccion_periodo" ON "raw_planner_seccion" ("periodo")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_planner_seccion_section_id" ON "raw_planner_seccion" ("section_id")`,
		);

		await queryRunner.query(`
			CREATE TABLE "raw_planner_evaluacion" (
				"id"                BIGSERIAL    NOT NULL,
				"run_id"            UUID         NOT NULL,
				"section_id"        TEXT,
				"eval_component_id" TEXT,
				"payload"           JSONB        NOT NULL,
				"payload_hash"      CHAR(64)     NOT NULL,
				"scraped_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_raw_planner_evaluacion" PRIMARY KEY ("id"),
				CONSTRAINT "FK_raw_planner_evaluacion_run_id"
					FOREIGN KEY ("run_id") REFERENCES "planner_scrape_run"("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_raw_planner_evaluacion_run_id_section_id_component"
					UNIQUE ("run_id", "section_id", "eval_component_id")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_planner_evaluacion_run_id" ON "raw_planner_evaluacion" ("run_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_planner_evaluacion_section_id" ON "raw_planner_evaluacion" ("section_id")`,
		);

		await queryRunner.query(`
			CREATE TABLE "raw_planner_nota" (
				"id"           BIGSERIAL    NOT NULL,
				"run_id"       UUID         NOT NULL,
				"section_id"   TEXT,
				"component_id" TEXT,
				"student_code" TEXT,
				"payload"      JSONB        NOT NULL,
				"payload_hash" CHAR(64)     NOT NULL,
				"scraped_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_raw_planner_nota" PRIMARY KEY ("id"),
				CONSTRAINT "FK_raw_planner_nota_run_id"
					FOREIGN KEY ("run_id") REFERENCES "planner_scrape_run"("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_raw_planner_nota_run_id_component_id_student_code"
					UNIQUE ("run_id", "component_id", "student_code")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_planner_nota_run_id" ON "raw_planner_nota" ("run_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_planner_nota_section_id" ON "raw_planner_nota" ("section_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_planner_nota_student_code" ON "raw_planner_nota" ("student_code")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "raw_planner_nota"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "raw_planner_evaluacion"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "raw_planner_seccion"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "planner_scrape_run"`);
	}
}
