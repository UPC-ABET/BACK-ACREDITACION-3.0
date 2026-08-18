import { DomainError } from 'src/commons/domain-error';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { ChartValidation } from './charts.validation';

const ENTITY = TYPE_CODES.ENTITY_TYPE;

const mockRepo = {
	findOneByCondition: jest.fn(),
	findOneById: jest.fn(),
	getNodeWithType: jest.fn(),
	staffExists: jest.fn(),
	getEntityTypeCode: jest.fn(),
	entityExists: jest.fn(),
	countCourseIfcInSubtree: jest.fn(),
	findActiveNodeByEntity: jest.fn(),
	hasProgramAncestor: jest.fn(),
};

describe('ChartValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		const createDto = { staffId: 3, academicPeriodId: 100, entityTypeId: 9, entityCode: 50 };

		it('passes when the entity has no active node in the period', async () => {
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(
				ChartValidation.validateCreate(mockRepo as any, createDto),
			).resolves.toBeUndefined();
			expect(mockRepo.findActiveNodeByEntity).toHaveBeenCalledWith(100, 9, 50);
		});

		it('throws when the entity already has an active node, whatever the staff', async () => {
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 77 });
			await expect(
				ChartValidation.validateCreate(mockRepo as any, { ...createDto, staffId: 999 }),
			).rejects.toThrow(DomainError);
		});

		it('allows one staff two nodes that the old staff-based rule rejected', async () => {
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(
				ChartValidation.validateCreate(mockRepo as any, { ...createDto, entityTypeId: 12 }),
			).resolves.toBeUndefined();
		});

		it('does not check uniqueness without an entity code', async () => {
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 77 });
			await expect(
				ChartValidation.validateCreate(mockRepo as any, { staffId: 3, academicPeriodId: 100 }),
			).resolves.toBeUndefined();
			expect(mockRepo.findActiveNodeByEntity).not.toHaveBeenCalled();
		});

		it('skips the ancestor check and type lookup when entityTypeId is absent', async () => {
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await ChartValidation.validateCreate(mockRepo as any, { staffId: 3, academicPeriodId: 100 });
			expect(mockRepo.getEntityTypeCode).not.toHaveBeenCalled();
			expect(mockRepo.hasProgramAncestor).not.toHaveBeenCalled();
		});

		it('passes creating a course with a program ancestor', async () => {
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			mockRepo.hasProgramAncestor.mockResolvedValue(true);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(
				ChartValidation.validateCreate(mockRepo as any, { ...createDto, rootChartId: 3 }),
			).resolves.toBeUndefined();
			expect(mockRepo.hasProgramAncestor).toHaveBeenCalledWith(3);
		});

		it('throws creating a course with no rootChartId at all', async () => {
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			mockRepo.hasProgramAncestor.mockResolvedValue(false);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(ChartValidation.validateCreate(mockRepo as any, createDto)).rejects.toThrow(
				DomainError,
			);
			expect(mockRepo.hasProgramAncestor).toHaveBeenCalledWith(null);
		});

		it('throws creating a program directly (read-only)', async () => {
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.PROGRAM);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(
				ChartValidation.validateCreate(mockRepo as any, { ...createDto, rootChartId: 3 }),
			).rejects.toThrow(DomainError);
			expect(mockRepo.hasProgramAncestor).not.toHaveBeenCalled();
		});
	});

	describe('validateUpdate', () => {
		const storedNode = { id: 1, academicPeriodId: 100, entityTypeId: 9, entityCode: 50 };

		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue(storedNode);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(ChartValidation.validateUpdate(mockRepo as any, 1, {})).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(ChartValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when the update lands on another active node in the period', async () => {
			mockRepo.findOneById.mockResolvedValue(storedNode);
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 2 });
			await expect(
				ChartValidation.validateUpdate(mockRepo as any, 1, { entityCode: 51 }),
			).rejects.toThrow(DomainError);
			expect(mockRepo.findActiveNodeByEntity).toHaveBeenCalledWith(100, 9, 51);
		});

		it('passes when the node keeps its own trio', async () => {
			mockRepo.findOneById.mockResolvedValue(storedNode);
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 1 });
			await expect(
				ChartValidation.validateUpdate(mockRepo as any, 1, { staffId: 5 }),
			).resolves.toBeUndefined();
			expect(mockRepo.hasProgramAncestor).not.toHaveBeenCalled();
		});

		it('throws moving a course-typed node onto a parent with no program ancestor', async () => {
			mockRepo.findOneById.mockResolvedValue({ ...storedNode, entityTypeId: 9 });
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			mockRepo.hasProgramAncestor.mockResolvedValue(false);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(
				ChartValidation.validateUpdate(mockRepo as any, 1, { rootChartId: 8 }),
			).rejects.toThrow(DomainError);
			expect(mockRepo.hasProgramAncestor).toHaveBeenCalledWith(8);
		});

		it('passes moving a course-typed node onto a parent with a program ancestor', async () => {
			mockRepo.findOneById.mockResolvedValue({ ...storedNode, entityTypeId: 9 });
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			mockRepo.hasProgramAncestor.mockResolvedValue(true);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(
				ChartValidation.validateUpdate(mockRepo as any, 1, { rootChartId: 8 }),
			).resolves.toBeUndefined();
		});

		it('throws re-typing an existing node into program (read-only)', async () => {
			mockRepo.findOneById.mockResolvedValue(storedNode);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.PROGRAM);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(
				ChartValidation.validateUpdate(mockRepo as any, 1, { entityTypeId: 3 }),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateDelete', () => {
		it('passes when entity exists', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			await expect(ChartValidation.validateDelete(mockRepo as any, 1)).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			await expect(ChartValidation.validateDelete(mockRepo as any, 999)).rejects.toThrow(
				DomainError,
			);
		});
	});

	describe('validateMaintenanceCreate', () => {
		const courseDto = { rootChartId: 1, staffId: 2, title: {}, entityTypeId: 9, entityCode: 50 };

		it('passes for a course node under a non-dean parent', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({
				academicPeriodId: 100,
				entityTypeCode: ENTITY.PROGRAM,
			});
			mockRepo.staffExists.mockResolvedValue(true);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			mockRepo.entityExists.mockResolvedValue(true);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			mockRepo.hasProgramAncestor.mockResolvedValue(true);
			await expect(
				ChartValidation.validateMaintenanceCreate(mockRepo as any, 100, courseDto),
			).resolves.toBeUndefined();
		});

		it('throws when the parent has no program ancestor', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({
				academicPeriodId: 100,
				entityTypeCode: ENTITY.PROGRAM,
			});
			mockRepo.staffExists.mockResolvedValue(true);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			mockRepo.entityExists.mockResolvedValue(true);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			mockRepo.hasProgramAncestor.mockResolvedValue(false);
			await expect(
				ChartValidation.validateMaintenanceCreate(mockRepo as any, 100, courseDto),
			).rejects.toThrow(DomainError);
			expect(mockRepo.hasProgramAncestor).toHaveBeenCalledWith(courseDto.rootChartId);
		});

		it('throws when the entity already has an active node in the period', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({
				academicPeriodId: 100,
				entityTypeCode: ENTITY.PROGRAM,
			});
			mockRepo.staffExists.mockResolvedValue(true);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			mockRepo.entityExists.mockResolvedValue(true);
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 77 });
			await expect(
				ChartValidation.validateMaintenanceCreate(mockRepo as any, 100, courseDto),
			).rejects.toThrow(DomainError);
			expect(mockRepo.findActiveNodeByEntity).toHaveBeenCalledWith(100, 9, 50);
		});

		it('does not check uniqueness for an entity type that carries no code', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({
				academicPeriodId: 100,
				entityTypeCode: ENTITY.PROGRAM,
			});
			mockRepo.staffExists.mockResolvedValue(true);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.AREA);
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 77 });
			mockRepo.hasProgramAncestor.mockResolvedValue(true);
			await expect(
				ChartValidation.validateMaintenanceCreate(mockRepo as any, 100, {
					...courseDto,
					entityCode: undefined,
				}),
			).resolves.toBeUndefined();
			expect(mockRepo.findActiveNodeByEntity).not.toHaveBeenCalled();
		});

		it('throws when adding under the dean', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({
				academicPeriodId: 100,
				entityTypeCode: ENTITY.DEAN,
			});
			mockRepo.staffExists.mockResolvedValue(true);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			mockRepo.entityExists.mockResolvedValue(true);
			await expect(
				ChartValidation.validateMaintenanceCreate(mockRepo as any, 100, courseDto),
			).rejects.toThrow(DomainError);
		});

		it('throws when a coded entity type is missing its entityCode', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({
				academicPeriodId: 100,
				entityTypeCode: ENTITY.PROGRAM,
			});
			mockRepo.staffExists.mockResolvedValue(true);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.COURSE);
			await expect(
				ChartValidation.validateMaintenanceCreate(mockRepo as any, 100, {
					...courseDto,
					entityCode: undefined,
				}),
			).rejects.toThrow(DomainError);
		});

		it('throws when creating a read-only (school) type', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({
				academicPeriodId: 100,
				entityTypeCode: ENTITY.DEAN,
			});
			mockRepo.staffExists.mockResolvedValue(true);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.SCHOOL);
			await expect(
				ChartValidation.validateMaintenanceCreate(mockRepo as any, 100, courseDto),
			).rejects.toThrow(DomainError);
		});
	});

	describe('validateMaintenanceUpdate', () => {
		it('passes when editing a non-read-only node title only', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.AREA });
			await expect(
				ChartValidation.validateMaintenanceUpdate(mockRepo as any, 5, { title: {} }),
			).resolves.toBeUndefined();
		});

		it('throws when editing a read-only (school director) node', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.SCHOOL });
			await expect(
				ChartValidation.validateMaintenanceUpdate(mockRepo as any, 5, { title: {} }),
			).rejects.toThrow(DomainError);
		});

		const courseNode = {
			id: 5,
			academicPeriodId: 100,
			rootChartId: 3,
			entityTypeId: 9,
			entityTypeCode: ENTITY.COURSE,
			entityCode: 50,
		};

		it('throws when the edit lands on another active node in the period', async () => {
			mockRepo.getNodeWithType.mockResolvedValue(courseNode);
			mockRepo.entityExists.mockResolvedValue(true);
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 99 });
			await expect(
				ChartValidation.validateMaintenanceUpdate(mockRepo as any, 5, { entityCode: 51 }),
			).rejects.toThrow(DomainError);
		});

		it('passes when the node keeps its own trio', async () => {
			mockRepo.getNodeWithType.mockResolvedValue(courseNode);
			mockRepo.staffExists.mockResolvedValue(true);
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 5 });
			await expect(
				ChartValidation.validateMaintenanceUpdate(mockRepo as any, 5, { staffId: 3 }),
			).resolves.toBeUndefined();
		});

		it('resolves a code-only edit against the node existing entity type', async () => {
			mockRepo.getNodeWithType.mockResolvedValue(courseNode);
			mockRepo.entityExists.mockResolvedValue(true);
			mockRepo.findActiveNodeByEntity.mockResolvedValue(null);
			await expect(
				ChartValidation.validateMaintenanceUpdate(mockRepo as any, 5, { entityCode: 51 }),
			).resolves.toBeUndefined();
			expect(mockRepo.findActiveNodeByEntity).toHaveBeenCalledWith(100, 9, 51);
		});

		it('resolves a type-only edit against the new entity type and drops the code', async () => {
			mockRepo.getNodeWithType.mockResolvedValue(courseNode);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.AREA);
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 99 });
			mockRepo.hasProgramAncestor.mockResolvedValue(true);
			await expect(
				ChartValidation.validateMaintenanceUpdate(mockRepo as any, 5, { entityTypeId: 12 }),
			).resolves.toBeUndefined();
			expect(mockRepo.findActiveNodeByEntity).not.toHaveBeenCalled();
			expect(mockRepo.hasProgramAncestor).toHaveBeenCalledWith(courseNode.rootChartId);
		});

		it('throws re-typing into a course when the node has no program ancestor', async () => {
			mockRepo.getNodeWithType.mockResolvedValue(courseNode);
			mockRepo.getEntityTypeCode.mockResolvedValue(ENTITY.AREA);
			mockRepo.hasProgramAncestor.mockResolvedValue(false);
			await expect(
				ChartValidation.validateMaintenanceUpdate(mockRepo as any, 5, { entityTypeId: 12 }),
			).rejects.toThrow(DomainError);
		});

		it('does not re-check ancestry on a staff/title-only edit', async () => {
			mockRepo.getNodeWithType.mockResolvedValue(courseNode);
			mockRepo.findActiveNodeByEntity.mockResolvedValue({ id: 5 });
			await expect(
				ChartValidation.validateMaintenanceUpdate(mockRepo as any, 5, { staffId: 3 }),
			).resolves.toBeUndefined();
			expect(mockRepo.hasProgramAncestor).not.toHaveBeenCalled();
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when not read-only and no IFC in subtree', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.COURSE });
			mockRepo.countCourseIfcInSubtree.mockResolvedValue(0);
			await expect(
				ChartValidation.validateMaintenanceDelete(mockRepo as any, 5),
			).resolves.toBeUndefined();
		});

		it('throws when a descendant course has an IFC', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.COURSE });
			mockRepo.countCourseIfcInSubtree.mockResolvedValue(2);
			await expect(ChartValidation.validateMaintenanceDelete(mockRepo as any, 5)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when deleting a program (now read-only)', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.PROGRAM });
			mockRepo.countCourseIfcInSubtree.mockResolvedValue(0);
			await expect(ChartValidation.validateMaintenanceDelete(mockRepo as any, 5)).rejects.toThrow(
				DomainError,
			);
		});

		it('throws when deleting a read-only node', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.SCHOOL });
			mockRepo.countCourseIfcInSubtree.mockResolvedValue(0);
			await expect(ChartValidation.validateMaintenanceDelete(mockRepo as any, 5)).rejects.toThrow(
				DomainError,
			);
		});
	});
});
