import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { PortfolioSsoConfigEntity } from '../model/portfolio-sso-config.entity';

/**
 * Single-row table by convention: this repository always reads/writes the first row of
 * `core.portfolio_sso_config`, never scoping by `id`.
 */
export class PortfolioSsoConfigRepository extends BaseRepository<PortfolioSsoConfigEntity> {
	constructor(
		@InjectRepository(PortfolioSsoConfigEntity)
		repository: Repository<PortfolioSsoConfigEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/** Never selects `apiKeyEncrypted` (`select: false` on the column) — safe for summary reads. */
	async getConfig(): Promise<PortfolioSsoConfigEntity | null> {
		return await this.repository
			.createQueryBuilder('config')
			.orderBy('config.id', 'ASC')
			.limit(1)
			.getOne();
	}

	/** The one read path that names `apiKeyEncrypted` explicitly — consumed only when signing a link. */
	async getConfigWithSecret(): Promise<PortfolioSsoConfigEntity | null> {
		return await this.repository
			.createQueryBuilder('config')
			.addSelect('config.apiKeyEncrypted')
			.orderBy('config.id', 'ASC')
			.limit(1)
			.getOne();
	}

	async upsertSingleton(
		baseUrl: string,
		apiKeyEncrypted: string,
	): Promise<PortfolioSsoConfigEntity> {
		const existing = await this.getConfig();

		if (existing) {
			await this.repository.update(existing.id, { baseUrl, apiKeyEncrypted });
			return (await this.repository.findOne({
				where: { id: existing.id },
			})) as PortfolioSsoConfigEntity;
		}

		const created = this.repository.create({ baseUrl, apiKeyEncrypted });
		return await this.repository.save(created);
	}
}
