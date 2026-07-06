import { DomainError } from 'src/commons/domain-error';
import { ProjectValidation } from './projects.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	hasRubricScores: jest.fn(),
	getProjectGroupById: jest.fn(),
	getProjectAcademicPeriodId: jest.fn(),
};

describe('ProjectValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				ProjectValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				ProjectValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				ProjectValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(ProjectValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when assigning a group from a different academic period (project currently ungrouped)', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, projectGroupId: null });
			mockRepo.getProjectGroupById.mockResolvedValue({ id: 7, academicPeriodId: 202520 });
			mockRepo.getProjectAcademicPeriodId.mockResolvedValue(202510);
			await expect(
				ProjectValidation.validateUpdate(mockRepo as any, 1, { projectGroupId: 7 }),
			).rejects.toThrow(DomainError);
		});

		it('passes when assigning a group from the same academic period', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, projectGroupId: null });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			mockRepo.getProjectGroupById.mockResolvedValue({ id: 7, academicPeriodId: 202510 });
			mockRepo.getProjectAcademicPeriodId.mockResolvedValue(202510);
			await expect(
				ProjectValidation.validateUpdate(mockRepo as any, 1, { projectGroupId: 7 }),
			).resolves.toBeUndefined();
		});

		it('throws when the assigned group does not exist', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, projectGroupId: null });
			mockRepo.getProjectGroupById.mockResolvedValue(null);
			await expect(
				ProjectValidation.validateUpdate(mockRepo as any, 1, { projectGroupId: 99 }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists and has no rubric scores', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.hasRubricScores.mockResolvedValue(false);
			await expect(ProjectValidation.validateDelete(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(ProjectValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when project has rubric scores', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.hasRubricScores.mockResolvedValue(true);
			await expect(ProjectValidation.validateDelete(mockRepo as any, 1)).rejects.toThrow(
				DomainError,
			);
		});
	});
});
