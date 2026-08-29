import * as crypto from 'crypto';

// Same GCM parameters and `iv:encrypted:authTag` wire format as `src/libs/encrypt.service.ts`, but
// parameterized by an explicit key instead of one derived from `APP_SECRET` — each integration gets
// its own freshly generated key (see `IntegrationKeyService`), so no derivation step is needed.
const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;
const AES_256_KEY_BYTES = 32;

export function encryptWithKey(key: Buffer, text: string): string {
	if (key.length !== AES_256_KEY_BYTES) {
		throw new Error(`Expected a ${AES_256_KEY_BYTES}-byte key`);
	}

	const iv = crypto.randomBytes(GCM_IV_BYTES);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
		authTagLength: GCM_AUTH_TAG_BYTES,
	});
	const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

export function decryptWithKey(key: Buffer, ciphertext: string): string {
	if (key.length !== AES_256_KEY_BYTES) {
		throw new Error(`Expected a ${AES_256_KEY_BYTES}-byte key`);
	}

	const HEX_PATTERN = /^[0-9a-fA-F]+$/;
	const parts = ciphertext?.split(':');

	if (parts?.length !== 3 || !parts.every((p) => p.length > 0 && HEX_PATTERN.test(p))) {
		throw new Error('Malformed ciphertext: expected format "iv:encrypted:authTag" with hex values');
	}

	const [ivHex, encryptedHex, authTagHex] = parts;

	const iv = Buffer.from(ivHex, 'hex');
	const encrypted = Buffer.from(encryptedHex, 'hex');
	const authTag = Buffer.from(authTagHex, 'hex');

	if (iv.length !== GCM_IV_BYTES || authTag.length !== GCM_AUTH_TAG_BYTES) {
		throw new Error(
			`Malformed ciphertext: expected a ${GCM_IV_BYTES}-byte iv and a ${GCM_AUTH_TAG_BYTES}-byte authTag`,
		);
	}

	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
		authTagLength: GCM_AUTH_TAG_BYTES,
	});
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

	return decrypted.toString('utf8');
}
