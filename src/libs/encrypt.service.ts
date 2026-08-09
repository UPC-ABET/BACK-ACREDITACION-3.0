import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const APP_SECRET_MIN_LENGTH = 64;

// GCM's defaults. Pinned rather than inferred from the ciphertext: `setAuthTag` accepts a short
// tag, so a forged value carrying a 4-byte tag would decrypt against ~2^31 offline attempts instead
// of 2^127 — silently reducing the integrity guarantee on every stored credential to nothing.
const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;

@Injectable()
export class EncryptService {
	private readonly key: Buffer;

	constructor(private readonly configService: ConfigService) {
		this.key = this.getRequiredAppSecret();
	}

	/**
	 * Derived, not hex-decoded: SHA-256 always yields the 32 bytes aes-256-gcm requires, so any
	 * sufficiently long APP_SECRET works regardless of its charset or length.
	 *
	 * Changing this function is equivalent to rotating APP_SECRET — every stored ciphertext becomes
	 * undecryptable and there is no rotation mechanism (ADR-001).
	 */
	private getRequiredAppSecret(): Buffer {
		const secret = this.configService.get<string>('APP_SECRET');

		if (!secret || secret.length < APP_SECRET_MIN_LENGTH) {
			throw new Error(
				`APP_SECRET must be at least ${APP_SECRET_MIN_LENGTH} characters (any charset; the AES key is derived by SHA-256)`,
			);
		}

		return crypto.createHash('sha256').update(secret, 'utf8').digest();
	}

	encrypt(text: string): string {
		const iv = crypto.randomBytes(GCM_IV_BYTES);
		const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv, {
			authTagLength: GCM_AUTH_TAG_BYTES,
		});
		const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
		const authTag = cipher.getAuthTag();

		return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
	}

	decrypt(text: string): string {
		const HEX_PATTERN = /^[0-9a-fA-F]+$/;
		const parts = text?.split(':');

		if (parts?.length !== 3 || !parts.every((p) => p.length > 0 && HEX_PATTERN.test(p))) {
			throw new Error(
				'Malformed ciphertext: expected format "iv:encrypted:authTag" with hex values',
			);
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

		const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv, {
			authTagLength: GCM_AUTH_TAG_BYTES,
		});
		decipher.setAuthTag(authTag);

		const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

		return decrypted.toString('utf8');
	}

	getParsedParameter(param: { value: string; is_encrypted: boolean; is_json: boolean }): unknown {
		if (!param) throw new Error('Parameter not configured');

		let value: unknown = param.is_encrypted ? this.decrypt(param.value) : param.value;
		value = param.is_json ? JSON.parse(value as string) : value;

		return value;
	}
}
