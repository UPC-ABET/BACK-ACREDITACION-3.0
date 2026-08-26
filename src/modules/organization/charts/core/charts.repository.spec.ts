import { DataSource, Repository } from 'typeorm';
import { DomainError } from 'src/commons/domain-error';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { ChartEntity } from '../model/charts.entity';
import { ChartRepository, UNIQUE_CHART_ENTITY_INDEX } from './charts.repository';
import { chartsValidationStrings } from '../config/strings/charts.validation';

const ENTITY = TYPE_CODES.ENTITY_TYPE;

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

// The branch-CTE's actual filtering behaviour (DEAN global scope, School isolation) is SQL and is
// NOT exercised here — dataSource.query is mocked. What is testable is the parameter-binding
// contract, per the convention in grades-rc-export.repository.spec.ts. See runbook.md for the
// manual verification of AC-3/AC-4.
describe('ChartRepository.findChartUsersByTypes', () => {
	const buildRepositoryWithDataSource = () => {
		const dataSource = { query: jest.fn() };
		const repository = new ChartRepository(
			{} as unknown as Repository<ChartEntity>,
			dataSource as unknown as DataSource,
		);
		return { repository, dataSource };
	};

	it('binds rootChartId, schoolChartId and entityTypeCodes in that order', async () => {
		const { repository, dataSource } = buildRepositoryWithDataSource();
		dataSource.query.mockResolvedValue([]);

		await repository.findChartUsersByTypes(1, 2, [ENTITY.SCHOOL, ENTITY.PROGRAM]);

		expect(dataSource.query).toHaveBeenCalledTimes(1);
		const [sql, params] = dataSource.query.mock.calls[0];
		expect(sql).toMatch(/WITH RECURSIVE branch/);
		expect(params).toEqual([1, 2, [ENTITY.SCHOOL, ENTITY.PROGRAM]]);
	});

	it('left-joins (not inner-joins) an active user, so a deactivated account nulls userId instead of dropping the row', async () => {
		const { repository, dataSource } = buildRepositoryWithDataSource();
		dataSource.query.mockResolvedValue([]);

		await repository.findChartUsersByTypes(1, 2, [ENTITY.COURSE]);

		const [sql] = dataSource.query.mock.calls[0];
		// LEFT JOIN matters as much as the is_active condition: an INNER JOIN with the same ON
		// clause would silently drop a deactivated-user's chart node from the result entirely
		// instead of surfacing it as skipped, changing observable API behavior.
		expect(sql).toMatch(
			/LEFT\s+JOIN\s+organization\.users\s+u\s+ON\s+u\.id\s*=\s*s\.user_id\s+AND\s+u\.is_active\s*=\s*true/,
		);
	});

	it('returns whatever rows resolve, including a node with no linked user', async () => {
		const { repository, dataSource } = buildRepositoryWithDataSource();
		const rows = [
			{ chartId: 10, entityTypeCode: ENTITY.COURSE, staffId: 20, userId: null },
			{ chartId: 11, entityTypeCode: ENTITY.PROGRAM, staffId: 21, userId: 99 },
		];
		dataSource.query.mockResolvedValue(rows);

		const result = await repository.findChartUsersByTypes(1, 2, [ENTITY.COURSE, ENTITY.PROGRAM]);

		expect(result).toEqual(rows);
	});
});
