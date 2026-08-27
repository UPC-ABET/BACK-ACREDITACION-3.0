import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { IntegrationKeyEntity } from '../model/integration-key.entity';

export class IntegrationKeyRepository extends BaseRepository<IntegrationKeyEntity> {
	constructor(
		@InjectRepository(IntegrationKeyEntity)
		repository: Repository<IntegrationKeyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByApiTokenId(apiTokenId: number): Promise<IntegrationKeyEntity | null> {
		return await this.repository.findOne({ where: { apiTokenId } });
	}

	/** The one read path that names `keyEncrypted` explicitly — consumed only by ResponseEncryptionService. */
	async findByApiTokenIdWithKey(apiTokenId: number): Promise<IntegrationKeyEntity | null> {
		return await this.repository.findOne({
			where: { apiTokenId },
			select: {
				id: true,
				apiTokenId: true,
				keyEncrypted: true,
				issuedByUserId: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	async rotateForApiToken(
		apiTokenId: number,
		keyEncrypted: string,
		issuedByUserId: number,
		manager?: EntityManager,
	): Promise<IntegrationKeyEntity> {
		const repository = this.resolveRepository(manager);
		await repository.update(
			{ apiTokenId },
			{ keyEncrypted, issuedByUserId, updatedAt: new Date() },
		);
		return (await repository.findOne({ where: { apiTokenId } })) as IntegrationKeyEntity;
	}
}
