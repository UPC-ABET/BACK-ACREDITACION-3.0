import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PortfolioProjectApplicationEntity } from '../model/portfolio-project-application.entity';

@Injectable()
export class PortfolioProjectApplicationRepository extends BaseRepository<PortfolioProjectApplicationEntity> {
	constructor(
		@InjectRepository(PortfolioProjectApplicationEntity)
		private readonly applicationRepo: Repository<PortfolioProjectApplicationEntity>,
		dataSource: DataSource,
	) {
		super(applicationRepo, dataSource);
	}

	async existsByProject(projectId: number): Promise<boolean> {
		return this.applicationRepo.exists({ where: { projectId } });
	}

	async findByProject(projectId: number): Promise<PortfolioProjectApplicationEntity[]> {
		return this.applicationRepo.find({
			where: { projectId },
			relations: ['student'],
		});
	}
}
