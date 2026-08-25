import { DomainError } from 'src/commons/domain-error';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { ChartService } from './charts.service';
import { ChartValidation } from '../core/charts.validation';

const ENTITY = TYPE_CODES.ENTITY_TYPE;

const COURSE_NODE = {
	id: 5,
	academicPeriodId: 100,
	entityTypeId: 9,
	entityTypeCode: ENTITY.COURSE,
	entityCode: 50,
};

const buildService = () => {
	const repository = {
		getNodeWithType: jest.fn().mockResolvedValue(COURSE_NODE),
		getEntityTypeCode: jest.fn(),
		updateNode: jest.fn().mockResolvedValue(undefined),
		getSchoolChartNode: jest.fn(),
		findChartUsersByTypes: jest.fn(),
	};
	const userService = { resetPasswordsToDefault: jest.fn() };
	return {
		service: new ChartService(repository as any, userService as any),
		repository,
		userService,
	};
};

// The partial handed to repository.updateNode is what actually reaches the database, so these
// assertions are the guard against ChartService and ChartValidation drifting apart: both must
// resolve the effective entity through resolveEffectiveEntity, or one validates a trio the other
// never writes and duplicates slip past the check.
describe('ChartService.updateNode — effective entity written', () => {
	beforeEach(() => {
		jest.restoreAllMocks();
		jest.spyOn(ChartValidation, 'validateMaintenanceUpdate').mockResolvedValue(undefined);
	});

	it('writes no entity fields at all for a title-only edit', async () => {
		const { service, repository } = buildService();

		await service.updateNode(5, { title: { es: 'nuevo', en: 'new' } });

		const partial = repository.updateNode.mock.calls[0][1];
		expect(partial).toEqual({ title: { es: 'nuevo', en: 'new' } });
		expect(partial).not.toHaveProperty('entityCode');
		expect(partial).not.toHaveProperty('entityTypeId');
		expect(repository.getNodeWithType).not.toHaveBeenCalled();
	});

	it('resolves a code-only edit against the node existing entity type', async () => {
		const { service, repository } = buildService();

		await service.updateNode(5, { entityCode: 51 });

		expect(repository.updateNode).toHaveBeenCalledWith(5, { entityCode: 51 });
		expect(repository.getEntityTypeCode).not.toHaveBeenCalled();
	});

	it('re-resolves the code against a new entity type', async () => {
		const { service, repository } = buildService();
		repository.getEntityTypeCode.mockResolvedValue(ENTITY.PROGRAM);

		await service.updateNode(5, { entityTypeId: 12, entityCode: 77 });

		expect(repository.updateNode).toHaveBeenCalledWith(5, { entityTypeId: 12, entityCode: 77 });
	});

	it('drops the code when the new entity type carries none', async () => {
		const { service, repository } = buildService();
		repository.getEntityTypeCode.mockResolvedValue(ENTITY.AREA);

		await service.updateNode(5, { entityTypeId: 12, entityCode: 77 });

		expect(repository.updateNode).toHaveBeenCalledWith(5, { entityTypeId: 12, entityCode: null });
	});

	it('fails with a domain error when the node disappears between validation and write', async () => {
		const { service, repository } = buildService();
		repository.getNodeWithType.mockResolvedValue(null);

		await expect(service.updateNode(5, { entityCode: 51 })).rejects.toThrow(DomainError);
		expect(repository.updateNode).not.toHaveBeenCalled();
	});
});

