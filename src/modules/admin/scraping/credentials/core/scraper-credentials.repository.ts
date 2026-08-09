import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ScraperCredentialEntity } from '../model/scraper-credentials.entity';
import { ScraperProviderCode } from '../constants/scraper-provider-codes';

export class ScraperCredentialRepository extends BaseRepository<ScraperCredentialEntity> {
	constructor(
		@InjectRepository(ScraperCredentialEntity)
		repository: Repository<ScraperCredentialEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByProvider(providerCode: ScraperProviderCode): Promise<ScraperCredentialEntity | null> {
		return await this.repository.findOne({ where: { providerCode, isActive: true } });
	}

	/**
	 * `passwordEncrypted` is `select: false`, so it only comes back when named explicitly. This is
	 * the single place that does so — every other read is safe by construction.
	 */
	async findByProviderWithPassword(
		providerCode: ScraperProviderCode,
	): Promise<ScraperCredentialEntity | null> {
		return await this.repository.findOne({
			where: { providerCode, isActive: true },
			select: {
				id: true,
				providerCode: true,
				username: true,
				passwordEncrypted: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	/**
	 * A single statement rather than find-then-write: two concurrent first-time saves would both
	 * see no row and race into a 23505 on `UQ_scraper_credentials_provider_code`.
	 *
	 * `updatedAt` is set explicitly — `BaseEntity` declares it with `@DateColumn`, not
	 * `@UpdateDateColumn`, and no trigger maintains it, so nothing else would ever populate it.
	 */
	async upsertForProvider(
		providerCode: ScraperProviderCode,
		username: string,
		passwordEncrypted: string,
	): Promise<void> {
		await this.repository.upsert(
			{ providerCode, username, passwordEncrypted, isActive: true, updatedAt: new Date() },
			{ conflictPaths: ['providerCode'] },
		);
	}
}
