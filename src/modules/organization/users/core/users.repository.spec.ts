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
