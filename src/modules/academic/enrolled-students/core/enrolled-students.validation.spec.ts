import { HttpException } from '@nestjs/common';
import { EnrolledStudentValidation } from './enrolled-students.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findByIdWithRelations: jest.fn(),
	isStudentCodeTaken: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
};

describe('EnrolledStudentValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				EnrolledStudentValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateUpdate(mockRepo as any, 999, {}),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				EnrolledStudentValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(EnrolledStudentValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				HttpException,
			);
		});
	});

	describe('validateMaintenanceUpdate', () => {
		const existing = { id: 1, studentId: 7, student: { code: 'STU-1' } };

		it('passes when the student code is unchanged', async () => {
			mockRepo.findByIdWithRelations.mockResolvedValue(existing);
			await expect(
				EnrolledStudentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					studentCode: 'STU-1',
					campusId: 3,
				}),
			).resolves.toBeUndefined();
			expect(mockRepo.isStudentCodeTaken).not.toHaveBeenCalled();
		});

		it('passes when the new student code is free', async () => {
			mockRepo.findByIdWithRelations.mockResolvedValue(existing);
			mockRepo.isStudentCodeTaken.mockResolvedValue(false);
			await expect(
				EnrolledStudentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					studentCode: 'STU-2',
				}),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findByIdWithRelations.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateMaintenanceUpdate(mockRepo as any, 999, {
					studentCode: 'STU-2',
				}),
			).rejects.toThrow(HttpException);
		});

		it('throws when the new student code is taken by another student', async () => {
			mockRepo.findByIdWithRelations.mockResolvedValue(existing);
			mockRepo.isStudentCodeTaken.mockResolvedValue(true);
			await expect(
				EnrolledStudentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					studentCode: 'STU-2',
				}),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when no section enrollments reference it', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({ studentSectionEnrollments: 0 });
			await expect(
				EnrolledStudentValidation.validateMaintenanceDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateMaintenanceDelete(mockRepo as any, 999),
			).rejects.toThrow(HttpException);
		});

		it('throws 409 naming the blocking relation', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({ studentSectionEnrollments: 4 });

			let caught: HttpException | undefined;
			try {
				await EnrolledStudentValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as HttpException;
			}

			expect(caught).toBeInstanceOf(HttpException);
			expect(caught!.getStatus()).toBe(409);
			const body = caught!.getResponse() as { message: string; errors: string[] };
			expect(body.message).toBe('error.enrolledStudent.inUse');
			expect(body.errors).toEqual(['error.enrolledStudent.usedInStudentSectionEnrollments']);
		});
	});
});
