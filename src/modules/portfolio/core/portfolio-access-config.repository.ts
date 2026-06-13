import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PortfolioAccessConfigEntity } from '../model/portfolio-access-config.entity';

@Injectable()
export class PortfolioAccessConfigRepository extends BaseRepository<PortfolioAccessConfigEntity> {
	constructor(
		@InjectRepository(PortfolioAccessConfigEntity)
		private readonly accessConfigRepo: Repository<PortfolioAccessConfigEntity>,
		dataSource: DataSource,
	) {
		super(accessConfigRepo, dataSource);
	}

	async findByUserId(userId: number): Promise<PortfolioAccessConfigEntity | null> {
		return this.accessConfigRepo.findOne({ where: { userId } });
	}

	async upsertForUser(
		userId: number,
		fullAccess: boolean,
		allowedPrefixes: string[],
	): Promise<PortfolioAccessConfigEntity> {
		const existing = await this.findByUserId(userId);

		if (existing) {
			await this.accessConfigRepo.update(existing.id, { fullAccess, allowedPrefixes });
			return this.accessConfigRepo.findOne({ where: { id: existing.id } });
		}

		const entity = this.accessConfigRepo.create({ userId, fullAccess, allowedPrefixes });
		return this.accessConfigRepo.save(entity);
	}
}