describe('ChartService.resetMaintenancePasswords', () => {
	it('returns an empty result without calling the repository when the school has no chart yet', async () => {
		const { service, repository, userService } = buildService();
		repository.getSchoolChartNode.mockResolvedValue(null);

		const result = await service.resetMaintenancePasswords(100, 7, [ENTITY.SCHOOL]);

		expect(result).toEqual({ reset: [], skipped: [] });
		expect(repository.findChartUsersByTypes).not.toHaveBeenCalled();
		expect(userService.resetPasswordsToDefault).not.toHaveBeenCalled();
	});

	it('uses the Dean as root when the school node has no parent', async () => {
		const { service, repository } = buildService();
		repository.getSchoolChartNode.mockResolvedValue({ id: 7, rootChartId: null });
		repository.findChartUsersByTypes.mockResolvedValue([]);

		await service.resetMaintenancePasswords(100, 7, [ENTITY.SCHOOL]);

		expect(repository.findChartUsersByTypes).toHaveBeenCalledWith(7, 7, [ENTITY.SCHOOL]);
	});

	it('uses the existing rootChartId as root when the school node has a parent', async () => {
		const { service, repository } = buildService();
		repository.getSchoolChartNode.mockResolvedValue({ id: 7, rootChartId: 1 });
		repository.findChartUsersByTypes.mockResolvedValue([]);

		await service.resetMaintenancePasswords(100, 7, [ENTITY.COURSE]);

		expect(repository.findChartUsersByTypes).toHaveBeenCalledWith(1, 7, [ENTITY.COURSE]);
	});

	it('skips a node with no linked user and reports it, without resetting anything for it', async () => {
		const { service, repository, userService } = buildService();
		repository.getSchoolChartNode.mockResolvedValue({ id: 7, rootChartId: 1 });
		repository.findChartUsersByTypes.mockResolvedValue([
			{ chartId: 30, entityTypeCode: ENTITY.COURSE, staffId: 40, userId: null },
		]);

		const result = await service.resetMaintenancePasswords(100, 7, [ENTITY.COURSE]);

		expect(result).toEqual({
			reset: [],
			skipped: [{ chartId: 30, staffId: 40, entityTypeCode: ENTITY.COURSE }],
		});
		expect(userService.resetPasswordsToDefault).not.toHaveBeenCalled();
	});

	it('resets a user reachable through two in-scope nodes exactly once', async () => {
		const { service, repository, userService } = buildService();
		repository.getSchoolChartNode.mockResolvedValue({ id: 7, rootChartId: 1 });
		repository.findChartUsersByTypes.mockResolvedValue([
			{ chartId: 30, entityTypeCode: ENTITY.PROGRAM, staffId: 40, userId: 99 },
			{ chartId: 31, entityTypeCode: ENTITY.AREA, staffId: 41, userId: 99 },
		]);
		userService.resetPasswordsToDefault.mockResolvedValue([
			{ id: 99, firstName: 'Ada', lastName: 'Lovelace' },
		]);

		const result = await service.resetMaintenancePasswords(100, 7, [ENTITY.PROGRAM, ENTITY.AREA]);

		expect(userService.resetPasswordsToDefault).toHaveBeenCalledTimes(1);
		expect(userService.resetPasswordsToDefault).toHaveBeenCalledWith([99]);
		expect(result).toEqual({
			reset: [{ userId: 99, firstName: 'Ada', lastName: 'Lovelace', chartIds: [30, 31] }],
			skipped: [],
		});
	});

	it('reports every row as skipped and never calls userService when all matched rows are unlinked', async () => {
		const { service, repository, userService } = buildService();
		repository.getSchoolChartNode.mockResolvedValue({ id: 7, rootChartId: 1 });
		repository.findChartUsersByTypes.mockResolvedValue([
			{ chartId: 30, entityTypeCode: ENTITY.COURSE, staffId: 40, userId: null },
			{ chartId: 31, entityTypeCode: ENTITY.AREA, staffId: 41, userId: null },
		]);

		const result = await service.resetMaintenancePasswords(100, 7, [ENTITY.COURSE, ENTITY.AREA]);

		expect(userService.resetPasswordsToDefault).not.toHaveBeenCalled();
		expect(result).toEqual({
			reset: [],
			skipped: [
				{ chartId: 30, staffId: 40, entityTypeCode: ENTITY.COURSE },
				{ chartId: 31, staffId: 41, entityTypeCode: ENTITY.AREA },
			],
		});
	});
});
