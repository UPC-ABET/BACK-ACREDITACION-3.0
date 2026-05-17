import { DataSource } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { IfcService } from './ifcs.service';
import { IfcRepository } from '../core/ifcs.repository';
import { ListIfcsDto, RejectIfcDto } from '../model/ifcs.dtos';
import { CreateIfcDto, IfcContentDto } from '../model/ifcs-content.dtos';
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
		requester_in_chain: true,
	};

	it('calls the five SQL queries with the correct positional params', async () => {
		dataSource.query
			.mockResolvedValueOnce([headerRow]) // HEADER
			.mockResolvedValueOnce([{ finding_id: 1 }]) // FINDINGS
			.mockResolvedValueOnce([]) // OUTCOME_COURSE
			.mockResolvedValueOnce([]) // FINDING_OUTCOMES
			.mockResolvedValueOnce([]); // FINDING_ACTIONS

		await service.getView(42, 99, 9);

		expect(dataSource.query).toHaveBeenCalledTimes(5);

		const [, headerParams] = dataSource.query.mock.calls[0];
		expect(headerParams).toEqual([42, 9, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL, 99]);

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

		await expect(service.getView(42, 99, 9)).rejects.toMatchObject({
			status: HttpStatus.NOT_FOUND,
		});
	});

	it('skips finding outcome / action queries when no findings exist', async () => {
		dataSource.query
			.mockResolvedValueOnce([headerRow])
			.mockResolvedValueOnce([]) // no findings
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9);

		expect(dataSource.query).toHaveBeenCalledTimes(3);
		expect(result.findings).toEqual([]);
		expect(result.ifc.requester_in_chain).toBe(true);
	});

	it('emits status: null when the header has no status_code', async () => {
		const noStatus = { ...headerRow, status_code: null, status_name: null, status_at: null };
		dataSource.query.mockResolvedValueOnce([noStatus]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9);

		expect(result.ifc.status).toBeNull();
	});

	it('exposes requester_in_chain=false when the header reports the requester is not in the chain', async () => {
		dataSource.query
			.mockResolvedValueOnce([{ ...headerRow, requester_in_chain: false }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9);

		expect(result.ifc.requester_in_chain).toBe(false);
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

	const ctxRow = (overrides: Partial<{ ifc_course_staff_id: number | null; course_chart_id: number | null; requester_staff_id: number | null; current_status_code: string | null }> = {}) => [
		{
			ifc_course_staff_id: 11,
			course_chart_id: 500,
			requester_staff_id: 11,
			current_status_code: null,
			...overrides,
		},
	];

	const insertedRow = { code: 'TG701-T002', name: { es: 'Enviado' }, at: '2026-01-01', comment: null, by: 'Ada' };

	it('submit: succeeds when requester is in the course chain and IFC is unregistered', async () => {
		dataSource.query
			.mockResolvedValueOnce(ctxRow({ current_status_code: null })) // transition context
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([insertedRow]); // insertStatus

		const result = await service.submit(42, 99, 9);

		expect(result).toBe(insertedRow);
		const [, chainParams] = dataSource.query.mock.calls[1];
		expect(chainParams).toEqual([500, 11]);
		const [, insertParams] = dataSource.query.mock.calls[2];
		expect(insertParams[0]).toBe(42);
		expect(insertParams[1]).toBe(TYPE_CODES.IFC_STATUS.SUBMITTED);
		expect(insertParams[2]).toBe(11);
		expect(insertParams[3]).toBeNull();
	});

	it('submit: rejects with 409 when current status is already SUBMITTED', async () => {
		dataSource.query.mockResolvedValueOnce(ctxRow({ current_status_code: TYPE_CODES.IFC_STATUS.SUBMITTED })).mockResolvedValueOnce([{ '?column?': 1 }]); // chain check passes; status fails

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
	});

	it('submit: rejects with 403 when requester is not in the course chain', async () => {
		dataSource.query.mockResolvedValueOnce(ctxRow({ ifc_course_staff_id: 22, requester_staff_id: 11, current_status_code: null })).mockResolvedValueOnce([]); // chain check returns no rows

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
	});

	it('submit: an ancestor (not own coord) is allowed by the chain check', async () => {
		dataSource.query
			.mockResolvedValueOnce(ctxRow({ ifc_course_staff_id: 22, requester_staff_id: 11, current_status_code: null }))
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check finds requester on an ancestor
			.mockResolvedValueOnce([insertedRow]);

		await expect(service.submit(42, 99, 9)).resolves.toBe(insertedRow);
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

describe('IfcService.prefill', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };
	const repository = {} as IfcRepository;

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		service = new IfcService(repository, dataSource as unknown as DataSource);
	});

	const headerRow = {
		academic_period_code: 'AP_2026_1',
		area_label: { es: 'Área' },
		subarea_label: { es: 'Subárea' },
		course_name: { es: 'Curso' },
		course_learning_outcome: { es: 'LO' },
		coordinator_user_id: 7,
		coordinator_code: 'PROF-001',
		coordinator_name: 'Ada Lovelace',
	};

	it('calls the two SQL queries with the correct positional params', async () => {
		dataSource.query.mockResolvedValueOnce([headerRow]).mockResolvedValueOnce([]);

		await service.prefill({ chart_id: 310, period_id: 5 }, 9);

		expect(dataSource.query).toHaveBeenCalledTimes(2);
		const [, headerParams] = dataSource.query.mock.calls[0];
		expect(headerParams).toEqual([310, 5, 9, TYPE_CODES.CHART_LEVEL_TYPE.COURSE_COORDINATOR, TYPE_CODES.ENTITY_TYPE.SCHOOL]);
		const [, outcomeParams] = dataSource.query.mock.calls[1];
		expect(outcomeParams).toEqual([310]);
	});

	it('returns 404 when the header is empty (chart not in school)', async () => {
		dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		await expect(service.prefill({ chart_id: 310, period_id: 5 }, 9)).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
	});

	it('merges header + grouped outcome rows', async () => {
		dataSource.query.mockResolvedValueOnce([headerRow]).mockResolvedValueOnce([
			{ program_code: 'PR1', program_name: { es: 'Prog 1' }, commission_code: 'C1', commission_name: { es: 'Com 1' }, outcome_code: 'O1', outcome_name: { es: 'OC1' }, outcome_description: {} },
			{ program_code: 'PR1', program_name: { es: 'Prog 1' }, commission_code: 'C1', commission_name: { es: 'Com 1' }, outcome_code: 'O2', outcome_name: { es: 'OC2' }, outcome_description: {} },
		]);

		const result = await service.prefill({ chart_id: 310, period_id: 5 }, 9);

		expect(result.outcome_course_result).toHaveLength(1);
		expect(result.outcome_course_result[0].commissions[0].outcomes).toHaveLength(2);
		expect(result.coordinator_user_id).toBe(7);
	});
});

describe('IfcService.createIfc', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock; transaction: jest.Mock; manager: { query: jest.Mock } };
	let em: { query: jest.Mock };
	const repository = {} as IfcRepository;

	beforeEach(() => {
		em = { query: jest.fn() };
		dataSource = {
			query: jest.fn(),
			manager: { query: jest.fn() },
			transaction: jest.fn(async (fn: any) => fn(em)),
		};
		service = new IfcService(repository, dataSource as unknown as DataSource);
	});

	const baseDto = (overrides: Partial<CreateIfcDto> = {}): CreateIfcDto => ({
		chart_id: 310,
		period_id: 5,
		submit: false,
		information: {},
		findings: [],
		actions: [],
		...overrides,
	});

	it('rejects 404 when chart is not found in school', async () => {
		em.query.mockResolvedValueOnce([]); // CHART_RESOLUTION_SQL → empty

		await expect(service.createIfc(baseDto(), 99, 9)).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
	});

	it('rejects 409 when an IFC already exists for the (course, period)', async () => {
		em.query
			.mockResolvedValueOnce([{ course_id: 100, ifc_course_staff_id: 11, program_id: 50, requester_staff_id: 11 }]) // chart resolution
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check passes
			.mockResolvedValueOnce([{ '?column?': 1 }]); // assertNoIfcExists finds a row → throws

		await expect(service.createIfc(baseDto(), 99, 9)).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
	});

	it('rejects 403 when requester is not in the course chain', async () => {
		em.query
			.mockResolvedValueOnce([{ course_id: 100, ifc_course_staff_id: 11, program_id: 50, requester_staff_id: 22 }]) // chart resolution
			.mockResolvedValueOnce([]); // chain check returns no rows → 403

		await expect(service.createIfc(baseDto(), 99, 9)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
	});

	it('happy path: inserts IFC + status (SAVED when submit=false) and assigns consecutive correlatives to new findings (single IFC instrument)', async () => {
		// Order of em.query calls in createIfc with findings:
		// 1. CHART_RESOLUTION_SQL
		// 2. assertIsInCourseChain (chain CTE)
		// 3. assertNoIfcExists (empty rows OK)
		// 4. INSERT INTO evidence.ifcs RETURNING id
		// 5. SELECT IFC instrument id (resolved once for the whole call)
		// 6. SELECT criticality codes (batch)
		// 7. SELECT MAX(correlative) for new findings (single base lookup)
		// 8. For each new finding: INSERT finding + INSERT ifc_findings
		// 9. insertStatus
		em.query
			.mockResolvedValueOnce([{ course_id: 100, ifc_course_staff_id: 11, program_id: 50, requester_staff_id: 11 }]) // chart resolution
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check passes
			.mockResolvedValueOnce([]) // assertNoIfcExists
			.mockResolvedValueOnce([{ id: 999 }]) // INSERT ifc
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id
			.mockResolvedValueOnce([{ id: 7, code: TYPE_CODES.CRITICALITY.NORMAL }]) // resolve criticality
			.mockResolvedValueOnce([{ c: 4 }]) // single base correlative for (ifcInstrument, course)
			.mockResolvedValueOnce([{ id: 201 }]) // INSERT finding 1 returning 201
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ id: 202 }]) // INSERT finding 2 returning 202
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SAVED, name: { es: 'Guardado' }, at: '2026', comment: null, by: 'me' }]); // insertStatus

		const dto = baseDto({
			findings: [
				{ tempId: 't1', id: null, description: { es: 'a' }, criticality_code: TYPE_CODES.CRITICALITY.NORMAL },
				{ tempId: 't2', id: null, description: { es: 'b' }, criticality_code: TYPE_CODES.CRITICALITY.NORMAL },
			],
		});

		const result = await service.createIfc(dto, 99, 9);
		expect(result).toEqual({ id: 999 });

		const firstInsert = em.query.mock.calls[7];
		const secondInsert = em.query.mock.calls[9];
		expect(firstInsert[1][1]).toBe(77); // ifcInstrumentId
		expect(secondInsert[1][1]).toBe(77);
		expect(firstInsert[1][3]).toBe(5); // base 4 + 1
		expect(secondInsert[1][3]).toBe(6); // base 4 + 2

		const statusInsert = em.query.mock.calls[11];
		expect(statusInsert[1][1]).toBe(TYPE_CODES.IFC_STATUS.SAVED);
	});

	it('inserts SUBMITTED status when submit=true (no findings → no instrument lookup either)', async () => {
		em.query
			.mockResolvedValueOnce([{ course_id: 100, ifc_course_staff_id: 11, program_id: 50, requester_staff_id: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 999 }])
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id (always queried)
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SUBMITTED, name: { es: 'Enviado' }, at: '2026', comment: null, by: 'me' }]);

		await service.createIfc(baseDto({ submit: true }), 99, 9);

		const statusInsert = em.query.mock.calls[5];
		expect(statusInsert[1][1]).toBe(TYPE_CODES.IFC_STATUS.SUBMITTED);
	});

	it('throws 500 + ifcInstrumentMissing when the IFC instrument is not seeded', async () => {
		em.query
			.mockResolvedValueOnce([{ course_id: 100, ifc_course_staff_id: 11, program_id: 50, requester_staff_id: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 999 }])
			.mockResolvedValueOnce([]); // resolve IFC instrument id → empty

		await expect(service.createIfc(baseDto(), 99, 9)).rejects.toMatchObject({ status: HttpStatus.INTERNAL_SERVER_ERROR });
	});

	it('rolls back transaction when an inner em.query throws', async () => {
		em.query
			.mockResolvedValueOnce([{ course_id: 100, ifc_course_staff_id: 11, program_id: 50, requester_staff_id: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(new Error('DB explosion'));

		await expect(service.createIfc(baseDto(), 99, 9)).rejects.toThrow('DB explosion');
		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
	});

	it('ancestor (not own coord) can create on behalf of the coordinator', async () => {
		em.query
			.mockResolvedValueOnce([{ course_id: 100, ifc_course_staff_id: 22, program_id: 50, requester_staff_id: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check — requester found on ancestor
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 999 }])
			.mockResolvedValueOnce([{ id: 77 }])
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SAVED, name: { es: 's' }, at: '2026', comment: null, by: 'me' }]);

		await expect(service.createIfc(baseDto(), 99, 9)).resolves.toEqual({ id: 999 });
	});

	it('resolveFindingsAndActions: actions can reference a brand-new finding via tempId', async () => {
		em.query
			.mockResolvedValueOnce([{ course_id: 100, ifc_course_staff_id: 11, program_id: 50, requester_staff_id: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 999 }])
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id
			.mockResolvedValueOnce([{ id: 7, code: TYPE_CODES.CRITICALITY.NORMAL }])
			.mockResolvedValueOnce([{ c: 0 }]) // base correlative for findings
			.mockResolvedValueOnce([{ id: 201 }]) // INSERT finding → 201
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ c: 0 }]) // base correlative for actions
			.mockResolvedValueOnce([{ id: 301 }]) // INSERT action → 301
			.mockResolvedValueOnce([]) // INSERT finding_actions
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SAVED, name: { es: 's' }, at: '2026', comment: null, by: 'me' }]);

		const dto = baseDto({
			findings: [{ tempId: 'tF', id: null, description: { es: 'f' }, criticality_code: TYPE_CODES.CRITICALITY.NORMAL }],
			actions: [{ tempId: 'tA', id: null, description: { es: 'a' }, finding_temp_id: 'tF' }],
		});

		await service.createIfc(dto, 99, 9);

		const findingActionInsert = em.query.mock.calls[11];
		expect(findingActionInsert[1][0]).toBe(201);
		expect(findingActionInsert[1][1]).toBe(301);
	});
});

