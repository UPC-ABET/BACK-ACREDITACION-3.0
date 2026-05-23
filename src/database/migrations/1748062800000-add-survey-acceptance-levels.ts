import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSurveyAcceptanceLevels1748062800000 implements MigrationInterface {
	name = 'AddSurveyAcceptanceLevels1748062800000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "survey"."acceptance_levels" (
				"id"                  SERIAL PRIMARY KEY,
				"extra"               JSONB NOT NULL DEFAULT '{}',
				"is_active"           BOOLEAN NOT NULL DEFAULT true,
				"created_at"          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
				"updated_at"          TIMESTAMPTZ,
				"survey_type_id"      INTEGER NOT NULL,
				"academic_period_id"  INTEGER NOT NULL,
				"name"                JSONB NOT NULL,
				"order"               INTEGER,
				"min_score"           DECIMAL(12,6) NOT NULL,
				"max_score"           DECIMAL(12,6) NOT NULL,
				"color"               VARCHAR(100),
				"is_final"            BOOLEAN NOT NULL DEFAULT false,
				CONSTRAINT "fk_al_survey_type"     FOREIGN KEY ("survey_type_id")     REFERENCES "core"."types"("id"),
				CONSTRAINT "fk_al_academic_period" FOREIGN KEY ("academic_period_id") REFERENCES "academic"."academic_periods"("id")
			)
		`);

		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_AL_SURVEY_TYPE_PERIOD"
			ON "survey"."acceptance_levels" ("survey_type_id", "academic_period_id")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "survey"."acceptance_levels"`);
	}
}
