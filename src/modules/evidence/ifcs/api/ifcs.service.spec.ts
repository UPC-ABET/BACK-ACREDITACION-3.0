import { DataSource } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { IfcService } from './ifcs.service';
import { IfcRepository } from '../core/ifcs.repository';
import { ListIfcsDto, RejectIfcDto } from '../model/ifcs.dtos';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { IFCS_PARAMETER_KEYS } from './ifcs.constants';

describe('IfcService.list', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };
	const repository = {} as IfcRepository;

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		service = new IfcService(repository, dataSource as unknown as DataSource);
	});

	it('forwards chart_ids, period_id, and the COURSE type code to the SQL query', async () => {
		const expected = [
			{ chart_id: 310, course_code: 'CRS_FUND_PROG', ifc: null },
			{ chart_id: 311, course_code: 'CRS_REQ_ENG', ifc: { id: 1, status_code: 'TG701-T001' } },
		];
		dataSource.query.mockResolvedValueOnce(expected);

		const dto: ListIfcsDto = { chart_ids: [310, 311], period_id: 5 };
		const result = await service.list(dto);

		expect(result).toBe(expected);
		expect(dataSource.query).toHaveBeenCalledTimes(1);
		const [, params] = dataSource.query.mock.calls[0];
		expect(params).toEqual([[310, 311], 5, TYPE_CODES.ENTITY_TYPE.COURSE]);
	});

	it('returns whatever the DataSource returns (passthrough)', async () => {
		dataSource.query.mockResolvedValueOnce([]);

		const result = await service.list({ chart_ids: [1], period_id: 1 });

		expect(result).toEqual([]);
	});
});

describe('IfcService.getView', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };
	const repository = {} as IfcRepository;

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		service = new IfcService(repository, dataSource as unknown as DataSource);
	});

	const headerRow = {
		ifc_id: 42,
		information: { foo: 'bar' },
		extra: {},
		ifc_created_at: '2026-01-01T00:00:00Z',
		academic_period_code: 'AP_2026_1',
		area_label: { es: 'Área' },
		subarea_label: { es: 'Subárea' },
		course_name: { es: 'Curso' },
		course_learning_outcome: { es: 'LO' },
		coordinator_user_id: '7',
		coordinator_code: 'PROF-001',
		coordinator_name: 'Ada Lovelace',
		status_code: 'TG701-T002',
		status_name: { es: 'Enviado' },
		status_at: '2026-01-02T00:00:00Z',
		status_comment: null,
		status_by_name: 'Ada Lovelace',
	};

	it('calls the five SQL queries with the correct positional params', async () => {
		dataSource.query
			.mockResolvedValueOnce([headerRow]) // HEADER
			.mockResolvedValueOnce([{ finding_id: 1 }]) // FINDINGS
			.mockResolvedValueOnce([]) // OUTCOME_COURSE
			.mockResolvedValueOnce([]) // FINDING_OUTCOMES
			.mockResolvedValueOnce([]); // FINDING_ACTIONS

		await service.getView(42, 9);

		expect(dataSource.query).toHaveBeenCalledTimes(5);

		const [, headerParams] = dataSource.query.mock.calls[0];
		expect(headerParams).toEqual([42, 9, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL]);

		const [, findingParams] = dataSource.query.mock.calls[1];
		expect(findingParams).toEqual([42, IFCS_PARAMETER_KEYS.FINDING_PREFIX]);

		const [, outcomeParams] = dataSource.query.mock.calls[2];
		expect(outcomeParams).toEqual([42]);

		const [, finOutcomeParams] = dataSource.query.mock.calls[3];
		expect(finOutcomeParams).toEqual([[1]]);

		const [, finActionParams] = dataSource.query.mock.calls[4];
		expect(finActionParams).toEqual([[1], IFCS_PARAMETER_KEYS.ACTION_PREFIX, TYPE_CODES.ACTION_COMPLETENESS.PENDING, TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED]);
	});

	it('throws 404 when headerRows is empty', async () => {
		dataSource.query
			.mockResolvedValueOnce([]) // HEADER empty
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		await expect(service.getView(42, 9)).rejects.toMatchObject({
			status: HttpStatus.NOT_FOUND,
		});
	});

	it('skips finding outcome / action queries when no findings exist', async () => {
		dataSource.query
			.mockResolvedValueOnce([headerRow])
			.mockResolvedValueOnce([]) // no findings
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 9);

		expect(dataSource.query).toHaveBeenCalledTimes(3);
		expect(result.findings).toEqual([]);
	});

	it('emits status: null when the header has no status_code', async () => {
		const noStatus = { ...headerRow, status_code: null, status_name: null, status_at: null };
		dataSource.query.mockResolvedValueOnce([noStatus]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		const result = await service.getView(42, 9);

		expect(result.ifc.status).toBeNull();
	});
});

