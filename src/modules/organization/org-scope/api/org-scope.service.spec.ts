import { OrgScopeService } from './org-scope.service';
import { OrgScopeRepository } from '../core/org-scope.repository';

describe('OrgScopeService', () => {
	let service: OrgScopeService;
	let repository: {
		findScope: jest.Mock;
		findUserSchools: jest.Mock;
	};

	beforeEach(() => {
		repository = {
			findScope: jest.fn(),
			findUserSchools: jest.fn(),
		};
		service = new OrgScopeService(repository as unknown as OrgScopeRepository);
	});

	it('returns empty scope when schoolId is null (user not attached to a school)', async () => {
		const result = await service.getScope(1, null, 5);

		expect(result).toEqual({ highestLevel: null, levels: [] });
		expect(repository.findScope).not.toHaveBeenCalled();
	});

	it('returns empty scope when SQL returns no rows', async () => {
		repository.findScope.mockResolvedValueOnce([]);

		const result = await service.getScope(1, 7, 5);

		expect(result).toEqual({ highestLevel: null, levels: [] });
		expect(repository.findScope).toHaveBeenCalledTimes(1);
		expect(repository.findScope).toHaveBeenCalledWith(1, 7, 5);
	});

	it('groups rows by level_num in ascending order and computes highest_level from anchors', async () => {
		repository.findScope.mockResolvedValueOnce([
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
		repository.findScope.mockResolvedValueOnce([
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
		repository.findScope.mockResolvedValueOnce([
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

	it('returns schools assigned to the user for the active academic period by modality', async () => {
		const rows = [
			{
				id: 1,
				code: 'SCHOOL',
				name: { en: 'School' },
				facultyId: 2,
				facultyCode: 'FAC',
				facultyName: { en: 'Faculty' },
			},
		];
		repository.findUserSchools.mockResolvedValueOnce(rows);

		const result = await service.getUserSchools(3, 4);

		expect(result).toBe(rows);
		expect(repository.findUserSchools).toHaveBeenCalledWith(3, 4);
	});
});
