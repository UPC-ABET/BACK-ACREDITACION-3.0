import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameScrapingExportRunsPeriodo1787350920408 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" RENAME COLUMN "periodo" TO "period"`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" DROP CONSTRAINT "UQ_scraping_export_runs_export_type_periodo_lang"`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" ADD CONSTRAINT "UQ_scraping_export_runs_export_type_period_lang" UNIQUE ("export_type", "period", "lang")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" DROP CONSTRAINT "UQ_scraping_export_runs_export_type_period_lang"`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" ADD CONSTRAINT "UQ_scraping_export_runs_export_type_periodo_lang" UNIQUE ("export_type", "periodo", "lang")`,
		);
		await queryRunner.query(
			`ALTER TABLE "core"."scraping_export_runs" RENAME COLUMN "period" TO "periodo"`,
		);
	}
}
