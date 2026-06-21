import { DomainError } from 'src/commons/domain-error';
import { IfcFindingValidation } from './ifc-findings.validation';

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
};

const mockEm = {
	query: jest.fn(),
};

describe('IfcFindingValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when the (ifc, finding) relation does not exist', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				IfcFindingValidation.validateCreate(mockRepo as any, { ifcId: 1, findingId: 2 }),
			).resolves.toBeUndefined();
		});

		it('throws when the relation already exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				IfcFindingValidation.validateCreate(mockRepo as any, { ifcId: 1, findingId: 2 }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateUpdate', () => {
		it('passes when the entity exists and there is no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, ifcId: 1, findingId: 2 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				IfcFindingValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('passes when the only match is the entity itself', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, ifcId: 1, findingId: 2 });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				IfcFindingValidation.validateUpdate(mockRepo as any, 1, {}),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(IfcFindingValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when the new (ifc, finding) collides with another row', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1, ifcId: 1, findingId: 2 });
			mockRepo.findOneByCondition.mockResolvedValue({ id: 2 });
			await expect(
				IfcFindingValidation.validateUpdate(mockRepo as any, 1, { findingId: 9 }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when the entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(
				IfcFindingValidation.validateDelete(mockRepo as any, 1),
			).resolves.toBeUndefined();
		});

		it('throws when the entity is not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(IfcFindingValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				DomainError,
			);
		});
	});

	describe('assertFindingExists', () => {
		it('returns the finding row when it exists', async () => {
			const row = { id: 3, courseId: 10, academicPeriodId: 7 };
			mockEm.query.mockResolvedValue([row]);
			await expect(IfcFindingValidation.assertFindingExists(mockEm as any, 3)).resolves.toEqual(
				row,
			);
		});

		it('throws 404 when the finding does not exist', async () => {
			mockEm.query.mockResolvedValue([]);
			let caught: DomainError | undefined;
			try {
				await IfcFindingValidation.assertFindingExists(mockEm as any, 999);
			} catch (e) {
				caught = e as DomainError;
			}
			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('notFound');
		});
	});

	describe('resolveCourseChart', () => {
		it('returns the chart row when found', async () => {
			const row = { id: 50, staffId: 4 };
			mockEm.query.mockResolvedValue([row]);
			await expect(
				IfcFindingValidation.resolveCourseChart(mockEm as any, 10, 7, 'COURSE'),
			).resolves.toEqual(row);
		});

		it('throws 404 when no course chart is found', async () => {
			mockEm.query.mockResolvedValue([]);
			let caught: DomainError | undefined;
			try {
				await IfcFindingValidation.resolveCourseChart(mockEm as any, 10, 7, 'COURSE');
			} catch (e) {
				caught = e as DomainError;
			}
			expect(caught).toBeInstanceOf(DomainError);
			expect(caught!.kind).toBe('notFound');
		});
	});
});
