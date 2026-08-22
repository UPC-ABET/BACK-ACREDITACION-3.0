import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScrapingExportGradesrcRowsTable1787378550454 implements MigrationInterface {
	name = 'AddScrapingExportGradesrcRowsTable1787378550454';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "core"."scraping_export_gradesrc_rows" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"scraping_export_run_id" int NOT NULL,
				"generated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
				"section_code" character varying(100) NOT NULL,
				"student_code" character varying(100) NOT NULL,
				"grade_type_code" character varying(100) NOT NULL,
				"grade_type_percentage" character varying(100) NOT NULL,
				"grade" character varying(100) NOT NULL,
				"qualification_status_code" character varying(100) NOT NULL,
				"academic_period" character varying(100) NOT NULL,
				"course_code" character varying(100) NOT NULL,
				"course_name" character varying(1000) NOT NULL,
				"student_name" character varying(1000) NOT NULL,
				"career_code" character varying(100) NOT NULL DEFAULT '',
				"grade_type_name" character varying(1000) NOT NULL,
				"qualification_status_name" character varying(1000) NOT NULL,
				"source" character varying(100) NOT NULL,
				"scraped_at" character varying(100) NOT NULL,
				"observations" jsonb NOT NULL DEFAULT '[]'::jsonb,
				"has_observations" boolean NOT NULL,
				CONSTRAINT "PK_scraping_export_gradesrc_rows" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			ALTER TABLE "core"."scraping_export_gradesrc_rows"
			ADD CONSTRAINT "FK_scraping_export_gradesrc_rows_scraping_export_run_id"
			FOREIGN KEY ("scraping_export_run_id") REFERENCES "core"."scraping_export_runs"("id")
			ON DELETE CASCADE
		`);

		await queryRunner.query(`
			CREATE INDEX "IDX_scraping_export_gradesrc_rows_run_id"
			ON "core"."scraping_export_gradesrc_rows" ("scraping_export_run_id")
		`);
		await queryRunner.query(`
			CREATE INDEX "IDX_scraping_export_gradesrc_rows_has_observations"
			ON "core"."scraping_export_gradesrc_rows" ("has_observations")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."scraping_export_gradesrc_rows"`);
	}
}
