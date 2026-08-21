import { MigrationInterface, QueryRunner } from 'typeorm';

/*
 * `triggered_by` had no DB-level default, only NOT NULL. `ScrapingExportRunRepository.upsertByKey`'s
 * finalize calls (running -> completed/failed, and the stale-reconcile path) intentionally omit
 * `triggeredBy` to leave the existing value untouched, but Postgres validates every NOT NULL column
 * against `INSERT ... ON CONFLICT DO UPDATE`'s candidate row before it even checks for a conflict —
 * so those calls failed with a NOT NULL violation instead of falling through to the UPDATE branch
 * that would have preserved the column. The default only satisfies that transient check; it is
 * never the value actually written, since `triggered_by` isn't in the `DO UPDATE SET` list.
 */
export class AddDefaultToScrapingExportRunsTriggeredBy1787334615628 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."scraping_export_runs"
			ALTER COLUMN "triggered_by" SET DEFAULT ''
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE "core"."scraping_export_runs"
			ALTER COLUMN "triggered_by" DROP DEFAULT
		`);
	}
}
