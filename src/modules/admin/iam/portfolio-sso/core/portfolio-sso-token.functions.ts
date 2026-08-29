import * as crypto from 'crypto';

// Pinned, not inferred: the receiving system (PORTFOLIO-AUDIT, a separate NestJS/Prisma backend
// not in this repo) decodes with `iv = raw.subarray(0, 12)`, `authTag = raw.subarray(12, 28)`,
// `ciphertext = raw.subarray(28)` — these constants must match that contract exactly.
const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;

/**
 * Builds a base64url SSO token for PORTFOLIO-AUDIT: AES-256-GCM with key = sha256(apiKey), wire
 * layout `iv (12 bytes) || authTag (16 bytes) || ciphertext`.
 *
 * Deliberately a standalone function, not a method on `EncryptService` — that service's
 * `iv:ct:tag` hex format is a completely different, incompatible wire contract from what
 * PORTFOLIO-AUDIT expects here.
 */
export function buildPortfolioSsoToken(payload: Record<string, unknown>, apiKey: string): string {
	const key = crypto.createHash('sha256').update(apiKey, 'utf8').digest();
	const iv = crypto.randomBytes(GCM_IV_BYTES);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
		authTagLength: GCM_AUTH_TAG_BYTES,
	});
	const ciphertext = Buffer.concat([
		cipher.update(JSON.stringify(payload), 'utf8'),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	return Buffer.concat([iv, authTag, ciphertext]).toString('base64url');
}
