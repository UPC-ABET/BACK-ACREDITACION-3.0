import { DomainError } from 'src/commons/domain-error';
import { CourseOutcomeMappingValidation } from './course-outcome-mappings.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	getProgramCommissionScope: jest.fn(),
	getStudyPlanCourseIdsInScope: jest.fn(),
	getOutcomeIdsForProgramCommission: jest.fn(),
	getAssignableOutcomeTypeIds: jest.fn(),
};

describe('CourseOutcomeMappingValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseOutcomeMappingValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				CourseOutcomeMappingValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseOutcomeMappingValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseOutcomeMappingValidation.validateUpdate(mockRepo as any, 999, {}),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				CourseOutcomeMappingValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				CourseOutcomeMappingValidation.validateDelete(mockRepo as any, 999),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateBulkSave', () => {
		const scopedValid = () => {
			mockRepo.getProgramCommissionScope.mockResolvedValue({ programId: 1, academicPeriodId: 2 });
			mockRepo.getStudyPlanCourseIdsInScope.mockResolvedValue([10, 11]);
			mockRepo.getOutcomeIdsForProgramCommission.mockResolvedValue([100, 101]);
			mockRepo.getAssignableOutcomeTypeIds.mockResolvedValue([1000, 1001]);
		};

		it('passes for in-scope courses, outcomes and assignable types', async () => {
			scopedValid();
			await expect(
				CourseOutcomeMappingValidation.validateBulkSave(mockRepo as any, {
					programCommissionId: 5,
					courses: [
						{ studyPlanCourseId: 10, outcomes: [{ outcomeId: 100, outcomeTypeId: 1000 }] },
						{ studyPlanCourseId: 11, outcomes: [] },
					],
				}),
			).resolves.toBeUndefined();
		});

		it('throws when the program commission does not exist', async () => {
			mockRepo.getProgramCommissionScope.mockResolvedValue(null);
			await expect(
				CourseOutcomeMappingValidation.validateBulkSave(mockRepo as any, {
					programCommissionId: 999,
					courses: [],
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when a course is out of scope', async () => {
			scopedValid();
			await expect(
				CourseOutcomeMappingValidation.validateBulkSave(mockRepo as any, {
					programCommissionId: 5,
					courses: [{ studyPlanCourseId: 999, outcomes: [] }],
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when an outcome is out of scope', async () => {
			scopedValid();
			await expect(
				CourseOutcomeMappingValidation.validateBulkSave(mockRepo as any, {
					programCommissionId: 5,
					courses: [{ studyPlanCourseId: 10, outcomes: [{ outcomeId: 999, outcomeTypeId: 1000 }] }],
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when the outcome type is not assignable (e.g. formation)', async () => {
			scopedValid();
			await expect(
				CourseOutcomeMappingValidation.validateBulkSave(mockRepo as any, {
					programCommissionId: 5,
					courses: [{ studyPlanCourseId: 10, outcomes: [{ outcomeId: 100, outcomeTypeId: 9999 }] }],
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when the same outcome is set twice on one course', async () => {
			scopedValid();
			await expect(
				CourseOutcomeMappingValidation.validateBulkSave(mockRepo as any, {
					programCommissionId: 5,
					courses: [
						{
							studyPlanCourseId: 10,
							outcomes: [
								{ outcomeId: 100, outcomeTypeId: 1000 },
								{ outcomeId: 100, outcomeTypeId: 1001 },
							],
						},
					],
				}),
			).rejects.toThrow(DomainError);
		});
	});
});
