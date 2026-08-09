import { ConfigService } from '@nestjs/config';
import { EncryptService } from './encrypt.service';

const VALID_HEX_SECRET = 'e1fae13704956f47dcc7446d993d605709ad74f9846ad758f102569c89924447';

// A 64-hex secret decodes to exactly 32 bytes, the only length a hex-decoding derivation accepts,
// so pinning a longer one is what keeps the derivation honest. `env.config` additionally requires
// hex; this service does not, and the non-hex case is a lib-level guarantee only.
const LONG_HEX_SECRET = VALID_HEX_SECRET.repeat(2);
const NON_HEX_SECRET = 'correct-horse-battery-staple-correct-horse-battery-staple-zzzzzz';

function buildService(secret: string | undefined): EncryptService {
	const configService = {
		get: jest.fn().mockReturnValue(secret),
	} as unknown as ConfigService;

	return new EncryptService(configService);
}

describe('EncryptService', () => {
	describe('boot validation', () => {
		it('throws when APP_SECRET is missing', () => {
			expect(() => buildService(undefined)).toThrow('APP_SECRET must be at least');
		});

		it('throws when APP_SECRET is too short', () => {
			expect(() => buildService('abcd1234')).toThrow('APP_SECRET must be at least');
		});

		it('starts normally with a valid 64-char hex secret', () => {
			expect(() => buildService(VALID_HEX_SECRET)).not.toThrow();
		});

		it('starts normally with a 128-char hex secret', () => {
			expect(() => buildService(LONG_HEX_SECRET)).not.toThrow();
		});

		it('starts normally with a long non-hex secret', () => {
			expect(() => buildService(NON_HEX_SECRET)).not.toThrow();
		});
	});

	// Each asserts the *usable* outcome, not merely construction: a derivation that yields a wrong
	// key length fails at encrypt time, not at boot.
	describe.each([
		['128-char hex', LONG_HEX_SECRET],
		['non-hex passphrase', NON_HEX_SECRET],
	])('key derivation from a %s secret', (_label, secret) => {
		it('round-trips a password', () => {
			const service = buildService(secret);
			expect(service.decrypt(service.encrypt('example-pw'))).toBe('example-pw');
		});
	});

	it('cannot decrypt ciphertext produced under a different secret', () => {
		const ciphertext = buildService(VALID_HEX_SECRET).encrypt('example-pw');
		expect(() => buildService(LONG_HEX_SECRET).decrypt(ciphertext)).toThrow();
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

		// GCM accepts a truncated tag, which would drop forgery resistance from 2^127 to 2^31 on
		// every row an attacker with write access to core.scraper_credentials could reach. The
		// length has to be pinned, not inferred from whatever the ciphertext carries.
		it('rejects a truncated auth tag rather than verifying against it', () => {
			const [iv, enc, tag] = service.encrypt('secret data').split(':');
			expect(() => service.decrypt(`${iv}:${enc}:${tag.slice(0, 8)}`)).toThrow(
				'expected a 12-byte iv and a 16-byte authTag',
			);
		});

		it('rejects an iv that is not 12 bytes', () => {
			const [iv, enc, tag] = service.encrypt('secret data').split(':');
			expect(() => service.decrypt(`${iv.slice(0, 16)}:${enc}:${tag}`)).toThrow(
				'expected a 12-byte iv and a 16-byte authTag',
			);
		});

		it.each([
			['is not hex', 'zz:zz:zz'],
			['has too few parts', 'deadbeef:deadbeef'],
			['has too many parts', 'de:ad:be:ef'],
			['is empty', ''],
		])('rejects ciphertext that %s', (_label, value) => {
			expect(() => service.decrypt(value)).toThrow('Malformed ciphertext');
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
