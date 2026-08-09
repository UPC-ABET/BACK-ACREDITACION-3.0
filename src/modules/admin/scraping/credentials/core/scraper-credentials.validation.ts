import { BadRequestError } from 'src/commons/domain-error';
import { scraperCredentialsValidationStrings } from '../config/strings/scraper-credentials.validation';
import { SCRAPER_PROVIDER_CODE_VALUES } from '../constants/scraper-provider-codes';
import type { SaveScraperCredentialInput } from '../model/scraper-credentials.dtos';

export class ScraperCredentialValidation {
	static validateSave(data: SaveScraperCredentialInput): void {
		const errors: string[] = [];

		if (!data.username?.trim()) {
			errors.push(scraperCredentialsValidationStrings.error.usernameRequired);
		}
		if (!data.password) {
			errors.push(scraperCredentialsValidationStrings.error.passwordRequired);
		}
		if (!SCRAPER_PROVIDER_CODE_VALUES.includes(data.providerCode)) {
			errors.push(scraperCredentialsValidationStrings.error.unknownProvider);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: scraperCredentialsValidationStrings.result.saveFailed,
				errors,
			});
		}
	}
}
