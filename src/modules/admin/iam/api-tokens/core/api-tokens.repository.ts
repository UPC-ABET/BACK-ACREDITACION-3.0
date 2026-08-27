import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ApiTokenEntity } from '../model/api-token.entity';

export class ApiTokenRepository extends BaseRepository<ApiTokenEntity> {
	constructor(
		@InjectRepository(ApiTokenEntity)
		repository: Repository<ApiTokenEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/**
	 * The whole authentication hot path: a single indexed row read by `keyId`
	 * (`UQ_api_tokens_key_id`), explicitly selecting `secretHash` since the column declares
	 * `select: false` (AC-11).
	 */
	async findAuthCandidateByKeyId(keyId: string): Promise<ApiTokenEntity | null> {
		return await this.repository.findOne({
			where: { keyId },
			select: {
				id: true,
				keyId: true,
				name: true,
				secretHash: true,
				scopes: true,
				expiresAt: true,
				isActive: true,
			},
		});
	}
}
