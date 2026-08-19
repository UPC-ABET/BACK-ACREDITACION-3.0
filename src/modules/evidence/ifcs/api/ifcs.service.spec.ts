import { DataSource } from 'typeorm';
import { HttpException, HttpStatus } from '@nestjs/common';
import { IfcService } from './ifcs.service';
import { IfcStateMachineService } from './ifc-state-machine.service';
import { IfcContentService } from './ifc-content.service';
import { IfcViewService } from './ifc-view.service';
import { IfcReportService } from './ifc-report.service';
import { IfcStatusHistoryService } from './ifc-status-history.service';

const reportGenerator = {
	generateDocument: jest
		.fn()
		.mockResolvedValue({ pdf: Buffer.from('%PDF-'), filename: 'report.pdf' }),
	archivePdfFiles: jest
		.fn()
		.mockResolvedValue({ zip: Buffer.from('zip'), filename: 'reports.zip' }),
};
const dispatcher = {
	dispatch: jest
		.fn()
		.mockResolvedValue({ sent: false, recipientsCount: 0, ccCount: 0, reason: 'no_config' }),
	dispatchStatusChangeAsync: jest.fn(),
};
import { IfcRepository } from '../core/ifcs.repository';
import { IfcStatusReportDto, ListIfcsDto, RejectIfcDto } from '../model/ifcs.dtos';
import { CreateIfcDto, IfcContentDto } from '../model/ifcs-content.dtos';
import { TYPE_CODES, TYPE_GROUP_CODES } from 'src/modules/core/types/constants/type-codes';
import { IFCS_PARAMETER_KEYS } from './ifcs.constants';

function buildServices(dataSource: any) {
	const ds = dataSource as unknown as DataSource;
	const repository = {
		transaction: <T>(work: (manager: any) => Promise<T>) => ds.transaction(work as any),
		getReportCodes: async (chartIds: number[], schoolId: number) => {
			const rows = await ds.query('', [chartIds, schoolId, TYPE_CODES.ENTITY_TYPE.SCHOOL]);
			return rows[0] ?? null;
		},
		getStatusTypes: () => ds.query('', [TYPE_GROUP_CODES.IFC_STATUS]),
		getStatusReportRows: (
			chartIds: number[],
			schoolId: number,
			academicPeriodId: number,
			language: 'es' | 'en',
		) =>
			ds.query('', [
				chartIds,
				academicPeriodId,
				schoolId,
				TYPE_CODES.ENTITY_TYPE.COURSE,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
				language,
			]),
		findIfcListRows: (chartIds: number[], academicPeriodId: number) =>
			ds.query('', [chartIds, academicPeriodId, TYPE_CODES.ENTITY_TYPE.COURSE]),
		findViewHeaderRows: (ifcId: number, schoolId: number, userId: number) =>
			ds.query('', [
				ifcId,
				schoolId,
				TYPE_CODES.ENTITY_TYPE.COURSE,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
				userId,
				TYPE_CODES.ENTITY_TYPE.PROGRAM,
			]),
		findFindingRows: (ifcId: number, findingPrefixKey: string) =>
			ds.query('', [ifcId, findingPrefixKey]),
		findOutcomeCourseRowsByIfc: (ifcId: number) => ds.query('', [ifcId]),
		findOutcomeCourseRowsByChart: (chartId: number) => ds.query('', [chartId]),
		findFindingOutcomeRows: (findingIds: number[]) => ds.query('', [findingIds]),
		findFindingActionRows: (
			findingIds: number[],
			actionPrefixKey: string,
			pendingCode: string,
			implementedCode: string,
		) => ds.query('', [findingIds, actionPrefixKey, pendingCode, implementedCode]),
		findPreviousActionRows: (
			courseId: number,
			activePeriodId: number,
			excludeIfcId: number | null,
			actionPrefixKey: string,
			pendingCode: string,
			implementedCode: string,
			findingPrefixKey: string,
			manager?: any,
		) =>
			(manager ?? ds).query('', [
				courseId,
				activePeriodId,
				excludeIfcId,
				actionPrefixKey,
				pendingCode,
				implementedCode,
				findingPrefixKey,
			]),
		findPrefillHeaderRows: (
			chartId: number,
			academicPeriodId: number,
			schoolId: number,
			userId: number,
		) =>
			ds.query('', [
				chartId,
				academicPeriodId,
				schoolId,
				TYPE_CODES.ENTITY_TYPE.COURSE,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
				userId,
			]),
		resolveCurrentStatusCode: async (chartId: number, periodId: number, fallback: string) => {
			const rows = await ds.query('', [chartId, periodId, fallback]);
			return rows[0]?.code ?? null;
		},
		lockIfc: (ifcId: number, manager: any) =>
			manager.query('SELECT id FROM evidence.ifcs WHERE id = $1 FOR UPDATE', [ifcId]),
		findIfcPeriodId: async (ifcId: number, manager?: any) => {
			const rows = await (manager ?? ds).query('', [ifcId]);
			return rows[0]?.academicPeriodId === undefined ? undefined : Number(rows[0].academicPeriodId);
		},
		findCoursePeriod: async (ifcId: number, manager?: any) => {
			const rows = await (manager ?? ds).query('', [ifcId]);
			return rows[0];
		},
		findTransitionContextRows: (ifcId: number, schoolId: number, userId: number, manager?: any) =>
			(manager ?? ds).query('', [
				ifcId,
				schoolId,
				userId,
				TYPE_CODES.ENTITY_TYPE.COURSE,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
			]),
		findStatusHistoryRows: (ifcId: number) => ds.query('', [ifcId]),
		insertStatus: async (
			ifcId: number,
			newStatusCode: string,
			requesterStaffId: number | null,
			comment: any,
			manager?: any,
		) => {
			const rows = await (manager ?? ds).query('', [
				ifcId,
				newStatusCode,
				requesterStaffId,
				comment ? JSON.stringify(comment) : null,
			]);
			return rows[0];
		},
		resolveChart: (
			chartId: number,
			academicPeriodId: number,
			schoolId: number,
			userId: number,
			manager?: any,
		) =>
			(manager ?? ds).query('', [
				chartId,
				academicPeriodId,
				schoolId,
				TYPE_CODES.ENTITY_TYPE.COURSE,
				TYPE_CODES.ENTITY_TYPE.SCHOOL,
				userId,
			]),
		findProgramByCoursePeriod: (courseId: number, periodId: number, manager?: any) =>
			(manager ?? ds).query('', [courseId, periodId, TYPE_CODES.ENTITY_TYPE.COURSE]),
		insertIfc: async (
			courseId: number,
			academicPeriodId: number,
			information: any,
			manager: any,
		) => {
			const rows = await manager.query('', [
				courseId,
				academicPeriodId,
				JSON.stringify(information),
			]);
			return Number(rows[0].id);
		},
		updateIfcInformation: async (ifcId: number, information: any, manager: any) => {
			await manager.query('', [JSON.stringify(information), ifcId]);
		},
		findIfcInstrumentId: async (instrumentCode: string, manager: any) => {
			const rows = await manager.query('', [instrumentCode]);
			return rows[0]?.id;
		},
		findCriticalityTypes: (criticalityCodes: string[], manager: any) =>
			manager.query('', [criticalityCodes]),
		maxFindingCorrelative: async (instrumentId: number, courseId: number, manager: any) => {
			const rows = await manager.query('', [instrumentId, courseId]);
			return Number(rows[0]?.c ?? 0);
		},
		insertFinding: async (input: any, manager: any) => {
			const rows = await manager.query('', [
				input.criticalityTypeId,
				input.instrumentId,
				input.requesterStaffId,
				input.correlative,
				JSON.stringify(input.description),
				input.courseId,
				input.periodId,
			]);
			return Number(rows[0].id);
		},
		linkIfcFinding: async (ifcId: number, findingId: number, manager: any) => {
			await manager.query('', [ifcId, findingId]);
		},
		updateFinding: async (
			findingId: number,
			description: any,
			criticalityTypeId: number,
			manager: any,
		) => {
			await manager.query('', [JSON.stringify(description), criticalityTypeId, findingId]);
		},
		maxActionCorrelative: async (instrumentId: number, courseId: number, manager: any) => {
			const rows = await manager.query('', [instrumentId, courseId]);
			return Number(rows[0]?.c ?? 0);
		},
		insertAction: async (input: any, manager: any) => {
			const rows = await manager.query('', [
				JSON.stringify(input.description),
				input.correlative,
				input.programId,
				input.periodId,
			]);
			return Number(rows[0].id);
		},
		linkFindingAction: async (findingId: number, actionId: number, manager: any) => {
			await manager.query('', [findingId, actionId]);
		},
		updateAction: async (actionId: number, description: any, manager: any) => {
			await manager.query('', [JSON.stringify(description), actionId]);
		},
		relinkFindingAction: async (findingId: number, actionId: number, manager: any) => {
			await manager.query('', [findingId, actionId]);
		},
		updateFindingActionEvidences: async (findingActionId: number, evidences: any, manager: any) => {
			await manager.query('', [
				evidences === null ? null : JSON.stringify(evidences),
				findingActionId,
			]);
		},
		deleteAction: async (actionId: number, manager: any) => {
			await manager.query('', [actionId]);
			await manager.query('', [actionId]);
		},
		deleteFinding: async (findingId: number, manager: any) => {
			await manager.query('', [findingId]);
			await manager.query('', [findingId]);
			await manager.query('', [findingId]);
			await manager.query('', [findingId]);
		},
	} as unknown as IfcRepository;
	const stateMachine = new IfcStateMachineService(repository, dispatcher as any);
	const view = new IfcViewService(repository);
	const content = new IfcContentService(repository, stateMachine, dispatcher as any);
	const report = new IfcReportService(repository, reportGenerator as any, view);
	const history = new IfcStatusHistoryService(repository, stateMachine);
	const schoolsRepository = { findUserSchools: jest.fn() };
	const service = new IfcService(
		repository,
		stateMachine,
		content,
		view,
		report,
		history,
		dispatcher as any,
		schoolsRepository as any,
	);
	return { service, stateMachine, content, view, report, history };
}

