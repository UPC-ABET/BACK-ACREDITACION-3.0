import { Injectable } from '@nestjs/common';
import { UnauthorizedError } from 'src/commons/domain-error';
import { compareSecret } from 'src/libs/secure.functions';
import type { ApiTokenPrincipal } from 'src/modules/auth/model/authorization.types';
import { apiTokensValidationStrings } from '../config/strings/api-tokens.validation';
import { ApiTokenRepository } from './api-tokens.repository';
import type { ApiTokenEntity } from '../model/api-token.entity';

@Injectable()
export class ApiTokenAuthService {
	constructor(private readonly repository: ApiTokenRepository) {}

	/**
	 * The whole hot path (AC-11): exactly one candidate row loaded by `keyId`, at most one bcrypt
	 * comparison. Unknown/inactive/expired short-circuit before any bcrypt call; the wrong-secret
	 * case raises the exact same rejection (AC-5) so the two are indistinguishable to the caller.
	 */
	async resolve(keyId: string, secret: string): Promise<ApiTokenPrincipal> {
		const row = await this.repository.findAuthCandidateByKeyId(keyId);

		const invalid =
			!row ||
			row.isActive === false ||
			(row.expiresAt !== null &&
				row.expiresAt !== undefined &&
				row.expiresAt.getTime() <= Date.now());

		if (invalid) {
			throw new UnauthorizedError(apiTokensValidationStrings.error.invalidApiKey);
		}

		const secretMatches = await compareSecret(secret, row.secretHash);
		if (!secretMatches) {
			throw new UnauthorizedError(apiTokensValidationStrings.error.invalidApiKey);
		}

		return toPrincipal(row);
	}
}

/**
 * Groups `ApiTokenScope[]` into the `MachinePermission[]` shape `PermissionsGuard` already
 * iterates: `[{module:'ACADEMIC',action:'GET'},{module:'ACADEMIC',action:'POST'}]` becomes
 * `[{module:'ACADEMIC',permissions:['GET','POST']}]`.
 */
function toPrincipal(row: ApiTokenEntity): ApiTokenPrincipal {
	const byModule = new Map<string, string[]>();

	for (const scope of row.scopes ?? []) {
		const module = String(scope.module).toUpperCase();
		const action = String(scope.action).toUpperCase();
		const actions = byModule.get(module) ?? [];
		if (!actions.includes(action)) actions.push(action);
		byModule.set(module, actions);
	}

	return {
		apiTokenId: row.id,
		keyId: row.keyId,
		name: row.name,
		permissions: Array.from(byModule.entries()).map(([module, permissions]) => ({
			module,
			permissions,
		})),
	};
}
