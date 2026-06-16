import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRawNotasTable1781589368670 implements MigrationInterface {
	name = 'CreateRawNotasTable1781589368670';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "raw_notas" (
				"id"            BIGSERIAL    NOT NULL,
				"run_id"        UUID         NOT NULL,
				"nivel"         TEXT         NOT NULL,
				"periodo"       TEXT         NOT NULL,
				"codigo_alumno" TEXT         NOT NULL,
				"curso_codigo"  TEXT         NOT NULL,
				"payload"       JSONB        NOT NULL,
				"payload_hash"  CHAR(64)     NOT NULL,
				"scraped_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
				CONSTRAINT "PK_raw_notas" PRIMARY KEY ("id"),
				CONSTRAINT "FK_raw_notas_run_id"
					FOREIGN KEY ("run_id") REFERENCES "scrape_run"("id") ON DELETE CASCADE,
				CONSTRAINT "UQ_raw_notas_run_id_codigo_alumno_curso_codigo"
					UNIQUE ("run_id", "codigo_alumno", "curso_codigo")
			)
		`);
		await queryRunner.query(`CREATE INDEX "IDX_raw_notas_run_id" ON "raw_notas" ("run_id")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_notas_periodo_curso_codigo" ON "raw_notas" ("periodo", "curso_codigo")`,
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_raw_notas_codigo_alumno" ON "raw_notas" ("codigo_alumno")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "raw_notas"`);
	}
}
