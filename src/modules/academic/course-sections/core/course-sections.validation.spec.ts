import { DomainError } from 'src/commons/domain-error';
import { CourseSectionValidation } from './course-sections.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
	isCourseInStudyPlanForPeriod: jest.fn(),
};

const noBlockers = { studentSectionEnrollments: 0, surveys: 0 };

describe('CourseSectionValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// default: the course belongs to a study plan for the period (happy path)
		mockRepo.isCourseInStudyPlanForPeriod.mockResolvedValue(true);
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseSectionValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				CourseSectionValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseSectionValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseSectionValidation.validateUpdate(mockRepo as any, 999, {}),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				CourseSectionValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(CourseSectionValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				DomainError,
			);
		});
	});

	describe('validateMaintenanceCreate', () => {
		const dto = {
			sectionCode: 'SEC-1',
			courseId: 3,
			professorId: 4,
			campusId: 5,
			sectionModalityTypeId: 6,
		};

		it('passes when no duplicate exists for the period', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseSectionValidation.validateMaintenanceCreate(mockRepo as any, 10, dto),
			).resolves.toBeUndefined();
		});

		it('throws when the section already exists for the period', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 9 });
			await expect(
				CourseSectionValidation.validateMaintenanceCreate(mockRepo as any, 10, dto),
			).rejects.toThrow(DomainError);
		});

		it('throws when the course is not in a study plan for the period', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			mockRepo.isCourseInStudyPlanForPeriod.mockResolvedValue(false);
			await expect(
				CourseSectionValidation.validateMaintenanceCreate(mockRepo as any, 10, dto),
			).rejects.toThrow(DomainError);
			expect(mockRepo.isCourseInStudyPlanForPeriod).toHaveBeenCalledWith(dto.courseId, 10);
		});
	});

	describe('validateMaintenanceUpdate', () => {
		const existing = { id: 1, courseId: 10, academicPeriodId: 7, sectionCode: 'S1' };

		it('passes when neither course nor section code change', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			await expect(
				CourseSectionValidation.validateMaintenanceUpdate(mockRepo as any, 1, { campusId: 3 }),
			).resolves.toBeUndefined();
			expect(mockRepo.findOneByCondition).not.toHaveBeenCalled();
		});

		it('passes when the new section code is free in the period', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				CourseSectionValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					sectionCode: 'S2',
				}),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				CourseSectionValidation.validateMaintenanceUpdate(mockRepo as any, 999, {
					sectionCode: 'S2',
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when the new (course, period, code) collides with another section', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				CourseSectionValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					sectionCode: 'S2',
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when the course is changed to one not in a study plan for the period', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			mockRepo.isCourseInStudyPlanForPeriod.mockResolvedValue(false);
			await expect(
				CourseSectionValidation.validateMaintenanceUpdate(mockRepo as any, 1, { courseId: 99 }),
			).rejects.toThrow(DomainError);
			// checked against the section's own period
			expect(mockRepo.isCourseInStudyPlanForPeriod).toHaveBeenCalledWith(
				99,
				existing.academicPeriodId,
			);
		});

		it('does not re-check study-plan membership when the course is unchanged', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await CourseSectionValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
				sectionCode: 'S2',
			});
			expect(mockRepo.isCourseInStudyPlanForPeriod).not.toHaveBeenCalled();
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when nothing references the section', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue(noBlockers);
			await expect(
				CourseSectionValidation.validateMaintenanceDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				CourseSectionValidation.validateMaintenanceDelete(mockRepo as any, 999),
			).rejects.toThrow(DomainError);
		});

		it('throws 409 naming the exact blocking relations', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({
				studentSectionEnrollments: 5,
				surveys: 0,
			});

			let caught: DomainError | undefined;
			try {
				await CourseSectionValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as DomainError;
			}

			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('conflict');
			const body = caught!;
			expect(body.message).toBe('error.courseSection.inUse');
			expect(body.errors).toEqual(['error.courseSection.usedInStudentSectionEnrollments']);
		});
	});
});