describe('IfcService.list', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		({ service } = buildServices(dataSource));
	});

	it('forwards chart_ids, period_id, and the COURSE type code to the SQL query', async () => {
		const expected = [
			{ chartId: 310, courseCode: 'CRS_FUND_PROG', ifc: null },
			{ chartId: 311, courseCode: 'CRS_REQ_ENG', ifc: { id: 1, statusCode: 'TG701-T001' } },
		];
		dataSource.query.mockResolvedValueOnce(expected);

		const dto: ListIfcsDto = { chartIds: [310, 311] };
		const result = await service.list(dto, 5);

		expect(result).toBe(expected);
		expect(dataSource.query).toHaveBeenCalledTimes(1);
		const [, params] = dataSource.query.mock.calls[0];
		expect(params).toEqual([[310, 311], 5, TYPE_CODES.ENTITY_TYPE.COURSE]);
	});

	it('returns whatever the DataSource returns (passthrough)', async () => {
		dataSource.query.mockResolvedValueOnce([]);

		const result = await service.list({ chartIds: [1] }, 1);

		expect(result).toEqual([]);
	});
});

describe('IfcService.getView', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		({ service } = buildServices(dataSource));
	});

	const headerRow = {
		ifcId: 42,
		courseId: 17,
		academicPeriodId: 5,
		information: { foo: 'bar' },
		extra: {},
		ifcCreatedAt: '2026-01-01T00:00:00Z',
		academicPeriodCode: 'AP_2026_1',
		areaLabel: { es: 'Área' },
		subareaLabel: { es: 'Subárea' },
		courseName: { es: 'Curso' },
		courseLearningOutcome: { es: 'LO' },
		coordinatorUserId: '7',
		coordinatorCode: 'PROF-001',
		coordinatorName: 'Ada Lovelace',
		statusCode: 'TG701-T002',
		statusName: { es: 'Enviado' },
		statusAt: '2026-01-02T00:00:00Z',
		statusComment: null,
		statusByName: 'Ada Lovelace',
		requesterInChain: true,
		requesterHasHigherLevel: true,
	};

	it('calls the six SQL queries with the correct positional params', async () => {
		dataSource.query
			.mockResolvedValueOnce([headerRow]) // HEADER
			.mockResolvedValueOnce([{ findingId: 1 }]) // FINDINGS
			.mockResolvedValueOnce([]) // OUTCOME_COURSE
			.mockResolvedValueOnce([]) // FINDING_OUTCOMES
			.mockResolvedValueOnce([]) // FINDING_ACTIONS
			.mockResolvedValueOnce([]); // PREVIOUS_ACTIONS

		await service.getView(42, 99, 9, false);

		expect(dataSource.query).toHaveBeenCalledTimes(6);

		const [, headerParams] = dataSource.query.mock.calls[0];
		expect(headerParams).toEqual([
			42,
			9,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			99,
			TYPE_CODES.ENTITY_TYPE.PROGRAM,
		]);

		const [, findingParams] = dataSource.query.mock.calls[1];
		expect(findingParams).toEqual([42, IFCS_PARAMETER_KEYS.FINDING_PREFIX]);

		const [, outcomeParams] = dataSource.query.mock.calls[2];
		expect(outcomeParams).toEqual([42]);

		const [, finOutcomeParams] = dataSource.query.mock.calls[3];
		expect(finOutcomeParams).toEqual([[1]]);

		const [, finActionParams] = dataSource.query.mock.calls[4];
		expect(finActionParams).toEqual([
			[1],
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
		]);

		const [, prevActionParams] = dataSource.query.mock.calls[5];
		expect(prevActionParams).toEqual([
			17,
			5,
			42,
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
		]);
	});

	it('throws 404 when headerRows is empty', async () => {
		dataSource.query
			.mockResolvedValueOnce([]) // HEADER empty
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		await expect(service.getView(42, 99, 9, false)).rejects.toMatchObject({
			status: HttpStatus.NOT_FOUND,
		});
	});

	it('skips finding outcome / action queries when no findings exist, but still loads previous actions', async () => {
		dataSource.query
			.mockResolvedValueOnce([headerRow])
			.mockResolvedValueOnce([]) // no findings
			.mockResolvedValueOnce([]) // OUTCOME_COURSE
			.mockResolvedValueOnce([]); // PREVIOUS_ACTIONS

		const result = await service.getView(42, 99, 9, false);

		expect(dataSource.query).toHaveBeenCalledTimes(4);
		expect(result.findings).toEqual([]);
		expect(result.ifc.requesterInChain).toBe(true);
		expect(result.previousActions).toEqual([]);
	});

	it('emits status: null when the header has no statusCode', async () => {
		const noStatus = { ...headerRow, statusCode: null, statusName: null, statusAt: null };
		dataSource.query
			.mockResolvedValueOnce([noStatus])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9, false);

		expect(result.ifc.status).toBeNull();
	});

	it('exposes requester_in_chain=false when the header reports the requester is not in the chain', async () => {
		dataSource.query
			.mockResolvedValueOnce([{ ...headerRow, requesterInChain: false }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9, false);

		expect(result.ifc.requesterInChain).toBe(false);
	});

	it('maps requesterHasHigherLevel independently from requesterInChain', async () => {
		dataSource.query
			.mockResolvedValueOnce([
				{ ...headerRow, requesterInChain: true, requesterHasHigherLevel: false },
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9, false);

		expect(result.ifc.requesterInChain).toBe(true);
		expect(result.ifc.requesterHasHigherLevel).toBe(false);
	});

	it('sets showHistory from requesterHasHigherLevel when not admin', async () => {
		dataSource.query
			.mockResolvedValueOnce([{ ...headerRow, requesterHasHigherLevel: true }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9, false);

		expect(result.ifc.showHistory).toBe(true);
	});

	it('sets showHistory=false when neither a higher-level requester nor an admin', async () => {
		dataSource.query
			.mockResolvedValueOnce([{ ...headerRow, requesterHasHigherLevel: false }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9, false);

		expect(result.ifc.showHistory).toBe(false);
	});

	it('sets showHistory=true for an admin even when requesterHasHigherLevel is false', async () => {
		dataSource.query
			.mockResolvedValueOnce([{ ...headerRow, requesterHasHigherLevel: false }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const result = await service.getView(42, 99, 9, true);

		expect(result.ifc.showHistory).toBe(true);
		expect(result.ifc.requesterHasHigherLevel).toBe(false);
	});
});

describe('IfcService.getStatusHistory', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock; transaction: jest.Mock };

	beforeEach(() => {
		dataSource = {
			query: jest.fn(),
			transaction: jest.fn(async (fn: any) => fn(dataSource)),
		};
		({ service } = buildServices(dataSource));
	});

	const contextRow = {
		courseChartId: '310',
		requesterStaffId: '55',
		currentStatusCode: 'TG701-T003',
	};

	const historyRows = [
		{
			statusCode: 'TG701-T003',
			statusName: { es: 'Aprobado' },
			statusColor: '#00FF00',
			registerAt: '2026-01-03T00:00:00Z',
			comment: null,
			staffName: 'Grace Hopper',
		},
		{
			statusCode: 'TG701-T004',
			statusName: { es: 'Observado' },
			statusColor: '#FF0000',
			registerAt: '2026-01-02T00:00:00Z',
			comment: { es: 'Falta evidencia', en: 'Missing evidence' },
			staffName: 'Grace Hopper',
		},
		{
			statusCode: 'TG701-T002',
			statusName: { es: 'Enviado' },
			statusColor: null,
			registerAt: '2026-01-01T00:00:00Z',
			comment: null,
			staffName: null,
		},
	];

	it('non-admin with a higher-level match: returns the full history, most recent first, mapped to code/name/color/at/comment/by', async () => {
		dataSource.query
			.mockResolvedValueOnce([contextRow]) // findTransitionContextRows
			.mockResolvedValueOnce([{ ok: 1 }]) // assertHasHigherLevel chain query — match found
			.mockResolvedValueOnce(historyRows); // findStatusHistoryRows

		const result = await service.getStatusHistory(42, 99, 9, false);

		expect(dataSource.query).toHaveBeenCalledTimes(3);
		expect(result).toEqual({
			statuses: [
				{
					code: 'TG701-T003',
					name: { es: 'Aprobado' },
					color: '#00FF00',
					at: '2026-01-03T00:00:00Z',
					comment: null,
					by: 'Grace Hopper',
				},
				{
					code: 'TG701-T004',
					name: { es: 'Observado' },
					color: '#FF0000',
					at: '2026-01-02T00:00:00Z',
					comment: { es: 'Falta evidencia', en: 'Missing evidence' },
					by: 'Grace Hopper',
				},
				{
					code: 'TG701-T002',
					name: { es: 'Enviado' },
					color: null,
					at: '2026-01-01T00:00:00Z',
					comment: null,
					by: null,
				},
			],
		});

		const [, chainParams] = dataSource.query.mock.calls[1];
		expect(chainParams).toEqual([310, 55]);
	});

	it('throws 404 when the IFC does not exist or is outside the requester school', async () => {
		dataSource.query.mockResolvedValueOnce([]); // findTransitionContextRows empty

		await expect(service.getStatusHistory(42, 99, 9, false)).rejects.toMatchObject({
			status: HttpStatus.NOT_FOUND,
		});
		expect(dataSource.query).toHaveBeenCalledTimes(1);
	});

	it('throws 403 when the requester is the course coordinator themselves (no higher-level match)', async () => {
		dataSource.query
			.mockResolvedValueOnce([contextRow]) // findTransitionContextRows
			.mockResolvedValueOnce([]); // assertHasHigherLevel chain query — no match

		await expect(service.getStatusHistory(42, 99, 9, false)).rejects.toMatchObject({
			kind: 'forbidden',
		});
		expect(dataSource.query).toHaveBeenCalledTimes(2);
	});

	it('throws 403 with error.ifc.staffRequired when the requester has no staff record at all', async () => {
		dataSource.query.mockResolvedValueOnce([
			{ courseChartId: null, requesterStaffId: null, currentStatusCode: null },
		]);

		await expect(service.getStatusHistory(42, 99, 9, false)).rejects.toMatchObject({
			kind: 'forbidden',
			errors: ['error.ifc.staffRequired'],
		});
		// Rejected inside loadTransitionContext (assertRequesterIsStaff), before the
		// higher-level chain check ever runs — a requester with no staff record at all
		// gets the specific "you must be staff" key, not the chain-check's generic one.
		expect(dataSource.query).toHaveBeenCalledTimes(1);
	});

	it('throws 403 with error.ifc.higherLevelRequired when the requester is staff but no course chart resolved', async () => {
		dataSource.query.mockResolvedValueOnce([
			{ courseChartId: null, requesterStaffId: '55', currentStatusCode: null },
		]);

		await expect(service.getStatusHistory(42, 99, 9, false)).rejects.toMatchObject({
			kind: 'forbidden',
			errors: ['error.ifc.higherLevelRequired'],
		});
		// assertHasHigherLevel short-circuits on a null courseChartId before issuing the
		// chain-walk query, so still only the one context-load call.
		expect(dataSource.query).toHaveBeenCalledTimes(1);
	});

	it('returns a single-entry history unchanged (no ordering/mapping assumption breaks on one row)', async () => {
		const singleRow = [historyRows[0]];
		dataSource.query
			.mockResolvedValueOnce([contextRow])
			.mockResolvedValueOnce([{ ok: 1 }])
			.mockResolvedValueOnce(singleRow);

		const result = await service.getStatusHistory(42, 99, 9, false);

		expect(result.statuses).toEqual([
			{
				code: 'TG701-T003',
				name: { es: 'Aprobado' },
				color: '#00FF00',
				at: '2026-01-03T00:00:00Z',
				comment: null,
				by: 'Grace Hopper',
			},
		]);
	});

	it('admin bypasses the chain check entirely (no chain query executed), even when it would otherwise fail', async () => {
		dataSource.query
			.mockResolvedValueOnce([contextRow]) // findTransitionContextRows
			.mockResolvedValueOnce(historyRows); // findStatusHistoryRows (no chain query in between)

		const result = await service.getStatusHistory(42, 99, 9, true);

		expect(dataSource.query).toHaveBeenCalledTimes(2);
		expect(result.statuses).toHaveLength(3);
	});
});

describe('IfcService status transitions', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock; transaction: jest.Mock; manager: { query: jest.Mock } };
	let em: { query: jest.Mock };

	beforeEach(() => {
		em = { query: jest.fn() };
		dataSource = {
			query: jest.fn(),
			manager: { query: jest.fn() },
			transaction: jest.fn(async (fn: any) => fn(em)),
		};
		({ service } = buildServices(dataSource));
	});

	const ctxRow = (
		overrides: Partial<{
			courseChartId: number | null;
			requesterStaffId: number | null;
			currentStatusCode: string | null;
		}> = {},
	) => [
		{
			courseChartId: 500,
			requesterStaffId: 11,
			currentStatusCode: null,
			...overrides,
		},
	];

	const insertedRow = {
		code: 'TG701-T002',
		name: { es: 'Enviado' },
		at: '2026-01-01',
		comment: null,
		by: 'Ada',
	};

	it('submit: succeeds when requester is in the course chain and IFC is unregistered', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(ctxRow({ currentStatusCode: null })) // transition context
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([insertedRow]) // insertStatus
			.mockResolvedValueOnce([{ academicPeriodId: 5 }]); // fetch period for dispatch

		const result = await service.submit(42, 99, 9);

		expect(result).toEqual({ id: 42 });
		const [, chainParams] = em.query.mock.calls[2];
		expect(chainParams).toEqual([500, 11]);
		const [, insertParams] = em.query.mock.calls[3];
		expect(insertParams[0]).toBe(42);
		expect(insertParams[1]).toBe(TYPE_CODES.IFC_STATUS.SUBMITTED);
		expect(insertParams[2]).toBe(11);
		expect(insertParams[3]).toBeNull();
	});

	it('submit: rejects with 409 when current status is already SUBMITTED', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(ctxRow({ currentStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED }))
			.mockResolvedValueOnce([{ '?column?': 1 }]); // chain check passes; status fails

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ kind: 'conflict' });
	});

	it('submit: rejects with 403 when requester is not in the course chain', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(ctxRow({ requesterStaffId: 11, currentStatusCode: null }))
			.mockResolvedValueOnce([]); // chain check returns no rows

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ kind: 'forbidden' });
	});

	it('submit: an ancestor (not own coord) is allowed by the chain check', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(ctxRow({ requesterStaffId: 11, currentStatusCode: null }))
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check finds requester on an ancestor
			.mockResolvedValueOnce([insertedRow])
			.mockResolvedValueOnce([{ academicPeriodId: 5 }]); // fetch period for dispatch

		await expect(service.submit(42, 99, 9)).resolves.toMatchObject({
			id: 42,
		});
	});

	it('approve: rejects with 403 when requester holds no higher level in the chain', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(
				ctxRow({
					requesterStaffId: 11,
					currentStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
				}),
			)
			.mockResolvedValueOnce([]); // higher-level check finds no ancestor

		await expect(service.approve(42, 99, 9)).rejects.toMatchObject({
			kind: 'forbidden',
		});
	});

	it('approve: succeeds when requester holds a higher level and IFC is SUBMITTED', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(
				ctxRow({
					requesterStaffId: 22,
					currentStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
				}),
			)
			.mockResolvedValueOnce([{ '?column?': 1 }]) // higher-level check finds an ancestor
			.mockResolvedValueOnce([{ ...insertedRow, code: 'TG701-T003' }])
			.mockResolvedValueOnce([{ academicPeriodId: 5 }]); // fetch period for dispatch

		const result = await service.approve(42, 99, 9);

		expect(result.code).toBe('TG701-T003');
		const [, chainParams] = em.query.mock.calls[2];
		expect(chainParams).toEqual([500, 22]);
		const [, insertParams] = em.query.mock.calls[3];
		expect(insertParams[1]).toBe(TYPE_CODES.IFC_STATUS.APPROVED);
		expect(insertParams[3]).toBeNull();

		// Auto status-change is dispatched with the status actually written (not a hardcoded one).
		const dispatchArg = (dispatcher.dispatchStatusChangeAsync as jest.Mock).mock.lastCall[0];
		expect(dispatchArg).toMatchObject({
			chartId: 500,
			ifcStatusCode: TYPE_CODES.IFC_STATUS.APPROVED,
			ifcId: 42,
		});
	});

	it('approve: succeeds when the course coordinator also holds a higher level', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(
				ctxRow({
					requesterStaffId: 11,
					currentStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
				}),
			)
			.mockResolvedValueOnce([{ '?column?': 1 }]) // higher-level check finds requester on an ancestor
			.mockResolvedValueOnce([{ ...insertedRow, code: 'TG701-T003' }])
			.mockResolvedValueOnce([{ academicPeriodId: 5 }]); // fetch period for dispatch

		const result = await service.approve(42, 99, 9);

		expect(result.code).toBe('TG701-T003');
	});

	it('reject: inserts a status with comment populated and status_type_id=OBSERVED', async () => {
		const dto: RejectIfcDto = { comment: { es: 'falta', en: 'missing' } };
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(
				ctxRow({
					requesterStaffId: 22,
					currentStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED,
				}),
			)
			.mockResolvedValueOnce([{ '?column?': 1 }]) // higher-level check finds an ancestor
			.mockResolvedValueOnce([{ ...insertedRow, code: 'TG701-T004', comment: dto.comment }])
			.mockResolvedValueOnce([{ academicPeriodId: 5 }]); // fetch period for dispatch

		const result = await service.reject(42, 99, 9, dto);

		expect(result.code).toBe('TG701-T004');
		const [, insertParams] = em.query.mock.calls[3];
		expect(insertParams[1]).toBe(TYPE_CODES.IFC_STATUS.OBSERVED);
		expect(JSON.parse(insertParams[3])).toEqual(dto.comment);

		// OBSERVED now triggers the auto status-change dispatch (previously it did not).
		const dispatchArg = (dispatcher.dispatchStatusChangeAsync as jest.Mock).mock.lastCall[0];
		expect(dispatchArg).toMatchObject({
			ifcStatusCode: TYPE_CODES.IFC_STATUS.OBSERVED,
			ifcId: 42,
		});
	});

	it('throws 404 when the IFC is not in the requester school', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce([]); // transition context empty

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({
			status: HttpStatus.NOT_FOUND,
			message: expect.anything(),
		});
	});

	it('throws an HttpException when the IFC is not in the requester school', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce([]); // transition context empty

		await expect(service.submit(42, 99, 9)).rejects.toBeInstanceOf(HttpException);
	});

	it('throws 403 when the requester has no staff record', async () => {
		em.query
			.mockResolvedValueOnce([{ id: 42 }]) // lockIfc
			.mockResolvedValueOnce(ctxRow({ requesterStaffId: null }));

		await expect(service.submit(42, 99, 9)).rejects.toMatchObject({ kind: 'forbidden' });
	});
});

