import { DomainError } from 'src/commons/domain-error';
import { ProjectGroupValidation } from './project-groups.validation';

const mockRepo = {
	findOneById: jest.fn(),
	academicPeriodExists: jest.fn(),
	programExists: jest.fn(),
	findByCodeInScope: jest.fn(),
	hasProjects: jest.fn(),
};

describe('ProjectGroupValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		const data = { code: 'GRP-01', academicPeriodId: 1, programId: 1 } as any;

		it('passes when period/program exist and code is free', async () => {
			mockRepo.academicPeriodExists.mockResolvedValue(true);
			mockRepo.programExists.mockResolvedValue(true);
			mockRepo.findByCodeInScope.mockResolvedValue(null);
			await expect(
				ProjectGroupValidation.validateCreate(mockRepo as any, data),
			).resolves.toBeUndefined();
		});

		it('throws when academic period does not exist', async () => {
			mockRepo.academicPeriodExists.mockResolvedValue(false);
			mockRepo.programExists.mockResolvedValue(true);
			mockRepo.findByCodeInScope.mockResolvedValue(null);
			await expect(ProjectGroupValidation.validateCreate(mockRepo as any, data)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when program does not exist', async () => {
			mockRepo.academicPeriodExists.mockResolvedValue(true);
			mockRepo.programExists.mockResolvedValue(false);
			mockRepo.findByCodeInScope.mockResolvedValue(null);
			await expect(ProjectGroupValidation.validateCreate(mockRepo as any, data)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when code already exists in scope', async () => {
			mockRepo.academicPeriodExists.mockResolvedValue(true);
			mockRepo.programExists.mockResolvedValue(true);
			mockRepo.findByCodeInScope.mockResolvedValue({ id: 5 });
			await expect(ProjectGroupValidation.validateCreate(mockRepo as any, data)).rejects.toThrow(
				DomainError,
			);
		});
	});

	describe('validateUpdate', () => {
		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(ProjectGroupValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				DomainError,
			);
		});

		it('passes when no scope fields change', async () => {
			mockRepo.findOneById.mockResolvedValue({
				id: 1,
				code: 'GRP-01',
				academicPeriodId: 1,
				programId: 1,
			});
			await expect(
				ProjectGroupValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when new academic period does not exist', async () => {
			mockRepo.findOneById.mockResolvedValue({
				id: 1,
				code: 'GRP-01',
				academicPeriodId: 1,
				programId: 1,
			});
			mockRepo.academicPeriodExists.mockResolvedValue(false);
			await expect(
				ProjectGroupValidation.validateUpdate(mockRepo as any, 1, { academicPeriodId: 2 }),
			).rejects.toThrow(DomainError);
		});

		it('throws when the resulting business key collides with another group', async () => {
			mockRepo.findOneById.mockResolvedValue({
				id: 1,
				code: 'GRP-01',
				academicPeriodId: 1,
				programId: 1,
			});
			mockRepo.findByCodeInScope.mockResolvedValue({ id: 2 });
			await expect(
				ProjectGroupValidation.validateUpdate(mockRepo as any, 1, { code: 'GRP-02' }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(ProjectGroupValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when the group still has projects', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.hasProjects.mockResolvedValue(true);
			await expect(ProjectGroupValidation.validateDelete(mockRepo as any, 1)).rejects.toThrow(
				DomainError,
			);
		});

		it('passes when the group has no projects', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.hasProjects.mockResolvedValue(false);
			await expect(
				ProjectGroupValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});
	});
});
