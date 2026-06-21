import { DomainError } from 'src/commons/domain-error';
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
			).rejects.toThrow(DomainError);
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
				DomainError,
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
				DomainError,
			);
		});
	});

	describe('validateMaintenanceCreate', () => {
		const dto = { code: 'P1', firstName: 'John', lastName: 'Doe' };

		it('passes when the code is free', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				ProfessorValidation.validateMaintenanceCreate(mockRepo as any, dto),
			).resolves.toBeUndefined();
		});

		it('throws when the code already exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 9, code: 'P1' });
			await expect(
				ProfessorValidation.validateMaintenanceCreate(mockRepo as any, dto),
			).rejects.toThrow(DomainError);
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
			).rejects.toThrow(DomainError);
		});

		it('throws when the new code belongs to another professor', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, code: 'P1' });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2, code: 'P2' });
			await expect(
				ProfessorValidation.validateMaintenanceUpdate(mockRepo as any, 1, { code: 'P2' }),
			).rejects.toThrow(DomainError);
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
			).rejects.toThrow(DomainError);
		});

		it('throws 409 naming the exact blocking relations', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, staffId: 10 });
			mockRepo.findDeleteBlockerCounts.mockResolvedValue({
				...noBlockers,
				courseSections: 3,
				charts: 1,
			});

			let caught: DomainError | undefined;
			try {
				await ProfessorValidation.validateMaintenanceDelete(mockRepo as any, 1);
			} catch (e) {
				caught = e as DomainError;
			}

			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('conflict');
			const body = caught!;
			expect(body.message).toBe('error.professor.inUse');
			expect(body.errors).toEqual([
				'error.professor.usedInCourseSections',
				'error.professor.usedInCharts',
			]);
		});
	});
});