describe('IfcService.patch', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock; transaction: jest.Mock; manager: { query: jest.Mock } };
	let em: { query: jest.Mock };
	const repository = {} as IfcRepository;

	beforeEach(() => {
		em = { query: jest.fn() };
		dataSource = {
			query: jest.fn(),
			manager: { query: jest.fn() },
			transaction: jest.fn(async (fn: any) => fn(em)),
		};
		service = new IfcService(repository, dataSource as unknown as DataSource);
	});

	const baseDto = (overrides: Partial<IfcContentDto> = {}): IfcContentDto => ({
		submit: false,
		information: {},
		findings: [],
		actions: [],
		...overrides,
	});

	const patchCtxRow = (overrides: Partial<{ ifc_course_staff_id: number; course_chart_id: number; requester_staff_id: number; current_status_code: string | null }> = {}) => [
		{
			ifc_course_staff_id: 11,
			course_chart_id: 500,
			requester_staff_id: 11,
			current_status_code: TYPE_CODES.IFC_STATUS.SAVED,
			...overrides,
		},
	];

	it('rejects 409 when current status is SUBMITTED', async () => {
		em.query.mockResolvedValueOnce(patchCtxRow({ current_status_code: TYPE_CODES.IFC_STATUS.SUBMITTED })).mockResolvedValueOnce([{ '?column?': 1 }]); // chain check passes, status fails

		await expect(service.patch(42, baseDto(), 99, 9)).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
	});

	it('rejects 409 when current status is APPROVED', async () => {
		em.query.mockResolvedValueOnce(patchCtxRow({ current_status_code: TYPE_CODES.IFC_STATUS.APPROVED })).mockResolvedValueOnce([{ '?column?': 1 }]);

		await expect(service.patch(42, baseDto(), 99, 9)).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
	});

	it('rejects 403 when requester is not in the course chain', async () => {
		em.query.mockResolvedValueOnce(patchCtxRow({ ifc_course_staff_id: 11, requester_staff_id: 22 })).mockResolvedValueOnce([]); // chain check returns no rows

		await expect(service.patch(42, baseDto(), 99, 9)).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
	});

	it('happy path: SAVED → SUBMITTED when submit=true (requester is own coordinator → in chain)', async () => {
		em.query
			.mockResolvedValueOnce(patchCtxRow({ current_status_code: TYPE_CODES.IFC_STATUS.SAVED })) // transition context
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([{ course_id: 100, academic_period_id: 5 }]) // SELECT course_id/period_id
			.mockResolvedValueOnce([{ program_id: 50 }]) // program lookup
			.mockResolvedValueOnce([]) // UPDATE evidence.ifcs
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id (inside resolveFindingsAndActions)
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SUBMITTED, name: { es: 'Enviado' }, at: '2026', comment: null, by: 'me' }]); // insertStatus

		const result = await service.patch(42, baseDto({ submit: true }), 99, 9);
		expect(result).toEqual({ id: 42 });

		const statusInsert = em.query.mock.calls[6];
		expect(statusInsert[1][1]).toBe(TYPE_CODES.IFC_STATUS.SUBMITTED);
	});

	it('happy path: OBSERVED → SAVED when submit=false (ancestor — not own coord — passes chain check)', async () => {
		em.query
			.mockResolvedValueOnce(patchCtxRow({ ifc_course_staff_id: 22, requester_staff_id: 11, current_status_code: TYPE_CODES.IFC_STATUS.OBSERVED }))
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check — requester found on an ancestor
			.mockResolvedValueOnce([{ course_id: 100, academic_period_id: 5 }])
			.mockResolvedValueOnce([{ program_id: 50 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id
			.mockResolvedValueOnce([{ code: TYPE_CODES.IFC_STATUS.SAVED, name: { es: 's' }, at: '2026', comment: null, by: 'me' }]);

		await service.patch(42, baseDto({ submit: false }), 99, 9);

		const statusInsert = em.query.mock.calls[6];
		expect(statusInsert[1][1]).toBe(TYPE_CODES.IFC_STATUS.SAVED);
	});
});
