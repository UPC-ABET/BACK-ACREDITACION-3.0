import { ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ResponseEncryptionService } from './response-encryption.service';
import { decryptWithKey } from './response-encryption.functions';

const mockRepo = {
	findByApiTokenIdWithKey: jest.fn(),
};

describe('ResponseEncryptionService', () => {
	beforeEach(() => jest.clearAllMocks());

	it('encrypts the payload with the resolved integration key', async () => {
		const rawKey = randomBytes(32);
		const encryptService = {
			decrypt: jest.fn().mockReturnValue(rawKey.toString('hex')),
		};
		mockRepo.findByApiTokenIdWithKey.mockResolvedValue({
			id: 1,
			apiTokenId: 5,
			keyEncrypted: 'ciphertext-in-db',
		});

		const service = new ResponseEncryptionService(mockRepo as any, encryptService as any);
		const ciphertext = await service.encryptForApiToken(5, { ok: true });

		expect(encryptService.decrypt).toHaveBeenCalledWith('ciphertext-in-db');
		expect(decryptWithKey(rawKey, ciphertext)).toBe(JSON.stringify({ ok: true }));
	});

	it('throws ServiceUnavailableException when no key is provisioned', async () => {
		mockRepo.findByApiTokenIdWithKey.mockResolvedValue(null);
		const encryptService = { decrypt: jest.fn() };

		const service = new ResponseEncryptionService(mockRepo as any, encryptService as any);

		await expect(service.encryptForApiToken(5, { ok: true })).rejects.toThrow(
			ServiceUnavailableException,
		);
		expect(encryptService.decrypt).not.toHaveBeenCalled();
	});
});
