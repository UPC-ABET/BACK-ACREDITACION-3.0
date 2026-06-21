import { DomainError } from 'src/commons/domain-error';
import { StudentCourseGradeValidation } from './student-course-grades.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
};

describe('StudentCourseGradeValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudentCourseGradeValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				StudentCourseGradeValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudentCourseGradeValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudentCourseGradeValidation.validateUpdate(mockRepo as any, 999, {}),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				StudentCourseGradeValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				StudentCourseGradeValidation.validateDelete(mockRepo as any, 999),
			).rejects.toThrow(DomainError);
		});
	});
});
