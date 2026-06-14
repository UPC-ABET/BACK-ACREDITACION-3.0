import { HttpException } from '@nestjs/common';
import { PortfolioAccessValidation } from './portfolio-access.validation';

const mockRepo = {
	userExistsActive: jest.fn(),
};

describe('PortfolioAccessValidation', () => {
	beforeEach(() => jest.clearAllMocks());

	describe('validateUserExists', () => {
		it('passes when the user exists and is active', async () => {
			mockRepo.userExistsActive.mockResolvedValue(true);
			await expect(
				PortfolioAccessValidation.validateUserExists(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the user does not exist', async () => {
			mockRepo.userExistsActive.mockResolvedValue(false);
			await expect(
				PortfolioAccessValidation.validateUserExists(mockRepo as any, 999),
			).rejects.toThrow(HttpException);
		});
	});
});
