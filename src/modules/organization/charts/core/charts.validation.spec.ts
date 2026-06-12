import { HttpException } from '@nestjs/common';
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
};

describe('ChartValidation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCreate', () => {
		it('passes when no duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(
				ChartValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).resolves.toBeUndefined();
		});

		it('throws when duplicate exists', async () => {
			mockRepo.findOneByCondition.mockResolvedValue({ id: 1 });
			await expect(
				ChartValidation.validateCreate(mockRepo as any, { name: 'test' }),
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateUpdate', () => {
		it('passes when entity exists and no conflict', async () => {
			mockRepo.findOneById.mockResolvedValue({ id: 1 });
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(ChartValidation.validateUpdate(mockRepo as any, 1, {})).resolves.toBeUndefined();
		});

		it('throws when entity not found', async () => {
			mockRepo.findOneById.mockResolvedValue(null);
			mockRepo.findOneByCondition.mockResolvedValue(null);
			await expect(ChartValidation.validateUpdate(mockRepo as any, 999, {})).rejects.toThrow(
				HttpException,
			);
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
				HttpException,
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
			await expect(
				ChartValidation.validateMaintenanceCreate(mockRepo as any, 100, courseDto),
			).resolves.toBeUndefined();
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
			).rejects.toThrow(HttpException);
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
			).rejects.toThrow(HttpException);
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
			).rejects.toThrow(HttpException);
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
			).rejects.toThrow(HttpException);
		});
	});

	describe('validateMaintenanceDelete', () => {
		it('passes when not read-only and no IFC in subtree', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.PROGRAM });
			mockRepo.countCourseIfcInSubtree.mockResolvedValue(0);
			await expect(
				ChartValidation.validateMaintenanceDelete(mockRepo as any, 5),
			).resolves.toBeUndefined();
		});

		it('throws when a descendant course has an IFC', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.PROGRAM });
			mockRepo.countCourseIfcInSubtree.mockResolvedValue(2);
			await expect(ChartValidation.validateMaintenanceDelete(mockRepo as any, 5)).rejects.toThrow(
				HttpException,
			);
		});

		it('throws when deleting a read-only node', async () => {
			mockRepo.getNodeWithType.mockResolvedValue({ id: 5, entityTypeCode: ENTITY.SCHOOL });
			mockRepo.countCourseIfcInSubtree.mockResolvedValue(0);
			await expect(ChartValidation.validateMaintenanceDelete(mockRepo as any, 5)).rejects.toThrow(
				HttpException,
			);
		});
	});
});
