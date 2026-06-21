import { EntityManager } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { IfcFindingService } from './ifc-findings.service';
import { IfcFindingRepository } from '../core/ifc-findings.repository';
import { IfcFindingValidation } from '../core/ifc-findings.validation';
import { IfcValidation } from 'src/modules/evidence/ifcs/core/ifcs.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { IFCS_PARAMETER_KEYS } from 'src/modules/evidence/ifcs/api/ifcs.constants';

describe('IfcFindingService.getDetail', () => {
	let service: IfcFindingService;
	let repository: {
		getFindingHeader: jest.Mock;
		getFindingActions: jest.Mock;
	};

	beforeEach(() => {
		repository = {
			getFindingHeader: jest.fn(),
			getFindingActions: jest.fn(),
		};
		service = new IfcFindingService(repository as unknown as IfcFindingRepository);
	});

	const headerRow = {
		id: 201,
		findingCode: 'H-IFC-CRS_FUND_PROG-2026001',
		academicPeriodCode: 'AP_2026_1',
		description: { es: 'Hallazgo' },
		criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
		criticalityName: { es: 'Normal' },
	};

	const actionRow = {
		id: 301,
		actionCode: 'A-IFC-CRS_FUND_PROG-2026101',
		description: { es: 'Acción' },
		completenessCode: TYPE_CODES.ACTION_COMPLETENESS.PENDING,
		completenessName: { es: 'Pendiente' },
		completenessColor: '#71717A',
	};

	it('issues both queries with the expected params and TYPE_CODES constants', async () => {
		repository.getFindingHeader.mockResolvedValueOnce([headerRow]);
		repository.getFindingActions.mockResolvedValueOnce([actionRow]);

		await service.getDetail(201, 9);

		expect(repository.getFindingHeader).toHaveBeenCalledWith(
			201,
			9,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		);

		expect(repository.getFindingActions).toHaveBeenCalledWith(
			201,
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
		);
	});

	it('shapes the response with the finding header + criticality + actions[]', async () => {
		repository.getFindingHeader.mockResolvedValueOnce([headerRow]);
		repository.getFindingActions.mockResolvedValueOnce([actionRow]);

		const result = await service.getDetail(201, 9);

		expect(result).toEqual({
			finding: {
				id: 201,
				findingCode: headerRow.findingCode,
				academicPeriodCode: headerRow.academicPeriodCode,
				description: headerRow.description,
				criticality: {
					code: headerRow.criticalityCode,
					name: headerRow.criticalityName,
					color: null,
				},
			},
			actions: [
				{
					id: actionRow.id,
					actionCode: actionRow.actionCode,
					description: actionRow.description,
					completeness: {
						code: actionRow.completenessCode,
						name: actionRow.completenessName,
						color: actionRow.completenessColor,
					},
				},
			],
		});
	});

	it('throws 404 when findingRows is empty (including cross-school)', async () => {
		repository.getFindingHeader.mockResolvedValue([]);
		repository.getFindingActions.mockResolvedValue([]);

		await expect(service.getDetail(201, 9)).rejects.toBeInstanceOf(HttpException);
		await expect(service.getDetail(201, 9)).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
	});
});

describe('IfcFindingService.patch', () => {
	let service: IfcFindingService;
	let repository: {
		runInTransaction: jest.Mock;
		findRequesterStaffId: jest.Mock;
		isFindingInSchool: jest.Mock;
		updateFindingDescription: jest.Mock;
	};
	const em = {} as EntityManager;

	let assertFindingExistsSpy: jest.SpyInstance;
	let resolveCourseChartSpy: jest.SpyInstance;
	let assertIsInCourseChainSpy: jest.SpyInstance;

	beforeEach(() => {
		repository = {
			runInTransaction: jest.fn(async (fn: (manager: EntityManager) => Promise<unknown>) => fn(em)),
			findRequesterStaffId: jest.fn(),
			isFindingInSchool: jest.fn(),
			updateFindingDescription: jest.fn(),
		};
		service = new IfcFindingService(repository as unknown as IfcFindingRepository);

		assertFindingExistsSpy = jest
			.spyOn(IfcFindingValidation, 'assertFindingExists')
			.mockResolvedValue({ id: 201, courseId: 100, academicPeriodId: 5 });
		resolveCourseChartSpy = jest
			.spyOn(IfcFindingValidation, 'resolveCourseChart')
			.mockResolvedValue({ id: 500, staffId: 11 });
		assertIsInCourseChainSpy = jest
			.spyOn(IfcValidation, 'assertIsInCourseChain')
			.mockResolvedValue(undefined as unknown as void);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const dto = { description: { es: 'Nueva', en: 'New' } };

	it('happy path: runs the UPDATE inside a single transaction and returns { id }', async () => {
		repository.findRequesterStaffId.mockResolvedValue(11);
		repository.isFindingInSchool.mockResolvedValue(true);
		repository.updateFindingDescription.mockResolvedValue(undefined);

		const result = await service.patch(201, dto, 7, 9);

		expect(result).toEqual({ id: 201 });
		expect(repository.runInTransaction).toHaveBeenCalledTimes(1);
		expect(repository.updateFindingDescription).toHaveBeenCalledWith(em, 201, dto.description);
	});

	it('passes the resolved courseChartId + requester staff_id to assertIsInCourseChain', async () => {
		repository.findRequesterStaffId.mockResolvedValue(11);
		repository.isFindingInSchool.mockResolvedValue(true);
		repository.updateFindingDescription.mockResolvedValue(undefined);

		await service.patch(201, dto, 7, 9);

		expect(assertFindingExistsSpy).toHaveBeenCalledWith(em, 201);
		expect(resolveCourseChartSpy).toHaveBeenCalledWith(em, 100, 5, TYPE_CODES.ENTITY_TYPE.COURSE);
		expect(assertIsInCourseChainSpy).toHaveBeenCalledTimes(1);
		const ctx = assertIsInCourseChainSpy.mock.calls[0][1];
		expect(ctx.courseChartId).toBe(500);
		expect(ctx.requesterStaffId).toBe(11);
	});

	it('rejects 403 when the requester has no staff record', async () => {
		repository.findRequesterStaffId.mockResolvedValue(null);

		await expect(service.patch(201, dto, 7, 9)).rejects.toMatchObject({
			status: HttpStatus.FORBIDDEN,
		});
	});

	it('rejects 404 when the finding is in a different school (school check fails)', async () => {
		repository.findRequesterStaffId.mockResolvedValue(11);
		repository.isFindingInSchool.mockResolvedValue(false);

		await expect(service.patch(201, dto, 7, 9)).rejects.toMatchObject({
			status: HttpStatus.NOT_FOUND,
		});
		expect(repository.updateFindingDescription).not.toHaveBeenCalled();
	});

	it('rolls back the transaction when an inner repository call throws', async () => {
		repository.findRequesterStaffId.mockResolvedValue(11);
		repository.isFindingInSchool.mockResolvedValue(true);
		repository.updateFindingDescription.mockRejectedValue(new Error('DB explosion'));

		await expect(service.patch(201, dto, 7, 9)).rejects.toThrow('DB explosion');
		expect(repository.runInTransaction).toHaveBeenCalledTimes(1);
	});
});
