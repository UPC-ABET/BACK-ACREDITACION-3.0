import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRawBannerTables1781545794438 implements MigrationInterface {
	name = 'CreateRawBannerTables1781545794438';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

		await queryRunner.query(`
			CREATE TABLE "scrape_run" (
				"id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
				"nivel"         TEXT         NOT NULL,
				"periodo"       TEXT         NOT NULL,
				"departamentos" TEXT[]       NOT NULL,
				"status"        TEXT         NOT NULL,
				"started_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
				"finished_at"   TIMESTAMPTZ,
				"stats"         JSONB,
				"triggered_by"  TEXT,
				CONSTRAINT "PK_scrape_run" PRIMARY KEY ("id"),
				CONSTRAINT "CK_scrape_run_status"
					CHECK ("status" IN ('running', 'completed', 'partial', 'failed', 'expired'))
			)
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_scrape_run_periodo_started_at"
				ON "scrape_run" ("periodo", "started_at" DESC)
				WHERE "status" = 'completed'
		`);

		await queryRunner.query(`
			CREATE TABLE "raw_horario" (
				"id"           BIGSERIAL    NOT NULL,
				"run_id"       UUID         NOT NULL,
				"nivel"        TEXT         NOT NULL,
				"periodo"      TEXT         NOT NULL,
				"departamento" TEXT         NOT NULL,
				"nrc"          TEXT,
				"payload"      JSONB        NOT NULL,
				"payload_hash" CHAR(64)     NOT NULL,
				"scraped_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_raw_horario" PRIMARY KEY ("id"),
				CONSTRAINT "FK_raw_horario_run_id"
					FOREIGN KEY ("run_id") REFERENCES "scrape_run"("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_raw_horario_run_id_departamento_nrc"
					UNIQUE ("run_id", "departamento", "nrc")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_raw_horario_run_id" ON "raw_horario" ("run_id")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_horario_periodo_departamento" ON "raw_horario" ("periodo", "departamento")`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_raw_horario_nrc" ON "raw_horario" ("nrc")`);

		await queryRunner.query(`
			CREATE TABLE "raw_matricula" (
				"id"            BIGSERIAL    NOT NULL,
				"run_id"        UUID         NOT NULL,
				"nivel"         TEXT         NOT NULL,
				"periodo"       TEXT         NOT NULL,
				"nrc"           TEXT         NOT NULL,
				"codigo_alumno" TEXT,
				"payload"       JSONB        NOT NULL,
				"payload_hash"  CHAR(64)     NOT NULL,
				"scraped_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_raw_matricula" PRIMARY KEY ("id"),
				CONSTRAINT "FK_raw_matricula_run_id"
					FOREIGN KEY ("run_id") REFERENCES "scrape_run"("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_raw_matricula_run_id_nrc_codigo_alumno"
					UNIQUE ("run_id", "nrc", "codigo_alumno")
			)
		`);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_matricula_run_id" ON "raw_matricula" ("run_id")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_matricula_periodo_nrc" ON "raw_matricula" ("periodo", "nrc")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_matricula_codigo_alumno" ON "raw_matricula" ("codigo_alumno")`,
		);

		await queryRunner.query(`
			CREATE TABLE "raw_alumno" (
				"id"            BIGSERIAL    NOT NULL,
				"run_id"        UUID         NOT NULL,
				"nivel"         TEXT         NOT NULL,
				"codigo_alumno" TEXT         NOT NULL,
				"payload"       JSONB        NOT NULL,
				"payload_hash"  CHAR(64)     NOT NULL,
				"scraped_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_raw_alumno" PRIMARY KEY ("id"),
				CONSTRAINT "FK_raw_alumno_run_id"
					FOREIGN KEY ("run_id") REFERENCES "scrape_run"("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_raw_alumno_run_id_codigo_alumno"
					UNIQUE ("run_id", "codigo_alumno")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_raw_alumno_run_id" ON "raw_alumno" ("run_id")`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "raw_alumno"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "raw_matricula"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "raw_horario"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "scrape_run"`);
	}
}
