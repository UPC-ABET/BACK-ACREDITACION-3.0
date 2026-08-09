import { Injectable, Logger } from '@nestjs/common';
import { BadRequestError } from 'src/commons/domain-error';
import { EncryptService } from 'src/libs/encrypt.service';
import { ScraperCredentialRepository } from '../core/scraper-credentials.repository';
import {
	SaveScraperCredentialInput,
	ScraperCredentialValidation,
} from '../core/scraper-credentials.validation';
import { scraperCredentialsValidationStrings } from '../config/strings/scraper-credentials.validation';
import { ScraperProviderCode } from '../constants/scraper-provider-codes';
import {
	DecryptedScraperCredential,
	ScraperCredentialSummary,
} from '../model/scraper-credentials.dtos';

@Injectable()
export class ScraperCredentialService {
	private readonly logger = new Logger(ScraperCredentialService.name);

	constructor(
		private readonly repository: ScraperCredentialRepository,
		private readonly encryptService: EncryptService,
	) {}

	async save(input: SaveScraperCredentialInput): Promise<void> {
		ScraperCredentialValidation.validateSave(input);

		await this.repository.upsertForProvider(
			input.providerCode,
			input.username.trim(),
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
		} catch {
			this.logger.error(
				`Stored ${providerCode} credential could not be decrypted; APP_SECRET may have changed`,
			);
			throw new BadRequestError(scraperCredentialsValidationStrings.error.decryptionFailed);
		}
	}
}
