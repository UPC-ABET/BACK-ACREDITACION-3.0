import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import type { ApiTokenRepository } from 'src/modules/admin/iam/api-tokens/core/api-tokens.repository';
import { integrationKeysValidationStrings } from '../config/strings/integration-keys.validation';
import type { IntegrationKeyRepository } from './integration-keys.repository';

export class IntegrationKeyValidation {
	static async validateIssue(
		apiTokenRepository: ApiTokenRepository,
		repository: IntegrationKeyRepository,
		apiTokenId: number,
	): Promise<void> {
		const token = await apiTokenRepository.findOneById(apiTokenId);
		if (!token || token.isActive === false) {
			throw new BadRequestError({
				message: integrationKeysValidationStrings.result.issueFailed,
				errors: [integrationKeysValidationStrings.error.apiTokenNotFound],
			});
		}

		if (await repository.findByApiTokenId(apiTokenId)) {
			throw new ConflictError({
				message: integrationKeysValidationStrings.result.issueFailed,
				errors: [integrationKeysValidationStrings.error.alreadyIssued],
			});
		}
	}

	static async validateRotate(
		apiTokenRepository: ApiTokenRepository,
		repository: IntegrationKeyRepository,
		apiTokenId: number,
	): Promise<void> {
		const token = await apiTokenRepository.findOneById(apiTokenId);
		if (!token || token.isActive === false) {
			throw new BadRequestError({
				message: integrationKeysValidationStrings.result.rotateFailed,
				errors: [integrationKeysValidationStrings.error.apiTokenNotFound],
			});
		}

		if (!(await repository.findByApiTokenId(apiTokenId))) {
			throw new NotFoundError({
				message: integrationKeysValidationStrings.result.rotateFailed,
				errors: [integrationKeysValidationStrings.error.notProvisioned],
			});
		}
	}
}
