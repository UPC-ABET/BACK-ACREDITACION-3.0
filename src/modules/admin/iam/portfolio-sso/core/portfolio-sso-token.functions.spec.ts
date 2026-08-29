import * as crypto from 'crypto';
import { buildPortfolioSsoToken } from './portfolio-sso-token.functions';

const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;

/**
 * Reimplements PORTFOLIO-AUDIT's receiving-side decrypt logic (not available in this repo) so the
 * round-trip test verifies the wire contract independently of `buildPortfolioSsoToken`'s own code.
 */
function decryptAsPortfolioAudit(token: string, apiKey: string): Record<string, unknown> {
	const key = crypto.createHash('sha256').update(apiKey, 'utf8').digest();
	const raw = Buffer.from(token, 'base64url');

	const iv = raw.subarray(0, GCM_IV_BYTES);
	const authTag = raw.subarray(GCM_IV_BYTES, GCM_IV_BYTES + GCM_AUTH_TAG_BYTES);
	const ciphertext = raw.subarray(GCM_IV_BYTES + GCM_AUTH_TAG_BYTES);

	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return JSON.parse(decrypted.toString('utf8'));
}

describe('buildPortfolioSsoToken', () => {
	const apiKey = 'a'.repeat(32);
	const payload = {
		username: 'jane.doe@upc.edu.pe',
		email: 'jane.doe@upc.edu.pe',
		fullName: 'Jane Doe',
		issuedAt: 1_700_000_000_000,
	};

	it('round-trips through the receiving system decrypt logic', () => {
		const token = buildPortfolioSsoToken(payload, apiKey);
		const recovered = decryptAsPortfolioAudit(token, apiKey);

		expect(recovered).toEqual(payload);
	});

	it('produces a token whose decoded byte length matches iv + authTag + ciphertext', () => {
		const token = buildPortfolioSsoToken(payload, apiKey);
		const raw = Buffer.from(token, 'base64url');
		const expectedCiphertextLength = Buffer.byteLength(JSON.stringify(payload), 'utf8');

		expect(raw.length).toBe(GCM_IV_BYTES + GCM_AUTH_TAG_BYTES + expectedCiphertextLength);
	});

	it('produces different tokens across calls (random IV) that both decrypt to the same payload', () => {
		const tokenA = buildPortfolioSsoToken(payload, apiKey);
		const tokenB = buildPortfolioSsoToken(payload, apiKey);

		expect(tokenA).not.toBe(tokenB);
		expect(decryptAsPortfolioAudit(tokenA, apiKey)).toEqual(payload);
		expect(decryptAsPortfolioAudit(tokenB, apiKey)).toEqual(payload);
	});

	it('fails to decrypt with the wrong apiKey (auth tag mismatch)', () => {
		const token = buildPortfolioSsoToken(payload, apiKey);

		expect(() => decryptAsPortfolioAudit(token, 'b'.repeat(32))).toThrow();
	});
});
