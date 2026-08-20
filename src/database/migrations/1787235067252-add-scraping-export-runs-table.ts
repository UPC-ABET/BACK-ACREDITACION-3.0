import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScrapingExportRunsTable1787235067252 implements MigrationInterface {
	name = 'AddScrapingExportRunsTable1787235067252';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "core"."scraping_export_runs" (
				"id" SERIAL NOT NULL,
				"extra" jsonb NOT NULL DEFAULT '{}'::jsonb,
				"is_active" boolean NOT NULL DEFAULT true,
				"created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
				"updated_at" TIMESTAMP WITH TIME ZONE,
				"export_type" character varying(100) NOT NULL,
				"periodo" character varying(100) NOT NULL,
				"lang" character varying(100) NOT NULL,
				"status" character varying(100) NOT NULL,
				"file_name" character varying(100),
				"file_bytes" bytea,
				"error_message" character varying(1000),
				"source_banner_run_id" character varying(100),
				"source_planner_run_id" character varying(100),
				"triggered_by" character varying(100) NOT NULL,
				"started_at" TIMESTAMP WITH TIME ZONE,
				"finished_at" TIMESTAMP WITH TIME ZONE,
				CONSTRAINT "PK_scraping_export_runs" PRIMARY KEY ("id")
			)
		`);

		await queryRunner.query(`
			ALTER TABLE "core"."scraping_export_runs"
			ADD CONSTRAINT "UQ_scraping_export_runs_export_type_periodo_lang" UNIQUE ("export_type", "periodo", "lang")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE IF EXISTS "core"."scraping_export_runs" DROP CONSTRAINT IF EXISTS "UQ_scraping_export_runs_export_type_periodo_lang"`,
		);
		await queryRunner.query(`DROP TABLE IF EXISTS "core"."scraping_export_runs"`);
	}
}
