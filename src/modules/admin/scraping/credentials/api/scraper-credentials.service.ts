import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { describeError } from 'src/libs/error.functions';
import { EncryptService } from 'src/libs/encrypt.service';
import { ScraperCredentialRepository } from '../core/scraper-credentials.repository';
import { ScraperCredentialValidation } from '../core/scraper-credentials.validation';
import { scraperCredentialsValidationStrings } from '../config/strings/scraper-credentials.validation';
import { ScraperProviderCode } from '../constants/scraper-provider-codes';
import {
	DecryptedScraperCredential,
	SaveScraperCredentialInput,
	ScraperCredentialSummary,
} from '../model/scraper-credentials.dtos';

@Injectable()
export class ScraperCredentialService {
	private readonly logger = new Logger(ScraperCredentialService.name);

	constructor(
		private readonly repository: ScraperCredentialRepository,
		private readonly encryptService: EncryptService,
	) {}

	/**
	 * The module's public pre-check, so a caller that must refuse bad input *before* doing expensive
	 * or irreversible work does not have to reach past this service into `core/` for the validation
	 * class. `save` applies it too, so the rule has one owner however it is entered.
	 */
	assertSavable(input: SaveScraperCredentialInput): void {
		ScraperCredentialValidation.validateSave(input);
	}

	/** `username` is stored verbatim — trim before calling, so the value validated is the value stored. */
	async save(input: SaveScraperCredentialInput): Promise<void> {
		this.assertSavable(input);

		await this.repository.upsertForProvider(
			input.providerCode,
			input.username,
			this.encryptService.encrypt(input.password),
		);
	}

	async getSummary(providerCode: ScraperProviderCode): Promise<ScraperCredentialSummary> {
		const credential = await this.repository.findByProvider(providerCode);

		if (!credential) return { username: null, configured: false, updatedAt: null };

		return {
			username: credential.username,
			configured: true,
			updatedAt: credential.updatedAt ?? null,
		};
	}

	async isConfigured(providerCode: ScraperProviderCode): Promise<boolean> {
		return (await this.repository.findByProvider(providerCode)) !== null;
	}

	/**
	 * A decryption failure is its own outcome, never "invalid credentials" — the usual cause is an
	 * `APP_SECRET` that changed or differs between environments, and reporting it as a rejected
	 * password sends the operator to re-enter one that was always correct.
	 */
	async getDecrypted(
		providerCode: ScraperProviderCode,
	): Promise<DecryptedScraperCredential | null> {
		const credential = await this.repository.findByProviderWithPassword(providerCode);
		if (!credential) return null;

		try {
			return {
				username: credential.username,
				password: this.encryptService.decrypt(credential.passwordEncrypted),
			};
		} catch (error) {
			// The cause separates a changed APP_SECRET from a malformed or truncated ciphertext —
			// otherwise the one log line sends an operator to rotate a key that was never the problem.
			this.logger.error(
				`Stored ${providerCode} credential could not be decrypted (APP_SECRET may have changed): ${describeError(error)}`,
			);
			// A server misconfiguration, not a malformed request — 400 would blame the caller.
			throw new ServiceUnavailableException(
				scraperCredentialsValidationStrings.error.decryptionFailed,
			);
		}
	}
}