describe('IfcService.prefill', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		({ service } = buildServices(dataSource));
	});

	const headerRow = {
		courseId: 17,
		academicPeriodCode: 'AP_2026_1',
		areaLabel: { es: 'Área' },
		subareaLabel: { es: 'Subárea' },
		courseName: { es: 'Curso' },
		courseLearningOutcome: { es: 'LO' },
		coordinatorUserId: 7,
		coordinatorCode: 'PROF-001',
		coordinatorName: 'Ada Lovelace',
		requesterInChain: false,
		requesterHasHigherLevel: false,
	};

	it('calls the three SQL queries with the correct positional params', async () => {
		dataSource.query
			.mockResolvedValueOnce([headerRow])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		await service.prefill({ chartId: 310 }, 9, 5, 1);

		expect(dataSource.query).toHaveBeenCalledTimes(3);
		const [, headerParams] = dataSource.query.mock.calls[0];
		expect(headerParams).toEqual([
			310,
			5,
			9,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			1,
		]);
		const [, outcomeParams] = dataSource.query.mock.calls[1];
		expect(outcomeParams).toEqual([310]);
		const [, prevActionParams] = dataSource.query.mock.calls[2];
		expect(prevActionParams).toEqual([
			17,
			5,
			null,
			IFCS_PARAMETER_KEYS.ACTION_PREFIX,
			TYPE_CODES.ACTION_COMPLETENESS.PENDING,
			TYPE_CODES.ACTION_COMPLETENESS.IMPLEMENTED,
			IFCS_PARAMETER_KEYS.FINDING_PREFIX,
		]);
	});

	it('returns 404 when the header is empty (chart not in school)', async () => {
		dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		await expect(service.prefill({ chartId: 310 }, 9, 5, 1)).rejects.toMatchObject({
			kind: 'notFound',
		});
	});

	it('merges header + grouped outcome rows', async () => {
		dataSource.query
			.mockResolvedValueOnce([headerRow])
			.mockResolvedValueOnce([
				{
					programCode: 'PR1',
					programName: { es: 'Prog 1' },
					commissionCode: 'C1',
					commissionName: { es: 'Com 1' },
					outcomeCode: 'O1',
					outcomeName: { es: 'OC1' },
					outcomeDescription: {},
				},
				{
					programCode: 'PR1',
					programName: { es: 'Prog 1' },
					commissionCode: 'C1',
					commissionName: { es: 'Com 1' },
					outcomeCode: 'O2',
					outcomeName: { es: 'OC2' },
					outcomeDescription: {},
				},
			])
			.mockResolvedValueOnce([]); // PREVIOUS_ACTIONS

		const result = await service.prefill({ chartId: 310 }, 9, 5, 1);

		expect(result.outcomeCourseResult).toHaveLength(1);
		expect(result.outcomeCourseResult[0].commissions[0].outcomes).toHaveLength(2);
		expect(result.coordinatorUserId).toBe(7);
		expect(result.previousActions).toEqual([]);
	});

	it('maps requesterInChain/requesterHasHigherLevel from the header', async () => {
		dataSource.query
			.mockResolvedValueOnce([
				{ ...headerRow, requesterInChain: true, requesterHasHigherLevel: false },
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);

		const result = await service.prefill({ chartId: 310 }, 9, 5, 1);

		expect(result.requesterInChain).toBe(true);
		expect(result.requesterHasHigherLevel).toBe(false);
	});
});

