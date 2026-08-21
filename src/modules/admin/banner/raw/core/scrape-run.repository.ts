import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ScraperPhase, ScrapeRunEntity, ScrapeRunStatus } from '../model/scrape-run.entity';

export interface CreateScrapeRunData {
	id: string;
	level: string;
	period: string;
	departments: string[];
	triggeredBy: string | null;
}

@Injectable()
export class ScrapeRunRepository {
	constructor(
		@InjectRepository(ScrapeRunEntity, 'raw')
		private readonly repository: Repository<ScrapeRunEntity>,
	) {}

	async createRun(data: CreateScrapeRunData): Promise<ScrapeRunEntity> {
		const entity = this.repository.create({
			...data,
			status: 'running',
			startedAt: new Date(),
		});
		return await this.repository.save(entity);
	}

	async finish(id: string, status: ScrapeRunStatus, stats: object): Promise<void> {
		await this.repository.update(id, { status, stats, finishedAt: new Date(), phase: null });
	}

	async updatePhase(id: string, phase: ScraperPhase): Promise<void> {
		await this.repository.update(id, { phase });
	}

	async findById(id: string): Promise<ScrapeRunEntity | null> {
		return await this.repository.findOne({ where: { id } });
	}

	async findByPeriod(period: string): Promise<ScrapeRunEntity[]> {
		return await this.repository.find({
			where: { period },
			order: { startedAt: 'DESC' },
		});
	}

	async deleteRun(id: string): Promise<void> {
		await this.repository.delete(id);
	}

	async deleteOtherRunsForPeriod(period: string, keepRunId: string): Promise<void> {
		await this.repository.delete({ period, id: Not(keepRunId) });
	}
}
