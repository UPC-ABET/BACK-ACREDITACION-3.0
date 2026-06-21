import { DomainError } from 'src/commons/domain-error';
import { RoleValidation } from './roles.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
};

describe('RoleValidation', () => {
	beforeEach(() => jest.clearAllMocks());

	describe('validateCreate', () => {
		it('passes when code is unique', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				RoleValidation.validateCreate(mockRepo as any, { code: 'COORDINATOR' }),
			).resolves.toBeUndefined();
		});

		it('throws when code already exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				RoleValidation.validateCreate(mockRepo as any, { code: 'COORDINATOR' }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateUpdate', () => {
		it('passes when role exists and code unchanged', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(RoleValidation.validateUpdate(mockRepo as any, 1, {})).resolves.toBeUndefined();
		});

		it('throws when role not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(RoleValidation.validateUpdate(mockRepo as any, 99, {})).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when new code belongs to another role', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				RoleValidation.validateUpdate(mockRepo as any, 1, { code: 'ADMIN' }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when role exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(RoleValidation.validateDelete(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws when role not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(RoleValidation.validateDelete(mockRepo as any, 99)).rejects.toThrow(DomainError);
		});
	});
});
