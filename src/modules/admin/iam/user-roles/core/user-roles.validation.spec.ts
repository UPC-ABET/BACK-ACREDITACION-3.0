import { HttpException } from '@nestjs/common';
import { UserRoleValidation } from './user-roles.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
};

describe('UserRoleValidation', () => {
	beforeEach(() => jest.clearAllMocks());

	describe('validateCreate', () => {
		it('passes when the pairing is not assigned yet', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				UserRoleValidation.validateCreate(mockRepo as any, { userId: 1, roleId: 2 }),
			).resolves.toBeUndefined();
		});

		it('throws when the pairing already exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 5 });
			await expect(
				UserRoleValidation.validateCreate(mockRepo as any, { userId: 1, roleId: 2 }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when assignment exists and no key fields change', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, userId: 1, roleId: 2 });
			await expect(
				UserRoleValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when assignment not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				UserRoleValidation.validateUpdate(mockRepo as any, 99, {}),
			).rejects.toThrow(HttpException);
		});

		it('throws when the new pairing collides with another row', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, userId: 1, roleId: 2 });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				UserRoleValidation.validateUpdate(mockRepo as any, 1, { roleId: 3 }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateDelete', () => {
		it('passes when assignment exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				UserRoleValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when assignment not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				UserRoleValidation.validateDelete(mockRepo as any, 99),
			).rejects.toThrow(HttpException);
		});
	});
});