describe('IfcService status transitions', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };
	const repository = {} as IfcRepository;

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		service = new IfcService(repository, dataSource as unknown as DataSource);
	});

	const ctxRow = (overrides: Partial<{ ifc_course_staff_id: number | null; requester_staff_id: number | null; current_status_code: string | null }> = {}) => [
		{
			ifc_course_staff_id: 11,
			requester_staff_id: 11,
			current_status_code: null,
			...overrides,
		},
	];

	const insertedRow = { code: 'TG701-T002', name: { es: 'Enviado' }, at: '2026-01-01', comment: null, by: 'Ada' };

	it('submit: succeeds when requester is course coordinator and IFC is unregistered', async () => {
		dataSource.query.mockResolvedValueOnce(ctxRow({ current_status_code: null })).mockResolvedValueOnce([insertedRow]);

		const result = await service.submit(42, 99, 9);

		expect(result).toBe(insertedRow);
		const [, insertParams] = dataSource.query.mock.calls[1];
		expect(insertParams[0]).toBe(42);
		expect(insertParams[1]).toBe(TYPE_CODES.IFC_STATUS.SUBMITTED);
		expect(insertParams[2]).toBe(11);
		expect(insertParams[3]).toBeNull();
	});

	it('submit: rejects with 409 when current status is already SUBMITTED', async () => {
		dataSource.query.mockResolvedValueOnce(ctxRow({ current_status_code: TYPE_CODES.IFC_STATUS.SUBMITTED }));

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
	});

	it('submit: rejects with 403 when requester is not the course coordinator', async () => {
		dataSource.query.mockResolvedValueOnce(ctxRow({ ifc_course_staff_id: 22, requester_staff_id: 11, current_status_code: null }));

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
	});

	it('approve: rejects with 403 when requester is the own coordinator', async () => {
		dataSource.query.mockResolvedValueOnce(ctxRow({ ifc_course_staff_id: 11, requester_staff_id: 11, current_status_code: TYPE_CODES.IFC_STATUS.SUBMITTED }));

		await expect(service.approve(42, 99, 9)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
	});

	it('approve: succeeds when requester is a different staff and IFC is SUBMITTED', async () => {
		dataSource.query
			.mockResolvedValueOnce(ctxRow({ ifc_course_staff_id: 11, requester_staff_id: 22, current_status_code: TYPE_CODES.IFC_STATUS.SUBMITTED }))
			.mockResolvedValueOnce([{ ...insertedRow, code: 'TG701-T003' }]);

		const result = await service.approve(42, 99, 9);

		expect(result.code).toBe('TG701-T003');
		const [, insertParams] = dataSource.query.mock.calls[1];
		expect(insertParams[1]).toBe(TYPE_CODES.IFC_STATUS.APPROVED);
		expect(insertParams[3]).toBeNull();
	});

	it('reject: inserts a status with comment populated and status_type_id=OBSERVED', async () => {
		const dto: RejectIfcDto = { comment: { es: 'falta', en: 'missing' } };
		dataSource.query
			.mockResolvedValueOnce(ctxRow({ ifc_course_staff_id: 11, requester_staff_id: 22, current_status_code: TYPE_CODES.IFC_STATUS.SUBMITTED }))
			.mockResolvedValueOnce([{ ...insertedRow, code: 'TG701-T004', comment: dto.comment }]);

		const result = await service.reject(42, 99, 9, dto);

		expect(result.code).toBe('TG701-T004');
		const [, insertParams] = dataSource.query.mock.calls[1];
		expect(insertParams[1]).toBe(TYPE_CODES.IFC_STATUS.OBSERVED);
		expect(JSON.parse(insertParams[3])).toEqual(dto.comment);
	});

	it('throws 404 when the IFC is not in the requester school', async () => {
		dataSource.query.mockResolvedValueOnce([]);

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND, message: expect.anything() });
	});

	it('throws an HttpException when the IFC is not in the requester school', async () => {
		dataSource.query.mockResolvedValueOnce([]);

		await expect(service.submit(42, 99, 9)).rejects.toBeInstanceOf(HttpException);
	});

	it('throws 403 when the requester has no staff record', async () => {
		dataSource.query.mockResolvedValueOnce(ctxRow({ requester_staff_id: null }));

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
	});
});
