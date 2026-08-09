import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ScraperCredentialEntity } from '../model/scraper-credential.entity';
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

	async upsertForProvider(
		providerCode: ScraperProviderCode,
		username: string,
		passwordEncrypted: string,
	): Promise<ScraperCredentialEntity> {
		const existing = await this.repository.findOne({ where: { providerCode } });

		if (existing) {
			await this.repository.update(existing.id, { username, passwordEncrypted, isActive: true });
			return (await this.repository.findOne({ where: { id: existing.id } }))!;
		}

		return await this.repository.save(
			this.repository.create({ providerCode, username, passwordEncrypted }),
		);
	}
}
