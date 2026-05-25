import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const APP_SECRET_HEX_LENGTH = 64;

@Injectable()
export class EncryptService {
	private readonly key: Buffer;

	constructor(private readonly configService: ConfigService) {
		this.key = this.getRequiredAppSecret();
	}

	private getRequiredAppSecret(): Buffer {
		const secret = this.configService.get<string>('APP_SECRET');

		if (!secret || secret.length < APP_SECRET_HEX_LENGTH) {
			throw new Error(
				`APP_SECRET must be configured as a hex string (>=${APP_SECRET_HEX_LENGTH} hex chars / 32 bytes)`,
			);
		}

		return Buffer.from(secret, 'hex');
	}

	encrypt(text: string): string {
		const iv = crypto.randomBytes(12);
		const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
		const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
		const authTag = cipher.getAuthTag();

		return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
	}

	decrypt(text: string): string {
		const HEX_PATTERN = /^[0-9a-fA-F]+$/;
		const parts = text?.split(':');

		if (parts?.length !== 3 || !parts.every((p) => p.length > 0 && HEX_PATTERN.test(p))) {
			throw new Error('Malformed ciphertext: expected format "iv:encrypted:authTag" with hex values');
		}

		const [ivHex, encryptedHex, authTagHex] = parts;

		const iv = Buffer.from(ivHex, 'hex');
		const encrypted = Buffer.from(encryptedHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');

		const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
		decipher.setAuthTag(authTag);

		const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

		return decrypted.toString('utf8');
	}

	getParsedParameter(param: { value: string; is_encrypted: boolean; is_json: boolean }): unknown {
		if (!param) throw new Error('Parametro no configurado');

		let value: unknown = param.is_encrypted ? this.decrypt(param.value) : param.value;
		value = param.is_json ? JSON.parse(value as string) : value;

		return value;
	}
}