describe('IfcService.createIfc', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock; transaction: jest.Mock; manager: { query: jest.Mock } };
	let em: { query: jest.Mock };

	beforeEach(() => {
		em = { query: jest.fn() };
		dataSource = {
			query: jest.fn(),
			manager: { query: jest.fn() },
			transaction: jest.fn(async (fn: any) => fn(em)),
		};
		({ service } = buildServices(dataSource));
	});

	const baseDto = (overrides: Partial<CreateIfcDto> = {}): CreateIfcDto => ({
		chartId: 310,
		submit: false,
		information: {},
		findings: [
			{
				tempId: 'tF',
				id: null,
				description: { es: 'f' },
				criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
			},
		],
		actions: [{ tempId: 'tA', id: null, description: { es: 'a' }, findingTempId: 'tF' }],
		...overrides,
	});

	it('rejects 404 when chart is not found in school', async () => {
		em.query.mockResolvedValueOnce([]); // CHART_RESOLUTION_SQL → empty

		await expect(service.createIfc(baseDto(), 99, 9, 5)).rejects.toMatchObject({
			kind: 'notFound',
		});
	});

	it('rejects 409 when an IFC already exists for the (course, period)', async () => {
		em.query
			.mockResolvedValueOnce([{ courseId: 100, programId: 50, requesterStaffId: 11 }]) // chart resolution
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check passes
			.mockResolvedValueOnce([{ '?column?': 1 }]); // assertNoIfcExists finds a row → throws

		await expect(service.createIfc(baseDto(), 99, 9, 5)).rejects.toMatchObject({
			kind: 'conflict',
		});
	});

	it('rejects 403 when requester is not in the course chain', async () => {
		em.query
			.mockResolvedValueOnce([{ courseId: 100, programId: 50, requesterStaffId: 22 }]) // chart resolution
			.mockResolvedValueOnce([]); // chain check returns no rows → 403

		await expect(service.createIfc(baseDto(), 99, 9, 5)).rejects.toMatchObject({
			kind: 'forbidden',
		});
	});

	it('happy path: inserts IFC + status (SAVED when submit=false) and assigns consecutive correlatives to new findings (single IFC instrument)', async () => {
		em.query
			.mockResolvedValueOnce([{ courseId: 100, programId: 50, requesterStaffId: 11 }]) // chart resolution
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([]) // assertNoIfcExists
			.mockResolvedValueOnce([{ id: 999 }]) // INSERT ifc
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id
			.mockResolvedValueOnce([{ id: 7, code: TYPE_CODES.CRITICALITY.NORMAL }]) // resolve criticality
			.mockResolvedValueOnce([{ c: 4 }]) // single base correlative for (ifcInstrument, course)
			.mockResolvedValueOnce([{ id: 201 }]) // INSERT finding 1 returning 201
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ id: 202 }]) // INSERT finding 2 returning 202
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ c: 0 }]) // action base correlative
			.mockResolvedValueOnce([{ id: 301 }]) // INSERT action 1
			.mockResolvedValueOnce([]) // INSERT finding_actions 1
			.mockResolvedValueOnce([{ id: 302 }]) // INSERT action 2
			.mockResolvedValueOnce([]) // INSERT finding_actions 2
			.mockResolvedValueOnce([
				{
					code: TYPE_CODES.IFC_STATUS.SAVED,
					name: { es: 'Guardado' },
					at: '2026',
					comment: null,
					by: 'me',
				},
			]); // insertStatus

		const dto = baseDto({
			findings: [
				{
					tempId: 't1',
					id: null,
					description: { es: 'a' },
					criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
				},
				{
					tempId: 't2',
					id: null,
					description: { es: 'b' },
					criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
				},
			],
			actions: [
				{ tempId: 'a1', id: null, description: { es: 'A1' }, findingTempId: 't1' },
				{ tempId: 'a2', id: null, description: { es: 'A2' }, findingTempId: 't2' },
			],
		});

		const result = await service.createIfc(dto, 99, 9, 5);
		expect(result).toEqual({ id: 999 });

		const firstInsert = em.query.mock.calls[7];
		const secondInsert = em.query.mock.calls[9];
		expect(firstInsert[1][1]).toBe(77); // ifcInstrumentId
		expect(secondInsert[1][1]).toBe(77);
		expect(firstInsert[1][3]).toBe(5); // base 4 + 1
		expect(secondInsert[1][3]).toBe(6); // base 4 + 2

		const statusInsert = em.query.mock.calls[16];
		expect(statusInsert[1][1]).toBe(TYPE_CODES.IFC_STATUS.SAVED);
	});

	it('inserts SUBMITTED status when submit=true', async () => {
		em.query
			.mockResolvedValueOnce([{ courseId: 100, programId: 50, requesterStaffId: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 999 }])
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id
			.mockResolvedValueOnce([{ id: 7, code: TYPE_CODES.CRITICALITY.NORMAL }]) // criticality
			.mockResolvedValueOnce([{ c: 0 }]) // findings correlative
			.mockResolvedValueOnce([{ id: 201 }]) // INSERT finding
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ c: 0 }]) // actions correlative
			.mockResolvedValueOnce([{ id: 301 }]) // INSERT action
			.mockResolvedValueOnce([]) // INSERT finding_actions
			.mockResolvedValueOnce([
				{
					code: TYPE_CODES.IFC_STATUS.SUBMITTED,
					name: { es: 'Enviado' },
					at: '2026',
					comment: null,
					by: 'me',
				},
			]);

		await service.createIfc(baseDto({ submit: true }), 99, 9, 5);

		const statusInsert = em.query.mock.calls[12];
		expect(statusInsert[1][1]).toBe(TYPE_CODES.IFC_STATUS.SUBMITTED);
	});

	it('throws 500 + ifcInstrumentMissing when the IFC instrument is not seeded', async () => {
		em.query
			.mockResolvedValueOnce([{ courseId: 100, programId: 50, requesterStaffId: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 999 }])
			.mockResolvedValueOnce([]); // resolve IFC instrument id → empty

		await expect(service.createIfc(baseDto(), 99, 9, 5)).rejects.toMatchObject({
			status: HttpStatus.INTERNAL_SERVER_ERROR,
		});
	});

	it('rolls back transaction when an inner em.query throws', async () => {
		em.query
			.mockResolvedValueOnce([{ courseId: 100, programId: 50, requesterStaffId: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(new Error('DB explosion'));

		await expect(service.createIfc(baseDto(), 99, 9, 5)).rejects.toThrow('DB explosion');
		expect(dataSource.transaction).toHaveBeenCalledTimes(1);
	});

	it('ancestor (not own coord) can create on behalf of the coordinator', async () => {
		em.query
			.mockResolvedValueOnce([{ courseId: 100, programId: 50, requesterStaffId: 11 }])
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check — requester found on ancestor
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 999 }])
			.mockResolvedValueOnce([{ id: 77 }]) // instrument
			.mockResolvedValueOnce([{ id: 7, code: TYPE_CODES.CRITICALITY.NORMAL }]) // criticality
			.mockResolvedValueOnce([{ c: 0 }]) // findings correlative
			.mockResolvedValueOnce([{ id: 201 }]) // INSERT finding
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ c: 0 }]) // actions correlative
			.mockResolvedValueOnce([{ id: 301 }]) // INSERT action
			.mockResolvedValueOnce([]) // INSERT finding_actions
			.mockResolvedValueOnce([
				{
					code: TYPE_CODES.IFC_STATUS.SAVED,
					name: { es: 's' },
					at: '2026',
					comment: null,
					by: 'me',
				},
			]);

		await expect(service.createIfc(baseDto(), 99, 9, 5)).resolves.toEqual({ id: 999 });
	});

	it('resolveFindingsAndActions: actions can reference a brand-new finding via tempId', async () => {
		em.query
			.mockResolvedValueOnce([{ courseId: 100, programId: 50, requesterStaffId: 11 }])
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
			.mockResolvedValueOnce([
				{
					code: TYPE_CODES.IFC_STATUS.SAVED,
					name: { es: 's' },
					at: '2026',
					comment: null,
					by: 'me',
				},
			]);

		const dto = baseDto({
			findings: [
				{
					tempId: 'tF',
					id: null,
					description: { es: 'f' },
					criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
				},
			],
			actions: [{ tempId: 'tA', id: null, description: { es: 'a' }, findingTempId: 'tF' }],
		});

		await service.createIfc(dto, 99, 9, 5);

		const findingActionInsert = em.query.mock.calls[11];
		expect(findingActionInsert[1][0]).toBe(201);
		expect(findingActionInsert[1][1]).toBe(301);
	});

	it('rejects 400 when findings array is empty', async () => {
		await expect(
			service.createIfc(baseDto({ findings: [], actions: [] }), 99, 9, 5),
		).rejects.toMatchObject({ kind: 'badRequest' });
		expect(em.query).not.toHaveBeenCalled();
	});

	it('rejects 400 when a finding has no matching action', async () => {
		const dto = baseDto({
			findings: [
				{
					tempId: 'tF',
					id: null,
					description: { es: 'f' },
					criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
				},
			],
			actions: [],
		});
		await expect(service.createIfc(dto, 99, 9, 5)).rejects.toMatchObject({
			kind: 'badRequest',
		});
		expect(em.query).not.toHaveBeenCalled();
	});
});

