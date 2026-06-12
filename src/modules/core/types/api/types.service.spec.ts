import { TypeService } from './types.service';
import { TypeRepository } from '../core/types.repository';
import { TYPE_GROUP_CODES, TYPE_CODES } from '../constants/type-codes';

describe('TypeService.findByGroupCode', () => {
	let service: TypeService;
	let repository: { findByGroupCode: jest.Mock };

	beforeEach(() => {
		repository = { findByGroupCode: jest.fn() };
		service = new TypeService(repository as unknown as TypeRepository);
	});

	it('delegates to the repository with the group code', async () => {
		repository.findByGroupCode.mockResolvedValueOnce([]);

		await service.findByGroupCode(TYPE_GROUP_CODES.CRITICALITY);

		expect(repository.findByGroupCode).toHaveBeenCalledTimes(1);
		expect(repository.findByGroupCode).toHaveBeenCalledWith(TYPE_GROUP_CODES.CRITICALITY);
	});

	it('returns the rows as-is from the repository (passthrough)', async () => {
		const rows = [
			{
				id: 1,
				typeGroupId: 80,
				code: TYPE_CODES.CRITICALITY.CRITICAL,
				name: { es: 'Crítico' },
				description: {},
				extra: { color: '#dc2626' },
			},
			{
				id: 2,
				typeGroupId: 80,
				code: TYPE_CODES.CRITICALITY.WORRYING,
				name: { es: 'Preocupante' },
				description: {},
				extra: {},
			},
		];
		repository.findByGroupCode.mockResolvedValueOnce(rows);

		const result = await service.findByGroupCode(TYPE_GROUP_CODES.CRITICALITY);

		expect(result).toBe(rows);
		expect(result).toHaveLength(2);
	});
});
