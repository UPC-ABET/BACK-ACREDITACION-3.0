import { HttpException } from '@nestjs/common';
import { StudyPlanValidation } from './study-plans.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
	isProgramInModality: jest.fn(),
};

describe('StudyPlanValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				StudyPlanValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(StudyPlanValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				HttpException,
			);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(StudyPlanValidation.validateDelete(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(StudyPlanValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				HttpException,
			);
		});
	});

	describe('validateMaintenanceCreate', () => {
		const dto = { code: 'SP-1', programId: 5 };

		it('passes when the program is in the modality and the code is free', async () => {
			mockRepo.isProgramInModality.mockResolvedValue(true);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanValidation.validateMaintenanceCreate(mockRepo as any, 2, dto),
			).resolves.toBeUndefined();
		});

		it('throws when the program is not in the active modality', async () => {
			mockRepo.isProgramInModality.mockResolvedValue(false);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanValidation.validateMaintenanceCreate(mockRepo as any, 2, dto),
			).rejects.toThrow(HttpException);
		});

		it('throws when the (program, code) already exists', async () => {
			mockRepo.isProgramInModality.mockResolvedValue(true);
			mockRepo.findOneByCondition.mockResolvedValue({ id: 9 });
			await expect(
				StudyPlanValidation.validateMaintenanceCreate(mockRepo as any, 2, dto),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceUpdate', () => {
		const existing = { id: 1, programId: 5, code: 'SP-1' };

		it('passes when neither code nor program change', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			await expect(
				StudyPlanValidation.validateMaintenanceUpdate(mockRepo as any, 1, { code: 'SP-1' }),
			).resolves.toBeUndefined();
			expect(mockRepo.findOneByCondition).not.toHaveBeenCalled();
		});

		it('passes when the new code is free in the program', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				StudyPlanValidation.validateMaintenanceUpdate(mockRepo as any, 1, { code: 'SP-2' }),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				StudyPlanValidation.validateMaintenanceUpdate(mockRepo as any, 999, { code: 'SP-2' }),
			).rejects.toThrow(HttpException);
		});

		it('throws when the new (program, code) collides', async () => {
			mockRepo.findOneById.mockResolvedValue(existing);
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				StudyPlanValidation.validateMaintenanceUpdate(mockRepo as any, 1, { code: 'SP-2' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when no academic periods reference it', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({ academicPeriods: 0 });
			await expect(
				StudyPlanValidation.validateMaintenanceDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				StudyPlanValidation.validateMaintenanceDelete(mockRepo as any, 999),
			).rejects.toThrow(HttpException);
		});

		it('throws 409 when academic periods reference it', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({ academicPeriods: 3 });

			let caught: HttpException | undefined;
			try {
				await StudyPlanValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as HttpException;
			}

			expect(caught!.getStatus()).toBe(409);
			const body = caught!.getResponse() as { message: string; errors: string[] };
			expect(body.message).toBe('error.studyPlan.inUse');
			expect(body.errors).toEqual(['error.studyPlan.usedInAcademicPeriods']);
		});
	});
});
