import { BadRequestError, ConflictError, NotFoundError } from 'src/commons/domain-error';
import { IntegrationKeyValidation } from './integration-keys.validation';

const mockApiTokenRepo = {
	findOneById: jest.fn(),
};

const mockRepo = {
	findByApiTokenId: jest.fn(),
};

describe('IntegrationKeyValidation', () => {
	beforeEach(() => jest.clearAllMocks());

	describe('validateIssue', () => {
		it('passes when the api token is active and has no key yet', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue({ id: 1, isActive: true });
			mockRepo.findByApiTokenId.mockResolvedValue(null);

			await expect(
				IntegrationKeyValidation.validateIssue(mockApiTokenRepo as any, mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('rejects an unknown api token', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue(null);

			await expect(
				IntegrationKeyValidation.validateIssue(mockApiTokenRepo as any, mockRepo as any, 1),
			).rejects.toThrow(BadRequestError);
		});

		it('rejects an inactive api token', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue({ id: 1, isActive: false });

			await expect(
				IntegrationKeyValidation.validateIssue(mockApiTokenRepo as any, mockRepo as any, 1),
			).rejects.toThrow(BadRequestError);
		});

		it('rejects an api token that already has a key', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue({ id: 1, isActive: true });
			mockRepo.findByApiTokenId.mockResolvedValue({ id: 10, apiTokenId: 1 });

			await expect(
				IntegrationKeyValidation.validateIssue(mockApiTokenRepo as any, mockRepo as any, 1),
			).rejects.toThrow(ConflictError);
		});
	});

	describe('validateRotate', () => {
		it('passes when the api token is active and already has a key', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue({ id: 1, isActive: true });
			mockRepo.findByApiTokenId.mockResolvedValue({ id: 10, apiTokenId: 1 });

			await expect(
				IntegrationKeyValidation.validateRotate(mockApiTokenRepo as any, mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('rejects an unknown api token', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue(null);

			await expect(
				IntegrationKeyValidation.validateRotate(mockApiTokenRepo as any, mockRepo as any, 1),
			).rejects.toThrow(BadRequestError);
		});

		it('rejects rotation when no key has been issued yet', async () => {
			mockApiTokenRepo.findOneById.mockResolvedValue({ id: 1, isActive: true });
			mockRepo.findByApiTokenId.mockResolvedValue(null);

			await expect(
				IntegrationKeyValidation.validateRotate(mockApiTokenRepo as any, mockRepo as any, 1),
			).rejects.toThrow(NotFoundError);
		});
	});
});
