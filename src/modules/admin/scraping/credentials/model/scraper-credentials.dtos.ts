import type { ScraperProviderCode } from '../constants/scraper-provider-codes';

// No class-validator DTOs here: this module has no controller (see its module docblock), so these
// are only the shapes the service exchanges with its callers.

export interface SaveScraperCredentialInput {
	providerCode: ScraperProviderCode;
	username: string;
	password: string;
}

export interface ScraperCredentialSummary {
	username: string | null;
	configured: boolean;
	updatedAt: Date | null;
}

/** Only ever built in memory for an immediate login. Never persisted, logged or serialized. */
export interface DecryptedScraperCredential {
	username: string;
	password: string;
}
