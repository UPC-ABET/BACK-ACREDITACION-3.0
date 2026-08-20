import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { sharedStrings } from 'src/shared/strings/shared.strings';
import { ScrapingExportRunEntity } from '../model/scraping-export-run.entity';
import { ScrapingExportType } from '../model/scraping-exports.types';

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
		periodo: string,
		lang: string,
	): Promise<ScrapingExportRunEntity | null> {
		return await this.repository.findOne({ where: { exportType, periodo, lang } });
	}

	/**
	 * A single `upsert` rather than find-then-write: two concurrent triggers for the same key
	 * (e.g. a completed scrape racing a manual regenerate) would both see no row and race into a
	 * 23505 on `UQ_scraping_export_runs_export_type_periodo_lang`. Mirrors
	 * `ScraperCredentialRepository.upsertForProvider`'s use of `repository.upsert`.
	 */
	async upsertByKey(
		exportType: ScrapingExportType,
		periodo: string,
		lang: string,
		patch: DeepPartial<ScrapingExportRunEntity>,
	): Promise<ScrapingExportRunEntity> {
		await this.repository.upsert(
			{ exportType, periodo, lang, ...patch },
			{ conflictPaths: ['exportType', 'periodo', 'lang'] },
		);

		const entity = await this.findByKey(exportType, periodo, lang);
		if (!entity) {
			throw new NotFoundException(sharedStrings.error.notFound);
		}
		return entity;
	}
}
