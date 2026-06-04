import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PortfolioResearchLineEntity } from '../model/portfolio-research-line.entity';

@Injectable()
export class PortfolioResearchLineRepository extends BaseRepository<PortfolioResearchLineEntity> {
	constructor(
		@InjectRepository(PortfolioResearchLineEntity)
		private readonly researchLineRepo: Repository<PortfolioResearchLineEntity>,
		dataSource: DataSource,
	) {
		super(researchLineRepo, dataSource);
	}

	async findByNameAndProgramAndModality(
		name: string,
		programId: number,
		modalityTypeId: number,
	): Promise<PortfolioResearchLineEntity | null> {
		return this.researchLineRepo.findOne({ where: { name, programId, modalityTypeId } });
	}
}
