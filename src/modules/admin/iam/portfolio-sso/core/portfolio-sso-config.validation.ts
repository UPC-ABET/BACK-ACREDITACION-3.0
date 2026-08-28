import { BadRequestError, NotFoundError } from 'src/commons/domain-error';
import { portfolioSsoValidationStrings } from '../config/strings/portfolio-sso.validation';
import type { PortfolioSsoConfigEntity } from '../model/portfolio-sso-config.entity';

const API_KEY_MIN_LENGTH = 32;

export class PortfolioSsoConfigValidation {
	/**
	 * Belt-and-suspenders re-check on top of the DTO-level `@IsUrl`/`@MinLength` (defense in depth):
	 * the primary gate is the global `ValidationPipe`, this defends the invariant even if a caller
	 * bypasses the DTO layer. Returns the normalized `baseUrl` (trailing slash stripped) so later
	 * URL concatenation (`${baseUrl}/auth/externo?token=...`) never double-slashes.
	 */
	static validateUpsert(data: { baseUrl: string; apiKey: string }): { baseUrl: string } {
		const errors: string[] = [];

		let normalizedBaseUrl = data.baseUrl;
		try {
			const parsed = new URL(data.baseUrl);
			if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
				errors.push(portfolioSsoValidationStrings.error.invalidBaseUrl);
			}
		} catch {
			errors.push(portfolioSsoValidationStrings.error.invalidBaseUrl);
		}
		normalizedBaseUrl = normalizedBaseUrl.replace(/\/+$/, '');

		if (typeof data.apiKey !== 'string' || data.apiKey.length < API_KEY_MIN_LENGTH) {
			errors.push(portfolioSsoValidationStrings.error.invalidApiKey);
		}

		if (errors.length > 0) {
			throw new BadRequestError({
				message: portfolioSsoValidationStrings.result.upsertFailed,
				errors,
			});
		}

		return { baseUrl: normalizedBaseUrl };
	}

	static validateConfigured(
		config: PortfolioSsoConfigEntity | null,
	): asserts config is PortfolioSsoConfigEntity {
		if (!config) {
			throw new NotFoundError({
				message: portfolioSsoValidationStrings.result.linkFailed,
				errors: [portfolioSsoValidationStrings.error.notConfigured],
			});
		}
	}
}
