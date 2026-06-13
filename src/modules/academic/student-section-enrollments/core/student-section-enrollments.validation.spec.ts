import { HttpException } from '@nestjs/common';
import { StudentSectionEnrollmentValidation } from './student-section-enrollments.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
};

const noBlockers = {
	studentCourseGrades: 0,
	projectStudents: 0,
	studentCourseOutcomeGrades: 0,
};

describe('StudentSectionEnrollmentValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudentSectionEnrollmentValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				StudentSectionEnrollmentValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudentSectionEnrollmentValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudentSectionEnrollmentValidation.validateUpdate(mockRepo as any, 999, {}),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				StudentSectionEnrollmentValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				StudentSectionEnrollmentValidation.validateDelete(mockRepo as any, 999),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceCreate', () => {
		const dto = { courseSectionId: 3, enrolledStudentId: 4 };

		it('passes when the pair is free', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudentSectionEnrollmentValidation.validateMaintenanceCreate(mockRepo as any, dto),
			).resolves.toBeUndefined();
		});

		it('throws when the enrollment already exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 9 });
			await expect(
				StudentSectionEnrollmentValidation.validateMaintenanceCreate(mockRepo as any, dto),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceUpdate', () => {
		const existing = { id: 1, enrolledStudentId: 10, courseSectionId: 20 };

		it('passes when the pair is unchanged', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			await expect(
				StudentSectionEnrollmentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					courseSectionId: 20,
				}),
			).resolves.toBeUndefined();
			expect(mockRepo.findOneByCondition).not.toHaveBeenCalled();
		});

		it('passes when the new pair is free', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudentSectionEnrollmentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					courseSectionId: 21,
				}),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				StudentSectionEnrollmentValidation.validateMaintenanceUpdate(mockRepo as any, 999, {
					courseSectionId: 21,
				}),
			).rejects.toThrow(HttpException);
		});

		it('throws when the new (student, section) pair already exists', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				StudentSectionEnrollmentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					enrolledStudentId: 11,
				}),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when nothing references it', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue(noBlockers);
			await expect(
				StudentSectionEnrollmentValidation.validateMaintenanceDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				StudentSectionEnrollmentValidation.validateMaintenanceDelete(mockRepo as any, 999),
			).rejects.toThrow(HttpException);
		});

		it('throws 409 naming the exact blocking relations', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({
				...noBlockers,
				studentCourseGrades: 2,
				studentCourseOutcomeGrades: 1,
			});

			let caught: HttpException | undefined;
			try {
				await StudentSectionEnrollmentValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as HttpException;
			}

			expect(caught).toBeInstanceOf(HttpException);
			expect(caught!.getStatus()).toBe(409);
			const body = caught!.getResponse() as { message: string; errors: string[] };
			expect(body.message).toBe('error.studentSectionEnrollment.inUse');
			expect(body.errors).toEqual([
				'error.studentSectionEnrollment.usedInStudentCourseGrades',
				'error.studentSectionEnrollment.usedInStudentCourseOutcomeGrades',
			]);
		});
	});
});
