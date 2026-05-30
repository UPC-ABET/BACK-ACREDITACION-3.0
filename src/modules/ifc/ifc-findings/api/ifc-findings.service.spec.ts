import { DataSource } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { IfcFindingService } from './ifc-findings.service';
import { IfcFindingRepository } from '../core/ifc-findings.repository';
import { IfcFindingValidation } from '../core/ifc-findings.validation';
import { IfcValidation } from 'src/modules/evidence/ifcs/core/ifcs.validation';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { IFCS_PARAMETER_KEYS } from 'src/modules/evidence/ifcs/api/ifcs.constants';

describe('IfcFindingService.getDetail', () => {
	let service: IfcFindingService;
	let dataSource: { query: jest.Mock };
	const repository = {} as IfcFindingRepository;

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		service = new IfcFindingService(repository, dataSource as unknown as DataSource);
	});

	const headerRow = {
		id: 201,
		findingCode: 'H-INST_IFC-CRS_FUND_PROG-2026001',
		academicPeriodCode: 'AP_2026_1',
		description: { es: 'Hallazgo' },
		criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
		criticalityName: { es: 'Normal' },
	};

	const actionRow = {
		id: 301,
		actionCode: 'A-INST_IFC-CRS_FUND_PROG-2026101',
		description: { es: 'Acción' },
		completenessCode: TYPE_CODES.ACTION_COMPLETENESS.PENDING,
		completenessName: { es: 'Pendiente' },
		completenessColor: '#71717A',
	};

	it('issues both queries with the expected positional params and TYPE_CODES constants', async () => {
		dataSource.query.mockResolvedValueOnce([headerRow]).mockResolvedValueOnce([actionRow]);

		await service.getDetail(201, 9);

		expect(dataSource.query).toHaveBeenCalledTimes(2);

		const [, headerParams] = dataSource.query.mock.calls[0];
		expect(headerParams).toEqual([
			201,
			9,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
		]);

		const [, actionParams] = dataSource.query.mock.calls[1];
		expect(actionParams).toEqual([
			201,
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
		]);
	});

	it('shapes the response with the finding header + criticality + actions[]', async () => {
		dataSource.query.mockResolvedValueOnce([headerRow]).mockResolvedValueOnce([actionRow]);

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
		dataSource.query.mockResolvedValue([]);

		await expect(service.getDetail(201, 9)).rejects.toBeInstanceOf(HttpException);
		await expect(service.getDetail(201, 9)).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
	});
});

describe('IfcFindingService.patch', () => {
	let service: IfcFindingService;
	let dataSource: { query: jest.Mock; transaction: jest.Mock };
	let em: { query: jest.Mock };
	const repository = {} as IfcFindingRepository;

	let assertFindingExistsSpy: jest.SpyInstance;
	let resolveCourseChartSpy: jest.SpyInstance;
	let assertIsInCourseChainSpy: jest.SpyInstance;

	beforeEach(() => {
		em = { query: jest.fn() };
		dataSource = {
			query: jest.fn(),
			transaction: jest.fn(async (fn: any) => fn(em)),
		};
		service = new IfcFindingService(repository, dataSource as unknown as DataSource);

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
		// em.query call order: staff lookup → school check → UPDATE
		em.query
			.mockResolvedValueOnce([{ id: 11 }]) // staff lookup
			.mockResolvedValueOnce([{ '?column?': 1 }]) // school check
			.mockResolvedValueOnce(undefined); // UPDATE

		const result = await service.patch(201, dto, 7, 9);

		expect(result).toEqual({ id: 201 });
		expect(dataSource.transaction).toHaveBeenCalledTimes(1);

		const updateCall = em.query.mock.calls[2];
		expect(updateCall[0]).toMatch(/UPDATE improvement\.findings/);
		expect(updateCall[1]).toEqual([JSON.stringify(dto.description), 201]);
	});

	it('passes the resolved courseChartId + requester staff_id to assertIsInCourseChain', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }])
			.mockResolvedValueOnce(undefined);

		await service.patch(201, dto, 7, 9);

		expect(assertFindingExistsSpy).toHaveBeenCalledWith(em, 201);
		expect(resolveCourseChartSpy).toHaveBeenCalledWith(
			em,
			100,
			5,
			TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR,
		);
		expect(assertIsInCourseChainSpy).toHaveBeenCalledTimes(1);
		const ctx = assertIsInCourseChainSpy.mock.calls[0][1];
		expect(ctx.courseChartId).toBe(500);
		expect(ctx.requesterStaffId).toBe(11);
	});

	it('rejects 403 when the requester has no staff record', async () => {
		em.query.mockResolvedValueOnce([]); // staff lookup returns no rows

		await expect(service.patch(201, dto, 7, 9)).rejects.toMatchObject({
			status: HttpStatus.FORBIDDEN,
		});
	});

	it('rejects 404 when the finding is in a different school (school check fails)', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 11 }]) // staff lookup
			.mockResolvedValueOnce([]); // school check empty

		await expect(service.patch(201, dto, 7, 9)).rejects.toMatchObject({
			status: HttpStatus.NOT_FOUND,
		});
		// UPDATE must not run
		expect(
			em.query.mock.calls.find((c) => /UPDATE improvement\.findings/.test(c[0])),
		).toBeUndefined();
	});

	it('rolls back the transaction when any inner em.query throws', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }])
			.mockRejectedValueOnce(new Error('DB explosion'));

		await expect(service.patch(201, dto, 7, 9)).rejects.toThrow('DB explosion');
		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
	});
});
