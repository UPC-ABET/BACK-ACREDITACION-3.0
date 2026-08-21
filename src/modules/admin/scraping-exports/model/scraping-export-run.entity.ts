import { Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseEntity } from 'src/commons/base.entity';
import {
	BinaryColumn,
	DateColumn,
	TextMediumColumn,
	TextShortColumn,
} from 'src/commons/configs/db.configs';
import type { ScrapingExportGenerationStatus, ScrapingExportType } from './scraping-exports.types';

/**
 * Persisted generation state for one (exportType, periodo, lang) scraping export. Replaces
 * rebuilding the export on every download: a row here holds the last generated file plus its
 * status, so `status`/`download`/`regenerate` can serve from storage instead of always running
 * the underlying export query synchronously. See ADR-002.
 *
 * `sourceBannerRunId`/`sourcePlannerRunId` are plain text, not `@JoinColumn` FKs: the runs they
 * reference live on the separate `raw`/`planner-raw` datasource connections, and Postgres cannot
 * enforce a foreign key across two different database connections.
 */
@Entity({ name: 'scraping_export_runs', schema: 'core' })
@Unique('UQ_scraping_export_runs_export_type_periodo_lang', ['exportType', 'periodo', 'lang'])
export class ScrapingExportRunEntity extends BaseEntity {
	@PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_scraping_export_runs' })
	declare id: number;

	// %% ATTRIBUTES

	@TextShortColumn({ nullable: false })
	exportType: ScrapingExportType;

	@TextShortColumn({ nullable: false })
	periodo: string;

	@TextShortColumn({ nullable: false })
	lang: string;

	@TextShortColumn({ nullable: false })
	status: ScrapingExportGenerationStatus;

	@TextShortColumn({ withDefault: false })
	fileName: string | null;

	@BinaryColumn()
	fileBytes: Buffer | null;

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
