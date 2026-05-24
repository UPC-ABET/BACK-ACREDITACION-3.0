import { DataSource } from 'typeorm';
import { OrgScopeService } from './org-scope.service';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

describe('OrgScopeService', () => {
	let service: OrgScopeService;
	let dataSource: { query: jest.Mock };

	beforeEach(() => {
		dataSource = { query: jest.fn() };
		service = new OrgScopeService(dataSource as unknown as DataSource);
	});

	it('returns empty scope when schoolId is null (user not attached to a school)', async () => {
		const result = await service.getScope(1, null, 5);

		expect(result).toEqual({ highest_level: null, levels: [] });
		expect(dataSource.query).not.toHaveBeenCalled();
	});

	it('returns empty scope when SQL returns no rows', async () => {
		dataSource.query.mockResolvedValueOnce([]);

		const result = await service.getScope(1, 7, 5);

		expect(result).toEqual({ highest_level: null, levels: [] });
		expect(dataSource.query).toHaveBeenCalledTimes(1);
		expect(dataSource.query.mock.calls[0][1]).toEqual([
			1,
			7,
			5,
			TYPE_CODES.CHART_LEVEL_TYPE.SCHOOL_DIRECTOR,
		]);
	});

	it('groups rows by level_num in ascending order and computes highest_level from anchors', async () => {
		dataSource.query.mockResolvedValueOnce([
			{
				id: 30,
				parent_id: 20,
				level_num: 3,
				type_code: 'TG902-T003',
				label: { es: 'Programa' },
				is_anchor: false,
			},
			{
				id: 20,
				parent_id: 10,
				level_num: 2,
				type_code: 'TG902-T002',
				label: { es: 'Escuela' },
				is_anchor: true,
			},
			{
				id: 10,
				parent_id: null,
				level_num: 1,
				type_code: 'TG902-T001',
				label: { es: 'Decanato' },
				is_anchor: false,
			},
			{
				id: 40,
				parent_id: 30,
				level_num: 4,
				type_code: 'TG902-T004',
				label: { es: 'Area' },
				is_anchor: true,
			},
		]);

		const result = await service.getScope(7, 11, 5);

		expect(result.highest_level).toBe(2);
		expect(result.levels.map((l) => l.level_num)).toEqual([1, 2, 3, 4]);
		expect(result.levels[0]).toEqual({
			level_num: 1,
			type_code: 'TG902-T001',
			options: [{ id: 10, label: { es: 'Decanato' }, parent_id: null }],
		});
		expect(result.levels[1]).toEqual({
			level_num: 2,
			type_code: 'TG902-T002',
			options: [{ id: 20, label: { es: 'Escuela' }, parent_id: 10 }],
		});
	});

	it('coalesces multiple options per level into the same bucket', async () => {
		dataSource.query.mockResolvedValueOnce([
			{
				id: 11,
				parent_id: 1,
				level_num: 2,
				type_code: 'TG902-T002',
				label: { es: 'A' },
				is_anchor: true,
			},
			{
				id: 12,
				parent_id: 1,
				level_num: 2,
				type_code: 'TG902-T002',
				label: { es: 'B' },
				is_anchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.highest_level).toBe(2);
		expect(result.levels).toHaveLength(1);
		expect(result.levels[0].options).toHaveLength(2);
	});

	it('sets highest_level to null when no row is marked is_anchor', async () => {
		dataSource.query.mockResolvedValueOnce([
			{
				id: 1,
				parent_id: null,
				level_num: 1,
				type_code: 'TG902-T001',
				label: {},
				is_anchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.highest_level).toBeNull();
		expect(result.levels).toHaveLength(1);
	});
});
