import { HttpException } from '@nestjs/common';
import { RoleModulePermissionValidation } from './role-module-permissions.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
};

const basePayload = { roleId: 1, moduleTypeId: 10, permissionTypeId: 100 };

describe('RoleModulePermissionValidation', () => {
	beforeEach(() => jest.clearAllMocks());

	describe('validateCreate', () => {
		it('passes when the triple is not assigned yet', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				RoleModulePermissionValidation.validateCreate(mockRepo as any, basePayload),
			).resolves.toBeUndefined();
		});

		it('throws when the triple already exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 7 });
			await expect(
				RoleModulePermissionValidation.validateCreate(mockRepo as any, basePayload),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when assignment exists and no key fields change', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, ...basePayload });
			await expect(
				RoleModulePermissionValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when assignment not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				RoleModulePermissionValidation.validateUpdate(mockRepo as any, 99, {}),
			).rejects.toThrow(HttpException);
		});

		it('throws when the new triple collides with another row', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, ...basePayload });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				RoleModulePermissionValidation.validateUpdate(mockRepo as any, 1, {
					permissionTypeId: 200,
				}),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateDelete', () => {
		it('passes when assignment exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				RoleModulePermissionValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when assignment not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				RoleModulePermissionValidation.validateDelete(mockRepo as any, 99),
			).rejects.toThrow(HttpException);
		});
	});
});
