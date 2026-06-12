import { HttpException } from '@nestjs/common';
import { CourseSectionValidation } from './course-sections.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
};

const noBlockers = { studentSectionEnrollments: 0, surveys: 0 };

describe('CourseSectionValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
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
			).rejects.toThrow(HttpException);
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
			).rejects.toThrow(HttpException);
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
				HttpException,
			);
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
			).rejects.toThrow(HttpException);
		});

		it('throws when the new (course, period, code) collides with another section', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				CourseSectionValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					sectionCode: 'S2',
				}),
			).rejects.toThrow(HttpException);
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
			).rejects.toThrow(HttpException);
		});

		it('throws 409 naming the exact blocking relations', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({
				studentSectionEnrollments: 5,
				surveys: 0,
			});

			let caught: HttpException | undefined;
			try {
				await CourseSectionValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as HttpException;
			}

			expect(caught).toBeInstanceOf(HttpException);
			expect(caught!.getStatus()).toBe(409);
			const body = caught!.getResponse() as { message: string; errors: string[] };
			expect(body.message).toBe('error.courseSection.inUse');
			expect(body.errors).toEqual(['error.courseSection.usedInStudentSectionEnrollments']);
		});
	});
});
