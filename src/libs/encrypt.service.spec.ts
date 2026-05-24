import { ConfigService } from '@nestjs/config';
import { EncryptService } from './encrypt.service';

const VALID_HEX_SECRET = 'e1fae13704956f47dcc7446d993d605709ad74f9846ad758f102569c89924447';

function buildService(secret: string | undefined): EncryptService {
	const configService = {
		get: jest.fn().mockReturnValue(secret),
	} as unknown as ConfigService;

	return new EncryptService(configService);
}

describe('EncryptService', () => {
	describe('boot validation', () => {
		it('throws when APP_SECRET is missing', () => {
			expect(() => buildService(undefined)).toThrow('APP_SECRET must be configured');
		});

		it('throws when APP_SECRET is too short', () => {
			expect(() => buildService('abcd1234')).toThrow('APP_SECRET must be configured');
		});

		it('starts normally with a valid 64-char hex secret', () => {
			expect(() => buildService(VALID_HEX_SECRET)).not.toThrow();
		});
	});

	describe('encrypt / decrypt round-trip', () => {
		let service: EncryptService;

		beforeEach(() => {
			service = buildService(VALID_HEX_SECRET);
		});

		it('round-trips a simple string', () => {
			const plaintext = 'hello world';
			const ciphertext = service.encrypt(plaintext);
			expect(service.decrypt(ciphertext)).toBe(plaintext);
		});

		it('round-trips unicode text', () => {
			const plaintext = 'contraseña 日本語 🔑';
			expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
		});

		it('produces iv:ciphertext:authTag format', () => {
			const parts = service.encrypt('test').split(':');
			expect(parts).toHaveLength(3);
			expect(parts[0]).toHaveLength(24); // 12 bytes = 24 hex chars (IV)
			expect(parts[2]).toHaveLength(32); // 16 bytes = 32 hex chars (authTag)
		});

		it('produces different ciphertexts for the same plaintext (random IV)', () => {
			const a = service.encrypt('same');
			const b = service.encrypt('same');
			expect(a).not.toBe(b);
		});
	});

	describe('tamper detection', () => {
		let service: EncryptService;

		beforeEach(() => {
			service = buildService(VALID_HEX_SECRET);
		});

		it('rejects ciphertext with a flipped byte', () => {
			const ciphertext = service.encrypt('secret data');
			const [iv, enc, tag] = ciphertext.split(':');
			const tampered = `${iv}:${flipHexByte(enc)}:${tag}`;
			expect(() => service.decrypt(tampered)).toThrow();
		});

		it('rejects ciphertext with a tampered auth tag', () => {
			const ciphertext = service.encrypt('secret data');
			const [iv, enc, tag] = ciphertext.split(':');
			const tampered = `${iv}:${enc}:${flipHexByte(tag)}`;
			expect(() => service.decrypt(tampered)).toThrow();
		});
	});

	describe('getParsedParameter', () => {
		let service: EncryptService;

		beforeEach(() => {
			service = buildService(VALID_HEX_SECRET);
		});

		it('returns plain value when not encrypted', () => {
			const result = service.getParsedParameter({
				value: 'plain',
				is_encrypted: false,
				is_json: false,
			});
			expect(result).toBe('plain');
		});

		it('decrypts an encrypted value', () => {
			const encrypted = service.encrypt('secret');
			const result = service.getParsedParameter({
				value: encrypted,
				is_encrypted: true,
				is_json: false,
			});
			expect(result).toBe('secret');
		});

		it('parses JSON when is_json is true', () => {
			const result = service.getParsedParameter({
				value: '{"a":1}',
				is_encrypted: false,
				is_json: true,
			});
			expect(result).toEqual({ a: 1 });
		});
	});
});

function flipHexByte(hex: string): string {
	const flipped = (parseInt(hex.slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0');
	return flipped + hex.slice(2);
}
