import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EntityManager } from 'typeorm';
import { BaseService } from 'src/commons/base.service';
import { EncryptService } from 'src/libs/encrypt.service';
import { ApiTokenRepository } from 'src/modules/admin/iam/api-tokens/core/api-tokens.repository';
import { IntegrationKeyRepository } from '../core/integration-keys.repository';
import { IntegrationKeyValidation } from '../core/integration-keys.validation';
import {
	IntegrationKeySummaryDto,
	IssueIntegrationKeyDto,
	IssuedIntegrationKeyDto,
} from '../model/integration-keys.dtos';

const INTEGRATION_KEY_BYTES = 32;

@Injectable()
export class IntegrationKeyService extends BaseService<IntegrationKeyRepository> {
	constructor(
		protected readonly repository: IntegrationKeyRepository,
		private readonly apiTokenRepository: ApiTokenRepository,
		private readonly encryptService: EncryptService,
	) {
		super(repository);
	}

	async issue(
		dto: IssueIntegrationKeyDto,
		issuedByUserId: number,
		manager?: EntityManager,
	): Promise<IssuedIntegrationKeyDto> {
		await IntegrationKeyValidation.validateIssue(
			this.apiTokenRepository,
			this.repository,
			dto.apiTokenId,
		);

		const key = randomBytes(INTEGRATION_KEY_BYTES).toString('hex');
		const created = await this.repository.create(
			{
				apiTokenId: dto.apiTokenId,
				keyEncrypted: this.encryptService.encrypt(key),
				issuedByUserId,
			},
			manager,
		);

		const entity: Record<string, any> = { ...created };
		delete entity.keyEncrypted;

		return { ...entity, key } as IssuedIntegrationKeyDto; // abet-allow-secret: one-time issuance response
	}

	async rotate(
		apiTokenId: number,
		issuedByUserId: number,
		manager?: EntityManager,
	): Promise<IssuedIntegrationKeyDto> {
		await IntegrationKeyValidation.validateRotate(
			this.apiTokenRepository,
			this.repository,
			apiTokenId,
		);

		const key = randomBytes(INTEGRATION_KEY_BYTES).toString('hex');
		const updated = await this.repository.rotateForApiToken(
			apiTokenId,
			this.encryptService.encrypt(key),
			issuedByUserId,
			manager,
		);

		const entity: Record<string, any> = { ...updated };
		delete entity.keyEncrypted;

		return { ...entity, key } as IssuedIntegrationKeyDto; // abet-allow-secret: one-time rotation response
	}

	async getByApiToken(apiTokenId: number): Promise<IntegrationKeySummaryDto | null> {
		return await this.repository.findByApiTokenId(apiTokenId);
	}
}