describe('IfcService.patch', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock; transaction: jest.Mock; manager: { query: jest.Mock } };
	let em: { query: jest.Mock };

	beforeEach(() => {
		em = { query: jest.fn() };
		dataSource = {
			query: jest.fn(),
			manager: { query: jest.fn() },
			transaction: jest.fn(async (fn: any) => fn(em)),
		};
		({ service } = buildServices(dataSource));
	});

	const baseDto = (overrides: Partial<IfcContentDto> = {}): IfcContentDto => ({
		submit: false,
		information: {},
		findings: [
			{
				tempId: 'tF',
				id: null,
				description: { es: 'f' },
				criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
			},
		],
		actions: [{ tempId: 'tA', id: null, description: { es: 'a' }, findingTempId: 'tF' }],
		...overrides,
	});

	const patchCtxRow = (
		overrides: Partial<{
			courseChartId: number;
			requesterStaffId: number;
			currentStatusCode: string | null;
		}> = {},
	) => [
		{
			courseChartId: 500,
			requesterStaffId: 11,
			currentStatusCode: TYPE_CODES.IFC_STATUS.SAVED,
			...overrides,
		},
	];

	it('rejects 409 when current status is SUBMITTED', async () => {
		em.query
			.mockResolvedValueOnce(patchCtxRow({ currentStatusCode: TYPE_CODES.IFC_STATUS.SUBMITTED }))
			.mockResolvedValueOnce([{ '?column?': 1 }]); // chain check passes, status fails

		await expect(service.patch(42, baseDto(), 99, 9)).rejects.toMatchObject({
			kind: 'conflict',
		});
	});

	it('rejects 409 when current status is APPROVED', async () => {
		em.query
			.mockResolvedValueOnce(patchCtxRow({ currentStatusCode: TYPE_CODES.IFC_STATUS.APPROVED }))
			.mockResolvedValueOnce([{ '?column?': 1 }]);

		await expect(service.patch(42, baseDto(), 99, 9)).rejects.toMatchObject({
			kind: 'conflict',
		});
	});

	it('rejects 403 when requester is not in the course chain', async () => {
		em.query.mockResolvedValueOnce(patchCtxRow({ requesterStaffId: 22 })).mockResolvedValueOnce([]); // chain check returns no rows

		await expect(service.patch(42, baseDto(), 99, 9)).rejects.toMatchObject({
			kind: 'forbidden',
		});
	});

	it('happy path: SAVED → SUBMITTED when submit=true (requester is own coordinator → in chain)', async () => {
		em.query
			.mockResolvedValueOnce(patchCtxRow({ currentStatusCode: TYPE_CODES.IFC_STATUS.SAVED })) // transition context
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check
			.mockResolvedValueOnce([{ courseId: 100, academicPeriodId: 5 }]) // SELECT course_id/period_id
			.mockResolvedValueOnce([{ programId: 50 }]) // program lookup
			.mockResolvedValueOnce([]) // UPDATE evidence.ifcs
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id (inside resolveFindingsAndActions)
			.mockResolvedValueOnce([{ id: 7, code: TYPE_CODES.CRITICALITY.NORMAL }]) // criticality
			.mockResolvedValueOnce([{ c: 0 }]) // findings correlative
			.mockResolvedValueOnce([{ id: 201 }]) // INSERT finding
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ c: 0 }]) // actions correlative
			.mockResolvedValueOnce([{ id: 301 }]) // INSERT action
			.mockResolvedValueOnce([]) // INSERT finding_actions
			.mockResolvedValueOnce([
				{
					code: TYPE_CODES.IFC_STATUS.SUBMITTED,
					name: { es: 'Enviado' },
					at: '2026',
					comment: null,
					by: 'me',
				},
			]); // insertStatus

		const result = await service.patch(42, baseDto({ submit: true }), 99, 9);
		expect(result).toMatchObject({ id: 42 });

		const statusInsert = em.query.mock.calls[13];
		expect(statusInsert[1][1]).toBe(TYPE_CODES.IFC_STATUS.SUBMITTED);
	});

	it('happy path: OBSERVED → SAVED when submit=false (ancestor — not own coord — passes chain check)', async () => {
		em.query
			.mockResolvedValueOnce(
				patchCtxRow({
					requesterStaffId: 11,
					currentStatusCode: TYPE_CODES.IFC_STATUS.OBSERVED,
				}),
			)
			.mockResolvedValueOnce([{ '?column?': 1 }]) // chain check — requester found on an ancestor
			.mockResolvedValueOnce([{ courseId: 100, academicPeriodId: 5 }])
			.mockResolvedValueOnce([{ programId: 50 }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: 77 }]) // resolve IFC instrument id
			.mockResolvedValueOnce([{ id: 7, code: TYPE_CODES.CRITICALITY.NORMAL }]) // criticality
			.mockResolvedValueOnce([{ c: 0 }]) // findings correlative
			.mockResolvedValueOnce([{ id: 201 }]) // INSERT finding
			.mockResolvedValueOnce([]) // INSERT ifc_findings
			.mockResolvedValueOnce([{ c: 0 }]) // actions correlative
			.mockResolvedValueOnce([{ id: 301 }]) // INSERT action
			.mockResolvedValueOnce([]) // INSERT finding_actions
			.mockResolvedValueOnce([
				{
					code: TYPE_CODES.IFC_STATUS.SAVED,
					name: { es: 's' },
					at: '2026',
					comment: null,
					by: 'me',
				},
			]);

		await service.patch(42, baseDto({ submit: false }), 99, 9);

		const statusInsert = em.query.mock.calls[13];
		expect(statusInsert[1][1]).toBe(TYPE_CODES.IFC_STATUS.SAVED);
	});

	it('rejects 400 when findings array is empty', async () => {
		await expect(
			service.patch(42, baseDto({ findings: [], actions: [] }), 99, 9),
		).rejects.toMatchObject({ kind: 'badRequest' });
		expect(em.query).not.toHaveBeenCalled();
	});

	it('rejects 400 when a finding has no matching action', async () => {
		const dto = baseDto({
			findings: [
				{
					tempId: 'tF',
					id: null,
					description: { es: 'f' },
					criticalityCode: TYPE_CODES.CRITICALITY.NORMAL,
				},
			],
			actions: [],
		});
		await expect(service.patch(42, dto, 99, 9)).rejects.toMatchObject({
			kind: 'badRequest',
		});
		expect(em.query).not.toHaveBeenCalled();
	});
});

