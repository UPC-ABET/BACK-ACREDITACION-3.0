import { IntegrationKeyService } from './integration-keys.service';

const mockRepo = {
	findByApiTokenId: jest.fn(),
	create: jest.fn(),
	rotateForApiToken: jest.fn(),
};

const mockApiTokenRepo = {
	findOneById: jest.fn(),
};

const mockEncryptService = {
	encrypt: jest.fn((plain: string) => `enc(${plain})`),
	decrypt: jest.fn(),
};

describe('IntegrationKeyService', () => {
	beforeEach(() => jest.clearAllMocks());

	const service = new IntegrationKeyService(
		mockRepo as any,
		mockApiTokenRepo as any,
		mockEncryptService as any,
	);

	describe('issue', () => {
		it('creates a key and returns it in plaintext exactly once', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue({ id: 1, isActive: true });
			mockRepo.findByApiTokenId.mockResolvedValue(null);
			mockRepo.create.mockImplementation(async (data) => ({
				id: 10,
				...data,
				createdAt: new Date(),
				updatedAt: new Date(),
			}));

			const result = await service.issue({ apiTokenId: 1 }, 99);

			expect(result.key).toHaveLength(64);
			expect((result as any).keyEncrypted).toBeUndefined();
			expect(mockRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ apiTokenId: 1, issuedByUserId: 99 }),
				undefined,
			);
		});
	});

	describe('rotate', () => {
		it('replaces the key and returns the new plaintext exactly once', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue({ id: 1, isActive: true });
			mockRepo.findByApiTokenId.mockResolvedValue({ id: 10, apiTokenId: 1 });
			mockRepo.rotateForApiToken.mockImplementation(
				async (apiTokenId, keyEncrypted, issuedByUserId) => ({
					id: 10,
					apiTokenId,
					keyEncrypted,
					issuedByUserId,
					updatedAt: new Date(),
				}),
			);

			const result = await service.rotate(1, 99);

			expect(result.key).toHaveLength(64);
			expect((result as any).keyEncrypted).toBeUndefined();
		});
	});
});
