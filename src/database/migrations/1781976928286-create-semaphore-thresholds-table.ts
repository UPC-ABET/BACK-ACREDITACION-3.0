import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSemaphoreThresholdsTable1781976928286 implements MigrationInterface {
	name = 'CreateSemaphoreThresholdsTable1781976928286';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
CREATE TABLE "evaluation"."semaphore_thresholds" (
	"id"                    SERIAL NOT NULL,
	"extra"                 jsonb NOT NULL DEFAULT '{}'::jsonb,
	"is_active"             boolean NOT NULL DEFAULT true,
	"created_at"            TIMESTAMP WITH TIME ZONE DEFAULT now(),
	"updated_at"            TIMESTAMP WITH TIME ZONE,
	"instrument_type_id"    integer NOT NULL,
	"academic_period_id"    integer,
	"program_id"            integer,
	"min_percentage"        numeric(5,2) NOT NULL,
	"max_percentage"        numeric(5,2) NOT NULL,
	"color"                 character varying(20) NOT NULL,
	"name"                  jsonb NOT NULL DEFAULT '{}'::jsonb,
	CONSTRAINT "PK_semaphore_thresholds" PRIMARY KEY ("id"),
	CONSTRAINT "UQ_semaphore_thresholds_instrument_period_program_range"
		UNIQUE ("instrument_type_id", "academic_period_id", "program_id", "min_percentage", "max_percentage")
);
`);

		await queryRunner.query(`
ALTER TABLE "evaluation"."semaphore_thresholds"
	ADD CONSTRAINT "FK_semaphore_thresholds_instrument_type_id"
	FOREIGN KEY ("instrument_type_id") REFERENCES "core"."types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
`);
		await queryRunner.query(`
ALTER TABLE "evaluation"."semaphore_thresholds"
	ADD CONSTRAINT "FK_semaphore_thresholds_academic_period_id"
	FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
`);
		await queryRunner.query(`
ALTER TABLE "evaluation"."semaphore_thresholds"
	ADD CONSTRAINT "FK_semaphore_thresholds_program_id"
	FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
`);

		await queryRunner.query(`
CREATE INDEX "IDX_semaphore_thresholds_instrument_type_id"
	ON "evaluation"."semaphore_thresholds" ("instrument_type_id")
`);
		await queryRunner.query(`
CREATE INDEX "IDX_semaphore_thresholds_academic_period_id"
	ON "evaluation"."semaphore_thresholds" ("academic_period_id")
`);

		await queryRunner.query(`
INSERT INTO "evaluation"."semaphore_thresholds"
	("instrument_type_id", "academic_period_id", "program_id", "min_percentage", "max_percentage", "color", "name")
SELECT
	it.id, NULL, NULL, 0, 59.99, 'ROJO',
	'${`{"es": "Rojo", "en": "Red"}`}'::jsonb
FROM core.types it
WHERE it.code IN ('TG206-T003', 'TG206-T004')
  AND it.is_active = true
`);

		await queryRunner.query(`
INSERT INTO "evaluation"."semaphore_thresholds"
	("instrument_type_id", "academic_period_id", "program_id", "min_percentage", "max_percentage", "color", "name")
SELECT
	it.id, NULL, NULL, 60, 74.99, 'AMARILLO',
	'${`{"es": "Amarillo", "en": "Yellow"}`}'::jsonb
FROM core.types it
WHERE it.code IN ('TG206-T003', 'TG206-T004')
  AND it.is_active = true
`);

		await queryRunner.query(`
INSERT INTO "evaluation"."semaphore_thresholds"
	("instrument_type_id", "academic_period_id", "program_id", "min_percentage", "max_percentage", "color", "name")
SELECT
	it.id, NULL, NULL, 75, 100, 'VERDE',
	'${`{"es": "Verde", "en": "Green"}`}'::jsonb
FROM core.types it
WHERE it.code IN ('TG206-T003', 'TG206-T004')
  AND it.is_active = true
`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_semaphore_thresholds_academic_period_id"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_semaphore_thresholds_instrument_type_id"`);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."semaphore_thresholds" DROP CONSTRAINT "FK_semaphore_thresholds_program_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."semaphore_thresholds" DROP CONSTRAINT "FK_semaphore_thresholds_academic_period_id"`,
		);
		await queryRunner.query(
			`ALTER TABLE "evaluation"."semaphore_thresholds" DROP CONSTRAINT "FK_semaphore_thresholds_instrument_type_id"`,
		);
		await queryRunner.query(`DROP TABLE "evaluation"."semaphore_thresholds"`);
	}
}