describe('IfcService.generateStatusReport', () => {
	let service: IfcService;
	let dataSource: { query: jest.Mock };

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		({ service } = buildServices(dataSource));
	});

	const statusTypes = [
		{ code: 'TG701-T001', name: { es: 'Guardado', en: 'Saved' } },
		{ code: 'TG701-T002', name: { es: 'Enviado', en: 'Submitted' } },
		{ code: 'TG701-T003', name: { es: 'Aprobado', en: 'Approved' } },
		{ code: 'TG701-T004', name: { es: 'Observado', en: 'Observed' } },
		{ code: 'TG701-T005', name: { es: 'Sin Registro', en: 'Unregistered' } },
	];

	const dto: IfcStatusReportDto = { chartIds: [310, 311], lang: 'es' };

	it('calls STATUS_REPORT_SQL with the six expected positional params and builds <School>_<Program> filename for a single-program scope', async () => {
		dataSource.query
			.mockResolvedValueOnce([{ schoolCode: 'EISCB', programCodes: ['CS'] }]) // REPORT_CODES_SQL
			.mockResolvedValueOnce(statusTypes) // status type lookup
			.mockResolvedValueOnce([]); // STATUS_REPORT_SQL → empty rows

		const { xlsx, filename } = await service.generateStatusReport(dto, 9, 5);

		expect(Buffer.isBuffer(xlsx)).toBe(true);
		expect(xlsx.length).toBeGreaterThan(0);
		expect(filename).toBe('Reporte_Estado_IFC_EISCB_CS.xlsx');

		const [, statusReportParams] = dataSource.query.mock.calls[2];
		expect(statusReportParams).toEqual([
			[310, 311],
			5,
			9,
			TYPE_CODES.ENTITY_TYPE.COURSE,
			TYPE_CODES.ENTITY_TYPE.SCHOOL,
			'es',
		]);
	});

	it('drops the program suffix when chart_ids span multiple programs', async () => {
		dataSource.query
			.mockResolvedValueOnce([{ schoolCode: 'EISCB', programCodes: ['CS', 'PROG_SOFT'] }])
			.mockResolvedValueOnce(statusTypes)
			.mockResolvedValueOnce([]);

		const { filename } = await service.generateStatusReport(dto, 9, 5);
		expect(filename).toBe('Reporte_Estado_IFC_EISCB.xlsx');
	});

	it('falls back to instrument code when REPORT_CODES_SQL returns no school code', async () => {
		dataSource.query
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce(statusTypes)
			.mockResolvedValueOnce([]);

		const { filename } = await service.generateStatusReport(dto, 9, 5);
		expect(filename).toBe('Reporte_Estado_IFC_IFC.xlsx');
	});

	it('uses the English filename prefix when lang=en', async () => {
		dataSource.query
			.mockResolvedValueOnce([{ schoolCode: 'EISCB', programCodes: ['CS'] }])
			.mockResolvedValueOnce(statusTypes)
			.mockResolvedValueOnce([]);

		const { filename } = await service.generateStatusReport({ ...dto, lang: 'en' }, 9, 5);
		expect(filename).toBe('Status_Report_IFC_EISCB_CS.xlsx');
	});

	it('renders an XLSX where rows with statusCode=null map to TG701-T005 / "Sin Registro"', async () => {
		const ExcelJS = require('exceljs');
		const rows = [
			{
				courseName: 'Curso A',
				areaLabel: 'Área 1',
				programLabel: 'Carrera X',
				coordinatorName: 'Ada Lovelace',
				coordinatorEmail: 'ada@example.com',
				coordinatorCode: 'P1',
				statusCode: null,
			},
			{
				courseName: 'Curso B',
				areaLabel: 'Área 1',
				programLabel: 'Carrera X',
				coordinatorName: null,
				coordinatorEmail: null,
				coordinatorCode: null,
				statusCode: 'TG701-T003',
			},
		];
		dataSource.query
			.mockResolvedValueOnce([{ schoolCode: 'EISCB', programCodes: ['CS'] }])
			.mockResolvedValueOnce(statusTypes)
			.mockResolvedValueOnce(rows);

		const { xlsx } = await service.generateStatusReport(dto, 9, 5);

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(xlsx);
		const ws = wb.worksheets[0];
		expect(ws.getRow(1).getCell(1).value).toBe('Curso');
		expect(ws.getRow(2).getCell(1).value).toBe('Curso A');
		expect(ws.getRow(2).getCell(4).value).toBe('Sin Registro');
		expect(ws.getRow(2).getCell(5).value).toBe('Ada Lovelace');
		expect(ws.getRow(3).getCell(4).value).toBe('Aprobado');
		expect(ws.getRow(3).getCell(5).value).toBe('—');
		expect(ws.getRow(3).getCell(6).value).toBe('—');
		expect(ws.getRow(3).getCell(7).value).toBe('—');
	});

	it('uses the en label for UNREGISTERED when lang=en', async () => {
		const ExcelJS = require('exceljs');
		const rows = [
			{
				courseName: 'Course A',
				areaLabel: 'Area 1',
				programLabel: 'Program X',
				coordinatorName: 'Ada',
				coordinatorEmail: 'a@x',
				coordinatorCode: 'P1',
				statusCode: null,
			},
		];
		dataSource.query
			.mockResolvedValueOnce([{ schoolCode: 'EISCB', programCodes: ['CS'] }])
			.mockResolvedValueOnce(statusTypes)
			.mockResolvedValueOnce(rows);

		const { xlsx } = await service.generateStatusReport({ ...dto, lang: 'en' }, 9, 5);

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.load(xlsx);
		const ws = wb.worksheets[0];
		expect(ws.getRow(1).getCell(1).value).toBe('Course');
		expect(ws.getRow(2).getCell(4).value).toBe('Unregistered');
	});
});
