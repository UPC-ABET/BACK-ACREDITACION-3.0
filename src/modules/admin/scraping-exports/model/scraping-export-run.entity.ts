import { Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	DateColumn,
	JsonColumn,
	TextMediumColumn,
	TextShortColumn,
} from 'src/commons/configs/db.configs';
import type { ScrapingExportGenerationStatus, ScrapingExportType } from './scraping-exports.types';

/**
 * Persisted generation state for one (exportType, period) scraping export. Replaces rebuilding
 * the export on every download: a row here holds the last fetched, language-neutral data plus its
 * status, so `status`/`download`/`regenerate` can serve from storage instead of always running the
 * underlying export query synchronously. Language selection is applied only when a file is
 * rendered for download — see ADR-003, which supersedes ADR-002's per-language file storage.
 *
 * `sourceBannerRunId`/`sourcePlannerRunId` are plain text, not `@JoinColumn` FKs: the runs they
 * reference live on the separate `raw`/`planner-raw` datasource connections, and Postgres cannot
 * enforce a foreign key across two different database connections.
 */
@Entity({ name: 'scraping_export_runs', schema: 'core' })
@Unique('UQ_scraping_export_runs_export_type_period', ['exportType', 'period'])
export class ScrapingExportRunEntity extends BaseEntity {
	@PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_scraping_export_runs' })
	declare id: number;

	// %% ATTRIBUTES

	@TextShortColumn({ nullable: false })
	exportType: ScrapingExportType;

	@TextShortColumn({ nullable: false })
	period: string;

	@TextShortColumn({ nullable: false })
	status: ScrapingExportGenerationStatus;

	// Language-neutral row data for all five export types, rendered into a specific language's
	// .xlsx only at download time (see ADR-003, ADR-004). `any[]`, not `unknown[]`, mirrors
	// BaseEntity.extra's own `any` — TypeORM's DeepPartial upsert typing cannot resolve a jsonb
	// array column typed any more strictly than that.
	@JsonColumn({ nullable: true, withDefault: false })
	rowsData: any[] | null;

	@TextMediumColumn({ withDefault: false })
	errorMessage: string | null;

	@TextShortColumn({ withDefault: false })
	sourceBannerRunId: string | null;

	@TextShortColumn({ withDefault: false })
	sourcePlannerRunId: string | null;

	@TextShortColumn({ nullable: false })
	triggeredBy: string;

	@DateColumn({ withDefault: false })
	startedAt: Date | null;

	@DateColumn({ withDefault: false })
	finishedAt: Date | null;

	// %% RELATIONS
}
