import { randomBytes } from 'crypto';
import { decryptWithKey, encryptWithKey } from './response-encryption.functions';

describe('response-encryption.functions', () => {
	const key = randomBytes(32);
	const otherKey = randomBytes(32);

	it('round-trips a plaintext payload through the same key', () => {
		const payload = JSON.stringify({ ok: true, id: 42 });
		const ciphertext = encryptWithKey(key, payload);

		expect(decryptWithKey(key, ciphertext)).toBe(payload);
	});

	it('rejects decryption with the wrong key', () => {
		const ciphertext = encryptWithKey(key, 'secret payload');

		expect(() => decryptWithKey(otherKey, ciphertext)).toThrow();
	});

	it('rejects a tampered authTag', () => {
		const ciphertext = encryptWithKey(key, 'secret payload');
		const [iv, encrypted, authTag] = ciphertext.split(':');
		const tamperedTag = authTag.slice(0, -2) + (authTag.slice(-2) === '00' ? '01' : '00');

		expect(() => decryptWithKey(key, `${iv}:${encrypted}:${tamperedTag}`)).toThrow();
	});

	it('rejects a malformed wire format', () => {
		expect(() => decryptWithKey(key, 'not-a-valid-ciphertext')).toThrow(/Malformed ciphertext/);
	});

	it('rejects a key of the wrong length', () => {
		expect(() => encryptWithKey(randomBytes(16), 'payload')).toThrow(/32-byte key/);
	});
});
