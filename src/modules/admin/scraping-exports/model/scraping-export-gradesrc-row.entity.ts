import { Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	BooleanColumn,
	DateColumn,
	IntegerFKIDColumn,
	JsonColumn,
	TextMediumColumn,
	TextShortColumn,
} from 'src/commons/configs/db.configs';
import { ScrapingExportRunEntity } from './scraping-export-run.entity';

/**
 * One row per graded line of a materialized gradesRc merge, replacing the session-scoped TEMP
 * table `openGradesRcExport` used to build the workbook directly. Both this table and
 * `scraping_export_runs` live on the main datasource, so `scrapingExportRunId` is a real FK
 * (unlike `sourceBannerRunId`/`sourcePlannerRunId` on the parent, which reference the separate raw
 * datasource). See ADR-003.
 *
 * `generatedAt` tags which completed generation's batch a row belongs to: a regenerate inserts a
 * new batch of rows alongside the previous one still being served by `download`, and the previous
 * batch is deleted only once the new one is confirmed complete — never before. This preserves the
 * "serve stale while regenerating" behavior from `openspec/specs/scrape-retention-and-cached-exports`.
 */
@Entity({ name: 'scraping_export_gradesrc_rows', schema: 'core' })
// Covers readPage's WHERE (run id, generated_at, has_observations) + ORDER BY id in one index
// scan; a leading-column-only index on scrapingExportRunId would be redundant with this one, so
// there is deliberately no separate single-column index on it.
@Index('IDX_scraping_export_gradesrc_rows_run_generated_observations', [
	'scrapingExportRunId',
	'generatedAt',
	'hasObservations',
	'id',
])
export class ScrapingExportGradesRcRowEntity extends BaseEntity {
	@PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_scraping_export_gradesrc_rows' })
	declare id: number;

	// %% ATTRIBUTES

	@IntegerFKIDColumn()
	scrapingExportRunId: number;

	@DateColumn({ withDefault: false, nullable: false })
	generatedAt: Date;

	@TextShortColumn({ nullable: false })
	sectionCode: string;

	@TextShortColumn({ nullable: false })
	studentCode: string;

	@TextShortColumn({ nullable: false })
	gradeTypeCode: string;

	@TextShortColumn({ nullable: false })
	gradeTypePercentage: string;

	@TextShortColumn({ nullable: false })
	grade: string;

	@TextShortColumn({ nullable: false })
	qualificationStatusCode: string;

	@TextShortColumn({ nullable: false })
	academicPeriod: string;

	@TextShortColumn({ nullable: false })
	courseCode: string;

	@TextMediumColumn({ nullable: false })
	courseName: string;

	@TextMediumColumn({ nullable: false })
	studentName: string;

	@TextShortColumn({ withDefault: true })
	careerCode: string;

	@TextMediumColumn({ nullable: false })
	gradeTypeName: string;

	@TextMediumColumn({ nullable: false })
	qualificationStatusName: string;

	@TextShortColumn({ nullable: false })
	source: string;

	@TextShortColumn({ nullable: false })
	scrapedAt: string;

	// GRADE_RC_OBSERVATIONS codes — a small jsonb array of plain strings. `default: () => "'[]'"`,
	// not `withDefault: true` (which resolves to `'{}'`, an object) — matches the array-column
	// convention elsewhere in the codebase (e.g. NotificationConfigEntity, NotificationLogEntity).
	@JsonColumn({ nullable: false, default: () => "'[]'" })
	observations: string[];

	// Precomputed from `observations.length > 0`, so the download-time two-sheet split is an
	// indexed WHERE instead of a jsonb array-length scan. Indexed only as part of the composite
	// index above, not on its own — no query filters on this column without also scoping by run id.
	@BooleanColumn({ withDefault: false, nullable: false })
	hasObservations: boolean;

	// %% RELATIONS

	@ManyToOne(() => ScrapingExportRunEntity, { onDelete: 'CASCADE' })
	@JoinColumn({
		name: 'scraping_export_run_id',
		foreignKeyConstraintName: 'FK_scraping_export_gradesrc_rows_scraping_export_run_id',
	})
	scrapingExportRun: ScrapingExportRunEntity;
}
