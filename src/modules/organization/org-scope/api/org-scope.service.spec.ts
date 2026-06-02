import { OrgScopeService } from './org-scope.service';
import { OrgScopeRepository } from '../core/org-scope.repository';
import type { UserSchoolsRepository } from '../core/user-schools/user-schools.repository.interface';

describe('OrgScopeService', () => {
	let service: OrgScopeService;
	let orgScopeRepository: {
		findScope: jest.Mock;
	};
	let userSchoolsRepository: {
		findUserSchools: jest.Mock;
	};

	beforeEach(() => {
		orgScopeRepository = {
			findScope: jest.fn(),
		};
		userSchoolsRepository = {
			findUserSchools: jest.fn(),
		};
		service = new OrgScopeService(
			orgScopeRepository as unknown as OrgScopeRepository,
			userSchoolsRepository as unknown as UserSchoolsRepository,
		);
	});

	it('returns empty scope when schoolId is null (user not attached to a school)', async () => {
		const result = await service.getScope(1, null, 5);

		expect(result).toEqual({ highestLevel: null, levels: [] });
		expect(orgScopeRepository.findScope).not.toHaveBeenCalled();
	});

	it('returns empty scope when SQL returns no rows', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([]);

		const result = await service.getScope(1, 7, 5);

		expect(result).toEqual({ highestLevel: null, levels: [] });
		expect(orgScopeRepository.findScope).toHaveBeenCalledTimes(1);
		expect(orgScopeRepository.findScope).toHaveBeenCalledWith(1, 7, 5);
	});

	it('drops the school and every level above it, keeping only levels below the school', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
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

		expect(result.highestLevel).toBe(4);
		expect(result.levels.map((l) => l.levelNum)).toEqual([3, 4]);
		expect(result.levels[0]).toEqual({
			levelNum: 3,
			typeCode: 'TG902-T003',
			options: [{ id: 30, label: { es: 'Programa' }, parentId: null }],
		});
		expect(result.levels[1]).toEqual({
			levelNum: 4,
			typeCode: 'TG902-T004',
			options: [{ id: 40, label: { es: 'Area' }, parentId: 30 }],
		});
	});

	it('excludes professor-level nodes from the options', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 2,
				typeCode: 'TG902-T002',
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 2,
				parentId: 1,
				levelNum: 6,
				typeCode: 'TG902-T006',
				label: { es: 'Curso' },
				isAnchor: true,
			},
			{
				id: 3,
				parentId: 2,
				levelNum: 7,
				typeCode: 'TG902-T007',
				label: { es: 'Profesor' },
				isAnchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.levels.map((l) => l.levelNum)).toEqual([6]);
		expect(result.levels.some((l) => l.typeCode === 'TG902-T007')).toBe(false);
	});

	it('coalesces multiple options per level into the same bucket', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 2,
				typeCode: 'TG902-T002',
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 11,
				parentId: 1,
				levelNum: 3,
				typeCode: 'TG902-T003',
				label: { es: 'A' },
				isAnchor: true,
			},
			{
				id: 12,
				parentId: 1,
				levelNum: 3,
				typeCode: 'TG902-T003',
				label: { es: 'B' },
				isAnchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.highestLevel).toBe(3);
		expect(result.levels).toHaveLength(1);
		expect(result.levels[0].options).toHaveLength(2);
		expect(result.levels[0].options.every((o) => o.parentId === null)).toBe(true);
	});

	it('sets highest_level to null when no row below the school is marked is_anchor', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 2,
				typeCode: 'TG902-T002',
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 2,
				parentId: 1,
				levelNum: 3,
				typeCode: 'TG902-T003',
				label: {},
				isAnchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.highestLevel).toBeNull();
		expect(result.levels).toHaveLength(1);
		expect(result.levels[0].levelNum).toBe(3);
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
		userSchoolsRepository.findUserSchools.mockResolvedValueOnce(rows);

		const result = await service.getUserSchools(3, 'TG102-T001', false);

		expect(result).toBe(rows);
		expect(userSchoolsRepository.findUserSchools).toHaveBeenCalledWith(3, 'TG102-T001', false);
	});
});
