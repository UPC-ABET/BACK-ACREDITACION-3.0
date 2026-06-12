import { HttpException } from '@nestjs/common';
import { ProfessorValidation } from './professors.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	findDeleteBlockerCounts: jest.fn(),
};

const noBlockers = {
	courseSections: 0,
	projectEvaluators: 0,
	charts: 0,
	findings: 0,
	ifcStatuses: 0,
	otherProfessors: 0,
};

describe('ProfessorValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				ProfessorValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				ProfessorValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				ProfessorValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(ProfessorValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				HttpException,
			);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(ProfessorValidation.validateDelete(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(ProfessorValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				HttpException,
			);
		});
	});

	describe('validateMaintenanceUpdate', () => {
		it('passes when the code is unchanged', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, code: 'P1' });
			await expect(
				ProfessorValidation.validateMaintenanceUpdate(mockRepo as any, 1, { code: 'P1' }),
			).resolves.toBeUndefined();
			expect(mockRepo.findOneByCondition).not.toHaveBeenCalled();
		});

		it('passes when the new code is free', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, code: 'P1' });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				ProfessorValidation.validateMaintenanceUpdate(mockRepo as any, 1, { code: 'P2' }),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				ProfessorValidation.validateMaintenanceUpdate(mockRepo as any, 999, { code: 'P2' }),
			).rejects.toThrow(HttpException);
		});

		it('throws when the new code belongs to another professor', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, code: 'P1' });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2, code: 'P2' });
			await expect(
				ProfessorValidation.validateMaintenanceUpdate(mockRepo as any, 1, { code: 'P2' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when nothing references the professor or staff', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, staffId: 10 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue(noBlockers);
			await expect(
				ProfessorValidation.validateMaintenanceDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(
				ProfessorValidation.validateMaintenanceDelete(mockRepo as any, 999),
			).rejects.toThrow(HttpException);
		});

		it('throws 409 naming the exact blocking relations', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, staffId: 10 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({
				...noBlockers,
				courseSections: 3,
				charts: 1,
			});

			let caught: HttpException | undefined;
			try {
				await ProfessorValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as HttpException;
			}

			expect(caught).toBeInstanceOf(HttpException);
			expect(caught!.getStatus()).toBe(409);
			const body = caught!.getResponse() as { message: string; errors: string[] };
			expect(body.message).toBe('error.professor.inUse');
			expect(body.errors).toEqual([
				'error.professor.usedInCourseSections',
				'error.professor.usedInCharts',
			]);
		});
	});
});
