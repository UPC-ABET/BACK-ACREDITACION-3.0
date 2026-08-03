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
	};
	return { service: new ChartService(repository as any), repository };
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
