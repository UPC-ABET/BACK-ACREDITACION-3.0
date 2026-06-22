import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlannerScrapeRunEntity, PlannerScrapeRunStatus } from '../model/planner-scrape-run.entity';

export interface CreatePlannerScrapeRunData {
	id: string;
	periodo: string;
	escuela: string | null;
	triggeredBy: string | null;
}

@Injectable()
export class PlannerScrapeRunRepository {
	constructor(
		@InjectRepository(PlannerScrapeRunEntity, 'planner-raw')
		private readonly repository: Repository<PlannerScrapeRunEntity>,
	) {}

	async createRun(data: CreatePlannerScrapeRunData): Promise<PlannerScrapeRunEntity> {
		const entity = this.repository.create({
			...data,
			status: 'running',
			startedAt: new Date(),
		});
		return await this.repository.save(entity);
	}

	async finish(id: string, status: PlannerScrapeRunStatus, stats: object): Promise<void> {
		await this.repository.update(id, { status, stats, finishedAt: new Date() });
	}

	async findById(id: string): Promise<PlannerScrapeRunEntity | null> {
		return await this.repository.findOne({ where: { id } });
	}

	async findByPeriodo(periodo: string): Promise<PlannerScrapeRunEntity[]> {
		return await this.repository.find({
			where: { periodo },
			order: { startedAt: 'DESC' },
		});
	}
}
