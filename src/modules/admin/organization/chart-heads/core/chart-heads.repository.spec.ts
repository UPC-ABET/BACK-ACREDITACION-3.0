import { UNIQUE_CHART_ENTITY_INDEX } from 'src/modules/organization/charts/core/charts.repository';
import { ChartHeadsRepository } from './chart-heads.repository';
import { chartHeadsValidationStrings } from '../config/strings/chart-heads.validation';
import type { ConfigureChartHeadsDto } from '../model/chart-heads.dtos';

// Shaped like the pg driver error TypeORM re-throws: SQLSTATE in `code`, index name in `constraint`.
const pgError = (code: string, constraint?: string) =>
	Object.assign(new Error('duplicate key value violates unique constraint'), { code, constraint });

function buildRepository(chartsRepoStub: {
	findOne: jest.Mock;
	create: jest.Mock;
	save: jest.Mock;
	update: jest.Mock;
}) {
	const manager = {
		query: jest.fn().mockResolvedValue([{ id: 1 }]),
		getRepository: jest.fn().mockReturnValue(chartsRepoStub),
	};
	const dataSource = {
		transaction: jest.fn((cb: (m: typeof manager) => Promise<void>) => cb(manager)),
	};
	const repository = new ChartHeadsRepository(dataSource as any);
	return repository;
}

function makeDto(): ConfigureChartHeadsDto {
	return {
		academicPeriodId: 1,
		dean: { staffId: 1, title: { es: 'Decanato' } },
		directors: [],
	} as ConfigureChartHeadsDto;
}

describe('ChartHeadsRepository — upsertHead race translation', () => {
	// upsertHead writes through TypeORM's own repository, not ChartRepository, so it must translate
	// the unique-index race itself: two concurrent configure() calls creating the same brand-new
	// entity (e.g. the same Program under two schools at once) both pass the pre-check and then race
	// on insert. Without this, the losing call surfaces as a raw 500 instead of a domain conflict.
	it('translates a unique violation on the chart index into a conflict', async () => {
		const chartsRepoStub = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn((data: unknown) => data),
			save: jest.fn().mockRejectedValue(pgError('23505', UNIQUE_CHART_ENTITY_INDEX)),
			update: jest.fn(),
		};
		const repository = buildRepository(chartsRepoStub);

		await expect(repository.configure(makeDto())).rejects.toMatchObject({
			kind: 'conflict',
			messageKey: chartHeadsValidationStrings.error.programAssignedToOtherSchool,
		});
	});

	it('translates a unique violation on the chart index during an update into a conflict', async () => {
		const chartsRepoStub = {
			findOne: jest.fn().mockResolvedValue({ id: 42 }),
			create: jest.fn((data: unknown) => data),
			save: jest.fn(),
			update: jest.fn().mockRejectedValue(pgError('23505', UNIQUE_CHART_ENTITY_INDEX)),
		};
		const repository = buildRepository(chartsRepoStub);

		await expect(repository.configure(makeDto())).rejects.toMatchObject({
			kind: 'conflict',
			messageKey: chartHeadsValidationStrings.error.programAssignedToOtherSchool,
		});
	});

	it('rethrows a unique violation on a different constraint untouched', async () => {
		const original = pgError('23505', 'UQ_some_other_table_code');
		const chartsRepoStub = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn((data: unknown) => data),
			save: jest.fn().mockRejectedValue(original),
			update: jest.fn(),
		};
		const repository = buildRepository(chartsRepoStub);

		await expect(repository.configure(makeDto())).rejects.toBe(original);
	});

	it('does not translate an unrelated error', async () => {
		const original = new Error('connection lost');
		const chartsRepoStub = {
			findOne: jest.fn().mockResolvedValue(null),
			create: jest.fn((data: unknown) => data),
			save: jest.fn().mockRejectedValue(original),
			update: jest.fn(),
		};
		const repository = buildRepository(chartsRepoStub);

		await expect(repository.configure(makeDto())).rejects.toBe(original);
	});
});
