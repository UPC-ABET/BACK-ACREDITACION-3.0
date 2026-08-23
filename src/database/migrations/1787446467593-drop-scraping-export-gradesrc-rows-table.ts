import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropScrapingExportGradesrcRowsTable1787446467593 implements MigrationInterface {
	name = 'DropScrapingExportGradesrcRowsTable1787446467593';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// `defer-export-language-to-download` (already merged to develop) introduced this table and
		// has been live since. Any gradesRc generation that completed against that code before this
		// migration runs left a `core.scraping_export_runs` row with status='completed' and
		// rows_data=null (gradesRc never wrote rows_data). Dropping the table with no backfill would
		// silently strand that row: `getStatus` still reports 'completed' (this migration never
		// touches `status`), but `download` returns null forever, since rows_data was never
		// populated and nothing repopulates it without a fresh regenerate. Backfilling here — the
		// same latest-batch-per-run selection `readPage`'s `generatedAt` scoping used — keeps status
		// and download in agreement across the deploy, with no regeneration required.
		//
		// Keys are snake_case to match every other write to this jsonb column (SnakeNamingStrategy's
		// transformer only bridges top-level columns, not jsonb content -- see docs/POLICIES.md).
		//
		// `run.status = 'completed'` is a deliberate guard, not incidental: the old (pre-fix) code
		// only flips a run to 'completed' after every chunk of a batch has been inserted, so a run
		// still 'running' at the instant this migration executes (an old-code generation genuinely
		// in flight, independent of the deploy window -- scrape completions fire-and-forget trigger
		// it) has, at best, a partial batch on disk. Backfilling that would let `download` --
		// which deliberately serves `rowsData` even while `status` is 'running' (stale-while-
		// regenerating) -- silently hand out torn data instead of the honest `null` this migration
		// exists to avoid. Skipping a still-running run here just leaves its `rowsData` `null`,
		// which self-heals on the next regenerate -- the same accepted fallback as any other run
		// this backfill can't reach.
		await queryRunner.query(`
			WITH latest_batch AS (
				SELECT scraping_export_run_id, MAX(generated_at) AS generated_at
				FROM "core"."scraping_export_gradesrc_rows"
				GROUP BY scraping_export_run_id
			),
			rows_json AS (
				SELECT
					r.scraping_export_run_id,
					jsonb_agg(
						jsonb_build_object(
							'section_code', r.section_code,
							'student_code', r.student_code,
							'grade_type_code', r.grade_type_code,
							'grade_type_percentage', r.grade_type_percentage,
							'grade', r.grade,
							'qualification_status_code', r.qualification_status_code,
							'academic_period', r.academic_period,
							'course_code', r.course_code,
							'course_name', r.course_name,
							'student_name', r.student_name,
							'career_code', r.career_code,
							'grade_type_name', r.grade_type_name,
							'qualification_status_name', r.qualification_status_name,
							'source', r.source,
							'scraped_at', r.scraped_at,
							'observations', r.observations,
							'has_observations', r.has_observations
						)
						ORDER BY r.id
					) AS rows_data
				FROM "core"."scraping_export_gradesrc_rows" r
				JOIN latest_batch lb
					ON lb.scraping_export_run_id = r.scraping_export_run_id
					AND lb.generated_at = r.generated_at
				GROUP BY r.scraping_export_run_id
			)
			UPDATE "core"."scraping_export_runs" run
			SET rows_data = rj.rows_data
			FROM rows_json rj
			WHERE run.id = rj.scraping_export_run_id
				AND run.rows_data IS NULL
				AND run.status = 'completed'
		`);

		await queryRunner.query(`DROP TABLE IF EXISTS "core"."scraping_export_gradesrc_rows"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Symmetric with up()'s backfill: a run whose rowsData up() populated from this table should
		// not silently keep serving that content once the table (and the invariant that rowsData
		// mirrors it) is gone again -- otherwise a later re-run of up() would see rows_data already
		// non-null and skip re-backfilling a run that may since have changed under the recreated
		// table. Every export type already tolerates a null rowsData (self-heals on regenerate).
		await queryRunner.query(`
			UPDATE "core"."scraping_export_runs"
			SET rows_data = NULL
			WHERE export_type = 'gradesRc'
		`);

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
			CREATE INDEX "IDX_scraping_export_gradesrc_rows_run_generated_observations"
			ON "core"."scraping_export_gradesrc_rows"
			("scraping_export_run_id", "generated_at", "has_observations", "id")
		`);
	}
}
