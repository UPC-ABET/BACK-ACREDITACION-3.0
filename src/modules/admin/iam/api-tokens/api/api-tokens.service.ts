import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { EntityManager } from 'typeorm';
import { generateApiKeyMaterial, hashPassword } from 'src/libs/secure.functions';
import { ApiTokenRepository } from '../core/api-tokens.repository';
import { ApiTokenValidation } from '../core/api-tokens.validation';
import { CreateApiTokenDto, IssuedApiTokenDto, UpdateApiTokenDto } from '../model/api-tokens.dtos';

@Injectable()
export class ApiTokenService extends BaseService<ApiTokenRepository> {
	constructor(protected readonly repository: ApiTokenRepository) {
		super(repository);
	}

	/**
	 * Named `issue`, not `create`: the extra `createdByUserId` parameter (always the caller's
	 * `@CurrentUser().userId`, never the request body — AC-7) is incompatible with
	 * `BaseService.create`'s `(createDto, manager)` signature, so this does not override it.
	 * `createdByUserId` always comes from the caller argument, never from the request body — the
	 * DTO does not even declare the field. The plaintext secret is built here, never persisted, and
	 * appears on this response only, exactly once (AC-6).
	 */
	async issue(
		dto: CreateApiTokenDto,
		createdByUserId: number,
		manager?: EntityManager,
	): Promise<IssuedApiTokenDto> {
		ApiTokenValidation.validateCreate(dto);

		const { keyId, secret } = generateApiKeyMaterial();
		const secretHash = await hashPassword(secret);

		const created = await this.repository.create(
			{
				name: dto.name,
				keyId,
				secretHash,
				scopes: dto.scopes,
				expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
				createdByUserId,
			},
			manager,
		);

		const entity: Record<string, any> = { ...created };
		delete entity.secretHash;

		return {
			...entity,
			apiKey: `${keyId}.${secret}`, // abet-allow-secret: composing the one-time issuance response, not a hardcoded credential
		} as IssuedApiTokenDto;
	}

	async update(id: number, dto: UpdateApiTokenDto, manager?: EntityManager) {
		return await super.update(
			id,
			{
				...(dto.name !== undefined && { name: dto.name }),
				...(dto.expiresAt !== undefined && {
					expiresAt: dto.expiresAt === null ? null : new Date(dto.expiresAt),
				}),
			},
			manager,
		);
	}

	/**
	 * Named `revoke`, not `delete`: same signature-compatibility reason as `issue` above. A soft
	 * revoke, never `BaseService.delete`/`repository.remove`: the row must survive with
	 * `revokedAt`/`revokedByUserId` (AC-7), `BaseRepository.remove()` is a hard delete (D7).
	 */
	async revoke(id: number, revokedByUserId: number, manager?: EntityManager) {
		const entity = await this.repository.findOneById(id);
		ApiTokenValidation.validateRevoke(entity);

		return await this.repository.update(
			id,
			{
				isActive: false,
				revokedAt: new Date(),
				revokedByUserId,
			},
			manager,
		);
	}
}
