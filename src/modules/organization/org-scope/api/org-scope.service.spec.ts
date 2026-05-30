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

		expect(result).toEqual({ highestLevel: null, levels: [] });
		expect(dataSource.query).not.toHaveBeenCalled();
	});

	it('returns empty scope when SQL returns no rows', async () => {
		dataSource.query.mockResolvedValueOnce([]);

		const result = await service.getScope(1, 7, 5);

		expect(result).toEqual({ highestLevel: null, levels: [] });
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
				parentId: 20,
				levelNum: 3,
				typeCode: 'TG902-T003',
				label: { es: 'Programa' },
				isAnchor: false,
			},
			{
				id: 20,
				parentId: 10,
				levelNum: 2,
				typeCode: 'TG902-T002',
				label: { es: 'Escuela' },
				isAnchor: true,
			},
			{
				id: 10,
				parentId: null,
				levelNum: 1,
				typeCode: 'TG902-T001',
				label: { es: 'Decanato' },
				isAnchor: false,
			},
			{
				id: 40,
				parentId: 30,
				levelNum: 4,
				typeCode: 'TG902-T004',
				label: { es: 'Area' },
				isAnchor: true,
			},
		]);

		const result = await service.getScope(7, 11, 5);

		expect(result.highestLevel).toBe(2);
		expect(result.levels.map((l) => l.levelNum)).toEqual([1, 2, 3, 4]);
		expect(result.levels[0]).toEqual({
			levelNum: 1,
			typeCode: 'TG902-T001',
			options: [{ id: 10, label: { es: 'Decanato' }, parentId: null }],
		});
		expect(result.levels[1]).toEqual({
			levelNum: 2,
			typeCode: 'TG902-T002',
			options: [{ id: 20, label: { es: 'Escuela' }, parentId: 10 }],
		});
	});

	it('coalesces multiple options per level into the same bucket', async () => {
		dataSource.query.mockResolvedValueOnce([
			{
				id: 11,
				parentId: 1,
				levelNum: 2,
				typeCode: 'TG902-T002',
				label: { es: 'A' },
				isAnchor: true,
			},
			{
				id: 12,
				parentId: 1,
				levelNum: 2,
				typeCode: 'TG902-T002',
				label: { es: 'B' },
				isAnchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.highestLevel).toBe(2);
		expect(result.levels).toHaveLength(1);
		expect(result.levels[0].options).toHaveLength(2);
	});

	it('sets highest_level to null when no row is marked is_anchor', async () => {
		dataSource.query.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 1,
				typeCode: 'TG902-T001',
				label: {},
				isAnchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.highestLevel).toBeNull();
		expect(result.levels).toHaveLength(1);
	});
});
