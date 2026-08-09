// No class-validator DTOs here: this module has no controller (see its module docblock), so these
// are only the shapes the service hands back to its callers.

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
