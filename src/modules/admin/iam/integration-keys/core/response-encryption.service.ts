import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EncryptService } from 'src/libs/encrypt.service';
import { integrationKeysValidationStrings } from '../config/strings/integration-keys.validation';
import { IntegrationKeyRepository } from './integration-keys.repository';
import { encryptWithKey } from './response-encryption.functions';

@Injectable()
export class ResponseEncryptionService {
	constructor(
		private readonly repository: IntegrationKeyRepository,
		private readonly encryptService: EncryptService,
	) {}

	/**
	 * Encrypts `payload` with the calling integration's dedicated key. Throws when no key has been
	 * provisioned for `apiTokenId` — that is an admin misconfiguration (a route requires encryption
	 * but this integration was never issued a key), not something the caller can fix, so it fails
	 * closed with a 503 rather than ever returning the payload in plaintext.
	 */
	async encryptForApiToken(apiTokenId: number, payload: unknown): Promise<string> {
		const row = await this.repository.findByApiTokenIdWithKey(apiTokenId);
		if (!row) {
			throw new ServiceUnavailableException(
				integrationKeysValidationStrings.error.noKeyProvisioned,
			);
		}

		const keyMaterial = this.encryptService.decrypt(row.keyEncrypted);
		return encryptWithKey(Buffer.from(keyMaterial, 'hex'), JSON.stringify(payload));
	}
}
