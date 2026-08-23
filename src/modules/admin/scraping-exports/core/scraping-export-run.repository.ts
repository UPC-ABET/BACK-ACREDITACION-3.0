import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { sharedStrings } from 'src/shared/strings/shared.strings';
import { ScrapingExportRunEntity } from '../model/scraping-export-run.entity';
import { ScrapingExportType } from '../model/scraping-exports.types';

// Every field callers that only care about generation status/progress ever read -- deliberately
// excludes `rowsData`. `gradesRc` can hold tens of thousands of rows in that jsonb column, and a
// plain `findOne`/`upsert`-then-read pulls and (de)serializes it in full regardless of column
// selection unless explicitly excluded -- see findStatusByKey below.
//
// A single source of truth: STATUS_FIELDS drives both the `select` array `findStatusByKey` sends
// to TypeORM and the type callers see, so the two cannot drift apart the way two independently
// maintained lists could (a field added to one but not the other would otherwise compile cleanly
// and silently read back `undefined` at runtime).
export const STATUS_FIELDS = [
	'exportType',
	'period',
	'status',
	'errorMessage',
	'triggeredBy',
	'startedAt',
	'finishedAt',
	'updatedAt',
] as const satisfies ReadonlyArray<keyof ScrapingExportRunEntity>;

export type ScrapingExportRunStatusFields = Pick<
	ScrapingExportRunEntity,
	(typeof STATUS_FIELDS)[number]
>;

export class ScrapingExportRunRepository extends BaseRepository<ScrapingExportRunEntity> {
	constructor(
		@InjectRepository(ScrapingExportRunEntity)
		repository: Repository<ScrapingExportRunEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByKey(
		exportType: ScrapingExportType,
		period: string,
	): Promise<ScrapingExportRunEntity | null> {
		return await this.repository.findOne({ where: { exportType, period } });
	}

	// Same lookup as findByKey, but excludes `rowsData`. For callers (status polling, generation
	// claims) that never read it -- see docs/CONTEXT.md's 640MB container ceiling and ADR-004's
	// accepted gradesRc storage risk.
	async findStatusByKey(
		exportType: ScrapingExportType,
		period: string,
	): Promise<ScrapingExportRunStatusFields | null> {
		return await this.repository.findOne({
			where: { exportType, period },
			select: [...STATUS_FIELDS],
		});
	}

	/**
	 * A single `upsert` rather than find-then-write: two concurrent triggers for the same key
	 * (e.g. a completed scrape racing a manual regenerate) would both see no row and race into a
	 * 23505 on `UQ_scraping_export_runs_export_type_period`. Mirrors
	 * `ScraperCredentialRepository.upsertForProvider`'s use of `repository.upsert`.
	 */
	async upsertByKey(
		exportType: ScrapingExportType,
		period: string,
		patch: DeepPartial<ScrapingExportRunEntity>,
	): Promise<ScrapingExportRunEntity> {
		await this.doUpsert(exportType, period, patch);

		const entity = await this.findByKey(exportType, period);
		if (!entity) {
			throw new NotFoundException(sharedStrings.error.notFound);
		}
		return entity;
	}

	// Same write as upsertByKey, but skips the read-back entirely -- for callers that never use
	// the returned entity (writing a terminal 'completed'/'failed' state at the end of
	// generation). Avoids re-fetching and re-camelizing a potentially large `rowsData` array
	// purely to discard it.
	async upsertByKeyNoReturn(
		exportType: ScrapingExportType,
		period: string,
		patch: DeepPartial<ScrapingExportRunEntity>,
	): Promise<void> {
		await this.doUpsert(exportType, period, patch);
	}

	private async doUpsert(
		exportType: ScrapingExportType,
		period: string,
		patch: DeepPartial<ScrapingExportRunEntity>,
	): Promise<void> {
		await this.repository.upsert(
			{ exportType, period, ...patch },
			{ conflictPaths: ['exportType', 'period'] },
		);
	}
}
