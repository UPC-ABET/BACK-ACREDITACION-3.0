import { DataSource, Repository } from 'typeorm';
import { DomainError } from 'src/commons/domain-error';
import { ChartEntity } from '../model/charts.entity';
import { ChartRepository, UNIQUE_CHART_ENTITY_INDEX } from './charts.repository';
import { chartsValidationStrings } from '../config/strings/charts.validation';

// Spelled out rather than imported, so a rename of the exported constant has to be a deliberate
// two-place edit instead of a silent one that keeps this file green.
const UNIQUE_INDEX = 'UQ_charts_academic_period_entity_type_entity_code';

// Shaped like the pg driver error TypeORM re-throws: SQLSTATE in `code`, index name in `constraint`.
const pgError = (code: string, constraint?: string) =>
	Object.assign(new Error('duplicate key value violates unique constraint'), {
		code,
		constraint,
	});

const buildRepository = () => {
	const typeorm = {
		create: jest.fn((data) => data),
		save: jest.fn(),
		update: jest.fn(),
		findOne: jest.fn(),
		metadata: { columns: [] },
	};
	const repository = new ChartRepository(
		typeorm as unknown as Repository<ChartEntity>,
		{} as DataSource,
	);
	return { repository, typeorm };
};

describe('ChartRepository — duplicate-node race translation', () => {
	describe('create', () => {
		it('translates a unique violation on the chart index into a conflict', async () => {
			const { repository, typeorm } = buildRepository();
			typeorm.save.mockRejectedValue(pgError('23505', UNIQUE_INDEX));

			await expect(repository.create({ entityCode: 50 })).rejects.toThrow(DomainError);
			await expect(repository.create({ entityCode: 50 })).rejects.toMatchObject({
				kind: 'conflict',
				messageKey: chartsValidationStrings.error.entityAlreadyAssigned,
			});
		});

		it('rethrows a unique violation on a different constraint untouched', async () => {
			const { repository, typeorm } = buildRepository();
			const original = pgError('23505', 'UQ_some_other_table_code');
			typeorm.save.mockRejectedValue(original);

			await expect(repository.create({ entityCode: 50 })).rejects.toBe(original);
		});

		it('rethrows a non-unique-violation error untouched', async () => {
			const { repository, typeorm } = buildRepository();
			const original = pgError('23503', UNIQUE_INDEX);
			typeorm.save.mockRejectedValue(original);

			await expect(repository.create({ entityCode: 50 })).rejects.toBe(original);
		});
	});

	describe('update', () => {
		it('translates a unique violation on the chart index into a conflict', async () => {
			const { repository, typeorm } = buildRepository();
			typeorm.update.mockRejectedValue(pgError('23505', UNIQUE_INDEX));

			await expect(repository.update(1, { entityCode: 50 })).rejects.toMatchObject({
				kind: 'conflict',
				messageKey: chartsValidationStrings.error.entityAlreadyAssigned,
			});
		});

		it('rethrows a unique violation on a different constraint untouched', async () => {
			const { repository, typeorm } = buildRepository();
			const original = pgError('23505', 'UQ_some_other_table_code');
			typeorm.update.mockRejectedValue(original);

			await expect(repository.update(1, { entityCode: 50 })).rejects.toBe(original);
		});
	});

	// updateNode writes through the TypeORM repository directly rather than BaseRepository.update,
	// so it does not inherit the override above and needs its own coverage. This is the maintenance
	// edit path — the one the org chart UI actually calls.
	describe('updateNode', () => {
		it('translates a unique violation on the chart index into a conflict', async () => {
			const { repository, typeorm } = buildRepository();
			typeorm.update.mockRejectedValue(pgError('23505', UNIQUE_INDEX));

			await expect(repository.updateNode(1, { entityCode: 50 })).rejects.toMatchObject({
				kind: 'conflict',
				messageKey: chartsValidationStrings.error.entityAlreadyAssigned,
			});
		});

		it('rethrows a unique violation on a different constraint untouched', async () => {
			const { repository, typeorm } = buildRepository();
			const original = pgError('23505', 'UQ_some_other_table_code');
			typeorm.update.mockRejectedValue(original);

			await expect(repository.updateNode(1, { entityCode: 50 })).rejects.toBe(original);
		});

		it('resolves normally when the write succeeds', async () => {
			const { repository, typeorm } = buildRepository();
			typeorm.update.mockResolvedValue({ affected: 1 });

			await expect(repository.updateNode(1, { entityCode: 50 })).resolves.toBeUndefined();
		});
	});

	describe('the index name is a shared contract', () => {
		it('exports the constant the migration creates', () => {
			expect(UNIQUE_CHART_ENTITY_INDEX).toBe(UNIQUE_INDEX);
		});
	});
});
