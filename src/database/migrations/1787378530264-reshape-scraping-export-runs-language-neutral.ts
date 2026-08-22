import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReshapeScrapingExportRunsLanguageNeutral1787378530264 implements MigrationInterface {
	name = 'ReshapeScrapingExportRunsLanguageNeutral1787378530264';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// core.scraping_export_runs holds pure derived/cache rows with no audit value — an old
		// (export_type, period, lang) row cannot be losslessly collapsed into the new per-period,
		// language-neutral shape (there is no way to recover row-level data from an already-rendered
		// .xlsx). See ADR-003 §6 and this change's runbook.md for the deploy-time consequence.
		await queryRunner.query(`DELETE FROM "core"."scraping_export_runs"`);

		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" DROP CONSTRAINT "UQ_scraping_export_runs_export_type_period_lang"`,
		);
		await queryRunner.query(`ALTER TABLE "core"."scraping_export_runs" DROP COLUMN "lang"`);
		await queryRunner.query(`ALTER TABLE "core"."scraping_export_runs" DROP COLUMN "file_bytes"`);
		await queryRunner.query(`ALTER TABLE "core"."scraping_export_runs" DROP COLUMN "file_name"`);
		await queryRunner.query(`ALTER TABLE "core"."scraping_export_runs" ADD "rows_data" jsonb`);
		await queryRunner.query(`
			ALTER TABLE "core"."scraping_export_runs"
			ADD CONSTRAINT "UQ_scraping_export_runs_export_type_period" UNIQUE ("export_type", "period")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Restores the column/constraint shape only — the data deleted in up() is not recoverable.
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" DROP CONSTRAINT IF EXISTS "UQ_scraping_export_runs_export_type_period"`,
		);
		await queryRunner.query(`ALTER TABLE "core"."scraping_export_runs" DROP COLUMN "rows_data"`);
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" ADD "file_name" character varying(100)`,
		);
		await queryRunner.query(`ALTER TABLE "core"."scraping_export_runs" ADD "file_bytes" bytea`);
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" ADD "lang" character varying(100) NOT NULL DEFAULT 'es'`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" ALTER COLUMN "lang" DROP DEFAULT`,
		);
		await queryRunner.query(`
			ALTER TABLE "core"."scraping_export_runs"
			ADD CONSTRAINT "UQ_scraping_export_runs_export_type_period_lang" UNIQUE ("export_type", "period", "lang")
		`);
	}
}
