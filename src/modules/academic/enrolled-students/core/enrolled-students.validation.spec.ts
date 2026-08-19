import { DomainError } from 'src/commons/domain-error';
import { EnrolledStudentValidation } from './enrolled-students.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findByIdWithRelations: jest.fn(),
	findAcademicPeriodId: jest.fn(),
	findActiveEnrollmentInPeriod: jest.fn(),
	findStudyPlanAcademicPeriodId: jest.fn(),
	isStudentCodeTaken: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
};

describe('EnrolledStudentValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no other active enrollment exists in that academic period', async () => {
			mockRepo.findAcademicPeriodId.mockResolvedValue(100);
			mockRepo.findActiveEnrollmentInPeriod.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateCreate(mockRepo as any, {
					studentId: 1,
					studyPlanAcademicPeriodId: 50,
				}),
			).resolves.toBeUndefined();
		});

		it('throws when the student already has an active enrollment in that academic period', async () => {
			mockRepo.findAcademicPeriodId.mockResolvedValue(100);
			mockRepo.findActiveEnrollmentInPeriod.mockResolvedValue({ id: 1 });
			await expect(
				EnrolledStudentValidation.validateCreate(mockRepo as any, {
					studentId: 1,
					studyPlanAcademicPeriodId: 50,
				}),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findAcademicPeriodId.mockResolvedValue(100);
			mockRepo.findActiveEnrollmentInPeriod.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateUpdate(mockRepo as any, 1, {
					studentId: 1,
					studyPlanAcademicPeriodId: 50,
				}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateUpdate(mockRepo as any, 999, {}),
			).rejects.toThrow(DomainError);
		});

		it('throws when another active enrollment already exists in that academic period', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findAcademicPeriodId.mockResolvedValue(100);
			mockRepo.findActiveEnrollmentInPeriod.mockResolvedValue({ id: 2 });
			await expect(
				EnrolledStudentValidation.validateUpdate(mockRepo as any, 1, {
					studentId: 1,
					studyPlanAcademicPeriodId: 50,
				}),
			).rejects.toThrow(DomainError);
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
				DomainError,
			);
		});
	});

	describe('validateMaintenanceCreate', () => {
		it('passes for a new student with a resolvable study plan period', async () => {
			await expect(
				EnrolledStudentValidation.validateMaintenanceCreate(mockRepo as any, 100, 50, null),
			).resolves.toBeUndefined();
		});

		it('throws when no study plan period exists for the program and period', async () => {
			await expect(
				EnrolledStudentValidation.validateMaintenanceCreate(mockRepo as any, 100, null, null),
			).rejects.toThrow(DomainError);
		});

		it('throws when the student already has an active enrollment in that academic period', async () => {
			mockRepo.findActiveEnrollmentInPeriod.mockResolvedValue({ id: 9 });
			await expect(
				EnrolledStudentValidation.validateMaintenanceCreate(mockRepo as any, 100, 50, 7),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateMaintenanceUpdate', () => {
		const existing = { id: 1, studentId: 7, student: { code: 'STU-1', programId: 5 } };

		it('passes when the student code is unchanged and returns the entity', async () => {
			mockRepo.findByIdWithRelations.mockResolvedValue(existing);
			await expect(
				EnrolledStudentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					studentCode: 'STU-1',
					campusId: 3,
				}),
			).resolves.toEqual(existing);
			expect(mockRepo.isStudentCodeTaken).not.toHaveBeenCalled();
		});

		it('passes when the new student code is free', async () => {
			mockRepo.findByIdWithRelations.mockResolvedValue(existing);
			mockRepo.isStudentCodeTaken.mockResolvedValue(false);
			await expect(
				EnrolledStudentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					studentCode: 'STU-2',
				}),
			).resolves.toEqual(existing);
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findByIdWithRelations.mockResolvedValue(null);
			await expect(
				EnrolledStudentValidation.validateMaintenanceUpdate(mockRepo as any, 999, {
					studentCode: 'STU-2',
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when the new student code is taken by another student', async () => {
			mockRepo.findByIdWithRelations.mockResolvedValue(existing);
			mockRepo.isStudentCodeTaken.mockResolvedValue(true);
			await expect(
				EnrolledStudentValidation.validateMaintenanceUpdate(mockRepo as any, 1, {
					studentCode: 'STU-2',
				}),
			).rejects.toThrow(DomainError);
		});
	});

	describe('resolveMaintenanceProgramChange', () => {
		const entity = { id: 1, studentId: 7, studyPlanAcademicPeriodId: 50 } as any;

		it('returns the new plan id when the new program has a plan for the same period', async () => {
			mockRepo.findAcademicPeriodId.mockResolvedValue(100);
			mockRepo.findStudyPlanAcademicPeriodId.mockResolvedValue(60);
			mockRepo.findActiveEnrollmentInPeriod.mockResolvedValue(null);

			await expect(
				EnrolledStudentValidation.resolveMaintenanceProgramChange(mockRepo as any, entity, 9),
			).resolves.toBe(60);
		});

		it('throws when the new program has no plan for the same period', async () => {
			mockRepo.findAcademicPeriodId.mockResolvedValue(100);
			mockRepo.findStudyPlanAcademicPeriodId.mockResolvedValue(null);

			await expect(
				EnrolledStudentValidation.resolveMaintenanceProgramChange(mockRepo as any, entity, 9),
			).rejects.toThrow(DomainError);
		});

		it('throws when the student already has a different active enrollment in that period', async () => {
			mockRepo.findAcademicPeriodId.mockResolvedValue(100);
			mockRepo.findStudyPlanAcademicPeriodId.mockResolvedValue(60);
			mockRepo.findActiveEnrollmentInPeriod.mockResolvedValue({ id: 2 });

			await expect(
				EnrolledStudentValidation.resolveMaintenanceProgramChange(mockRepo as any, entity, 9),
			).rejects.toThrow(DomainError);
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
			).rejects.toThrow(DomainError);
		});

		it('throws 409 naming the blocking relation', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({ studentSectionEnrollments: 4 });

			let caught: DomainError | undefined;
			try {
				await EnrolledStudentValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as DomainError;
			}

			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('conflict');
			const body = caught!;
			expect(body.message).toBe('error.enrolledStudent.inUse');
			expect(body.errors).toEqual(['error.enrolledStudent.usedInStudentSectionEnrollments']);
		});
	});
});
