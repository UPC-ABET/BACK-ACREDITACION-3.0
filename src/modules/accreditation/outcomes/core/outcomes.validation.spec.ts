import { HttpException } from '@nestjs/common';
import { OutcomeValidation } from './outcomes.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
};

const noBlockers = {
	courseOutcomeMappings: 0,
	rubricQuestions: 0,
	studentCourseOutcomeGrades: 0,
	findingOutcomes: 0,
	outcomeConfigs: 0,
	scores: 0,
};

describe('OutcomeValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				OutcomeValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				OutcomeValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				OutcomeValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(OutcomeValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				HttpException,
			);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(OutcomeValidation.validateDelete(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(OutcomeValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				HttpException,
			);
		});
	});

	describe('validateMaintenanceUpdate', () => {
		it('passes when the code is unchanged', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, programCommissionId: 5, outcomeCode: 'O1' });
			await expect(
				OutcomeValidation.validateMaintenanceUpdate(mockRepo as any, 1, { outcomeCode: 'O1' }),
			).resolves.toBeUndefined();
			expect(mockRepo.findOneByCondition).not.toHaveBeenCalled();
		});

		it('passes when the new code is free within the program commission', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, programCommissionId: 5, outcomeCode: 'O1' });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				OutcomeValidation.validateMaintenanceUpdate(mockRepo as any, 1, { outcomeCode: 'O2' }),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				OutcomeValidation.validateMaintenanceUpdate(mockRepo as any, 999, { outcomeCode: 'O2' }),
			).rejects.toThrow(HttpException);
		});

		it('throws when the new code is taken by another outcome in the same program commission', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, programCommissionId: 5, outcomeCode: 'O1' });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2, outcomeCode: 'O2' });
			await expect(
				OutcomeValidation.validateMaintenanceUpdate(mockRepo as any, 1, { outcomeCode: 'O2' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when nothing references the outcome', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue(noBlockers);
			await expect(
				OutcomeValidation.validateMaintenanceDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				OutcomeValidation.validateMaintenanceDelete(mockRepo as any, 999),
			).rejects.toThrow(HttpException);
		});

		it('throws 409 naming the exact blocking relations', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({ ...noBlockers, scores: 2, rubricQuestions: 1 });

			let caught: HttpException | undefined;
			try {
				await OutcomeValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as HttpException;
			}

			expect(caught).toBeInstanceOf(HttpException);
			expect(caught!.getStatus()).toBe(409);
			const body = caught!.getResponse() as { message: string; errors: string[] };
			expect(body.message).toBe('error.outcome.inUse');
			expect(body.errors).toEqual([
				'error.outcome.usedInRubricQuestions',
				'error.outcome.usedInScores',
			]);
		});
	});
});
