import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { GradeRcExportRow } from '../model/scraping-exports.types';
import { ScrapingExportGradesRcRowEntity } from '../model/scraping-export-gradesrc-row.entity';

// Rows inserted per statement. Small enough to keep one INSERT's payload bounded, large enough
// that a full period is tens of round trips rather than thousands — mirrors GRADES_RC_PAGE_SIZE's
// reasoning in GradesRcExportRepository.
const INSERT_BATCH_SIZE = 1000;
const READ_PAGE_SIZE = 5000;

/**
 * Durable storage for one materialized gradesRc merge, replacing the session-scoped TEMP table
 * `GradesRcExportRepository.openGradesRcExport` used to hold the same data. See ADR-003.
 */
@Injectable()
export class ScrapingExportGradesRcRowRepository {
	constructor(
		@InjectRepository(ScrapingExportGradesRcRowEntity)
		private readonly repository: Repository<ScrapingExportGradesRcRowEntity>,
	) {}

	async insertBatch(
		scrapingExportRunId: number,
		generatedAt: Date,
		rows: Array<GradeRcExportRow & { hasObservations: boolean }>,
	): Promise<void> {
		for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
			const chunk = rows.slice(offset, offset + INSERT_BATCH_SIZE).map((row) => ({
				scrapingExportRunId,
				generatedAt,
				...row,
			}));
			await this.repository.insert(chunk);
		}
	}

	// Keyset-paginated read, mirrors GradesRcExportRepository.readGradesRcPages's cursor shape.
	async readPage(
		scrapingExportRunId: number,
		hasObservations: boolean,
		afterId: number,
		limit: number = READ_PAGE_SIZE,
	): Promise<Array<GradeRcExportRow & { id: number }>> {
		return await this.repository.find({
			where: {
				scrapingExportRunId,
				hasObservations,
				...(afterId > 0 ? { id: MoreThan(afterId) } : {}),
			},
			order: { id: 'ASC' },
			take: limit,
		});
	}

	// Existence check for `download`'s "has this ever completed" gate — cheaper than paging both
	// halves, and correct regardless of which half (or both) happens to hold rows.
	async hasRows(scrapingExportRunId: number): Promise<boolean> {
		const count = await this.repository.count({ where: { scrapingExportRunId }, take: 1 });
		return count > 0;
	}

	async deleteStaleBatches(scrapingExportRunId: number, keepGeneratedAt: Date): Promise<void> {
		await this.repository
			.createQueryBuilder()
			.delete()
			.where('scraping_export_run_id = :scrapingExportRunId', { scrapingExportRunId })
			.andWhere('generated_at <> :keepGeneratedAt', { keepGeneratedAt })
			.execute();
	}
}
