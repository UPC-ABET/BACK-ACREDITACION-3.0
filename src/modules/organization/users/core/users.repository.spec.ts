import { DataSource, Repository } from 'typeorm';
import { UserEntity } from '../model/users.entity';
import { UserRepository } from './users.repository';

const buildRepository = () => {
	const typeorm = {
		find: jest.fn(),
	};
	const repository = new UserRepository(
		typeorm as unknown as Repository<UserEntity>,
		{} as DataSource,
	);
	return { repository, typeorm };
};

const buildRepositoryWithDataSource = () => {
	const dataSource = {
		query: jest.fn(),
	};
	const repository = new UserRepository(
		{} as unknown as Repository<UserEntity>,
		dataSource as unknown as DataSource,
	);
	return { repository, dataSource };
};

describe('UserRepository.findDisplayNamesByIds', () => {
	it('returns an empty map without querying when given no ids', async () => {
		const { repository, typeorm } = buildRepository();

		await expect(repository.findDisplayNamesByIds([])).resolves.toEqual(new Map());
		expect(typeorm.find).not.toHaveBeenCalled();
	});

	it('maps each id to its "firstName lastName" display name', async () => {
		const { repository, typeorm } = buildRepository();
		typeorm.find.mockResolvedValue([
			{ id: 1, firstName: 'Ada', lastName: 'Lovelace' },
			{ id: 2, firstName: 'Alan', lastName: 'Turing' },
		]);

		const result = await repository.findDisplayNamesByIds([1, 2]);

		expect(result.get(1)).toBe('Ada Lovelace');
		expect(result.get(2)).toBe('Alan Turing');
		expect(typeorm.find).toHaveBeenCalledTimes(1);
	});

	it('omits ids that were not found', async () => {
		const { repository, typeorm } = buildRepository();
		typeorm.find.mockResolvedValue([{ id: 1, firstName: 'Ada', lastName: 'Lovelace' }]);

		const result = await repository.findDisplayNamesByIds([1, 999]);

		expect(result.has(999)).toBe(false);
		expect(result.size).toBe(1);
	});

	it('omits a matched user whose display name is blank', async () => {
		const { repository, typeorm } = buildRepository();
		typeorm.find.mockResolvedValue([
			{ id: 1, firstName: 'Ada', lastName: 'Lovelace' },
			{ id: 2, firstName: '', lastName: '' },
		]);

		const result = await repository.findDisplayNamesByIds([1, 2]);

		expect(result.has(2)).toBe(false);
		expect(result.size).toBe(1);
	});
});

describe('UserRepository.resetPasswordsByIds', () => {
	it('returns an empty array without querying when given no ids', async () => {
		const { repository, dataSource } = buildRepositoryWithDataSource();

		await expect(repository.resetPasswordsByIds([], 'hash')).resolves.toEqual([]);
		expect(dataSource.query).not.toHaveBeenCalled();
	});

	it('updates the password for exactly the given ids and returns the affected users', async () => {
		const { repository, dataSource } = buildRepositoryWithDataSource();
		dataSource.query.mockResolvedValue([
			[
				{ id: 1, firstName: 'Ada', lastName: 'Lovelace' },
				{ id: 2, firstName: 'Alan', lastName: 'Turing' },
			],
			2,
		]);

		const result = await repository.resetPasswordsByIds([1, 2], 'hashed-value');

		expect(dataSource.query).toHaveBeenCalledTimes(1);
		const [sql, params] = dataSource.query.mock.calls[0];
		expect(sql).toMatch(/UPDATE organization\.users/);
		expect(params).toEqual(['hashed-value', [1, 2]]);
		expect(result).toEqual([
			{ id: 1, firstName: 'Ada', lastName: 'Lovelace' },
			{ id: 2, firstName: 'Alan', lastName: 'Turing' },
		]);
	});
});
