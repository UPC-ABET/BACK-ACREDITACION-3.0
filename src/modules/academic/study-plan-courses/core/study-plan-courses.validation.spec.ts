import { HttpException } from '@nestjs/common';
import { StudyPlanCourseValidation } from './study-plan-courses.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
};

describe('StudyPlanCourseValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanCourseValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				StudyPlanCourseValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanCourseValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanCourseValidation.validateUpdate(mockRepo as any, 999, {}),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				StudyPlanCourseValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(StudyPlanCourseValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				HttpException,
			);
		});
	});

	describe('validateMaintenanceCreate', () => {
		const linkDto = { studyPlanId: 1, isElective: false, levelTypeId: 2, courseId: 5 };
		const newCourseDto = {
			studyPlanId: 1,
			isElective: true,
			levelTypeId: 2,
			newCourse: { code: 'C1', name: { es: 'a', en: 'b' } },
		};

		it('passes for a new course with a resolvable study plan period', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanCourseValidation.validateMaintenanceCreate(
					mockRepo as any,
					100,
					null,
					newCourseDto as any,
				),
			).resolves.toBeUndefined();
		});

		it('throws when no study plan period exists for the period', async () => {
			await expect(
				StudyPlanCourseValidation.validateMaintenanceCreate(
					mockRepo as any,
					null,
					null,
					linkDto as any,
				),
			).rejects.toThrow(HttpException);
		});

		it('throws when both courseId and newCourse are provided', async () => {
			await expect(
				StudyPlanCourseValidation.validateMaintenanceCreate(mockRepo as any, 100, 5, {
					...linkDto,
					newCourse: { code: 'C1', name: { es: 'a', en: 'b' } },
				} as any),
			).rejects.toThrow(HttpException);
		});

		it('throws when neither courseId nor newCourse is provided', async () => {
			await expect(
				StudyPlanCourseValidation.validateMaintenanceCreate(mockRepo as any, 100, null, {
					studyPlanId: 1,
					isElective: false,
					levelTypeId: 2,
				} as any),
			).rejects.toThrow(HttpException);
		});

		it('throws when the course is already in the plan for that period', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 9 });
			await expect(
				StudyPlanCourseValidation.validateMaintenanceCreate(
					mockRepo as any,
					100,
					5,
					linkDto as any,
				),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when nothing references the plan course', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({ rubrics: 0, courseOutcomeMappings: 0 });
			await expect(
				StudyPlanCourseValidation.validateMaintenanceDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				StudyPlanCourseValidation.validateMaintenanceDelete(mockRepo as any, 999),
			).rejects.toThrow(HttpException);
		});

		it('throws 409 naming the exact blocking relations', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({ rubrics: 1, courseOutcomeMappings: 2 });

			let caught: HttpException | undefined;
			try {
				await StudyPlanCourseValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as HttpException;
			}

			expect(caught!.getStatus()).toBe(409);
			const body = caught!.getResponse() as { message: string; errors: string[] };
			expect(body.message).toBe('error.studyPlanCourse.inUse');
			expect(body.errors).toEqual([
				'error.studyPlanCourse.usedInRubrics',
				'error.studyPlanCourse.usedInCourseOutcomeMappings',
			]);
		});
	});
});
