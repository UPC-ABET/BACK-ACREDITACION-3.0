import { DataSource } from 'typeorm';
import { TypeService } from './types.service';
import { TypeRepository } from '../core/types.repository';
import { TYPE_GROUP_CODES, TYPE_CODES } from '../constants/type-codes';

describe('TypeService.findByGroupCode', () => {
	let service: TypeService;
	let dataSource: { query: jest.Mock };
	const repository = {} as TypeRepository;

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		service = new TypeService(repository, dataSource as unknown as DataSource);
	});

	it('passes the group code through to the SQL query', async () => {
		dataSource.query.mockResolvedValueOnce([]);

		await service.findByGroupCode(TYPE_GROUP_CODES.CRITICALITY);

		expect(dataSource.query).toHaveBeenCalledTimes(1);
		const [sql, params] = dataSource.query.mock.calls[0];
		expect(sql).toMatch(/core\.types/);
		expect(sql).toMatch(/core\.type_groups/);
		expect(sql).toMatch(/is_active = true/);
		expect(sql).toMatch(/ORDER BY t\.code/);
		expect(params).toEqual([TYPE_GROUP_CODES.CRITICALITY]);
	});

	it('returns the rows as-is from the data source (passthrough)', async () => {
		const rows = [
			{ id: 1, code: TYPE_CODES.CRITICALITY.CRITICAL, name: { es: 'Crítico' }, description: {} },
			{ id: 2, code: TYPE_CODES.CRITICALITY.WORRYING, name: { es: 'Preocupante' }, description: {} },
			{ id: 3, code: TYPE_CODES.CRITICALITY.NORMAL, name: { es: 'Normal' }, description: {} },
		];
		dataSource.query.mockResolvedValueOnce(rows);

		const result = await service.findByGroupCode(TYPE_GROUP_CODES.CRITICALITY);

		expect(result).toBe(rows);
		expect(result).toHaveLength(3);
	});
});
