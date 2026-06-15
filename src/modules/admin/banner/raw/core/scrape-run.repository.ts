import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScrapeRunEntity, ScrapeRunStatus } from '../model/scrape-run.entity';

export interface CreateScrapeRunData {
	id: string;
	nivel: string;
	periodo: string;
	departamentos: string[];
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
		await this.repository.update(id, { status, stats, finishedAt: new Date() });
	}

	async findById(id: string): Promise<ScrapeRunEntity | null> {
		return await this.repository.findOne({ where: { id } });
	}
}
