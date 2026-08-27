import { BadRequestError } from 'src/commons/domain-error';
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from 'src/shared/constants/permission-modules';
import { apiTokensValidationStrings } from '../config/strings/api-tokens.validation';
import type { ApiTokenEntity } from '../model/api-token.entity';

const KNOWN_MODULES = Object.values(PERMISSION_MODULES) as string[];
const KNOWN_ACTIONS = Object.values(PERMISSION_ACTIONS) as string[];

export class ApiTokenValidation {
	/**
	 * Belt-and-suspenders re-check on top of the DTO-level `@IsIn` (AC-8): the primary gate is the
	 * global `ValidationPipe`, this defends the invariant even if a caller bypasses the DTO layer.
	 */
	static validateCreate(data: { scopes: Array<{ module: string; action: string }> }): void {
		const errors: string[] = [];

		if (!Array.isArray(data.scopes) || data.scopes.length === 0) {
			errors.push(apiTokensValidationStrings.error.emptyScopes);
		} else {
			const hasUnknownScope = data.scopes.some(
				(scope) =>
					!KNOWN_MODULES.includes(String(scope?.module).toUpperCase()) ||
					!KNOWN_ACTIONS.includes(String(scope?.action).toUpperCase()),
			);
			if (hasUnknownScope) {
				errors.push(apiTokensValidationStrings.error.unknownModuleOrAction);
			}
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: apiTokensValidationStrings.result.createFailed,
				errors,
			});
		}
	}

	/** Revoke of a missing or already-revoked token is rejected with no partial effect. */
	static validateRevoke(entity: ApiTokenEntity | null): void {
		if (!entity) {
			throw new BadRequestError({
				message: apiTokensValidationStrings.result.deleteFailed,
				errors: [apiTokensValidationStrings.error.notFound],
			});
		}

		if (entity.isActive === false) {
			throw new BadRequestError({
				message: apiTokensValidationStrings.result.deleteFailed,
				errors: [apiTokensValidationStrings.error.alreadyRevoked],
			});
		}
	}
}
