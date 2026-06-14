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

		expect(result).toEqual({ highestLevel: null, levels: [], canNotify: false });
		expect(orgScopeRepository.findScope).not.toHaveBeenCalled();
	});

	it('returns empty scope when SQL returns no rows', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([]);

		const result = await service.getScope(1, 7, 5);

		expect(result).toEqual({ highestLevel: null, levels: [], canNotify: false });
		expect(orgScopeRepository.findScope).toHaveBeenCalledTimes(1);
		expect(orgScopeRepository.findScope).toHaveBeenCalledWith(1, 7, 5);
	});

	it('drops the school anchor (depth 0) and keeps only the levels below it', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 10,
				parentId: null,
				levelNum: 0,
				tagCode: 'TG903-T002',
				tagName: { es: 'Escuela' },
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 20,
				parentId: 10,
				levelNum: 1,
				tagCode: 'TG903-T003',
				tagName: { es: 'Carrera' },
				label: { es: 'Programa' },
				isAnchor: true,
			},
			{
				id: 30,
				parentId: 20,
				levelNum: 2,
				tagCode: null,
				tagName: null,
				label: { es: 'Area' },
				isAnchor: false,
			},
		]);

		const result = await service.getScope(7, 11, 5);

		expect(result.highestLevel).toBe(1);
		expect(result.levels.map((l) => l.levelNum)).toEqual([1, 2]);
		expect(result.levels[0]).toEqual({
			levelNum: 1,
			options: [
				{
					id: 20,
					label: { es: 'Programa' },
					parentId: null,
					tag: { code: 'TG903-T003', name: { es: 'Carrera' } },
				},
			],
		});
		// a generic node (no entity type) keeps its place with a null tag
		expect(result.levels[1]).toEqual({
			levelNum: 2,
			options: [{ id: 30, label: { es: 'Area' }, parentId: 20, tag: null }],
		});
	});

	it('coalesces multiple options at the same depth into one level', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 0,
				tagCode: 'TG903-T002',
				tagName: { es: 'Escuela' },
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 11,
				parentId: 1,
				levelNum: 1,
				tagCode: 'TG903-T003',
				tagName: { es: 'Carrera' },
				label: { es: 'A' },
				isAnchor: true,
			},
			{
				id: 12,
				parentId: 1,
				levelNum: 1,
				tagCode: null,
				tagName: null,
				label: { es: 'B' },
				isAnchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.highestLevel).toBe(1);
		expect(result.levels).toHaveLength(1);
		expect(result.levels[0].options).toHaveLength(2);
		expect(result.levels[0].options.every((o) => o.parentId === null)).toBe(true);
	});

	it('sets highest_level to null when no node below the school is marked is_anchor', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 0,
				tagCode: 'TG903-T002',
				tagName: { es: 'Escuela' },
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 2,
				parentId: 1,
				levelNum: 1,
				tagCode: null,
				tagName: null,
				label: {},
				isAnchor: false,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.highestLevel).toBeNull();
		expect(result.levels).toHaveLength(1);
		expect(result.levels[0].levelNum).toBe(1);
	});

	it('sets canNotify=true when the user is an anchor above the course level', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 0,
				tagCode: 'TG903-T002',
				tagName: { es: 'Escuela' },
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 2,
				parentId: 1,
				levelNum: 1,
				tagCode: 'TG903-T004',
				tagName: { es: 'Área' },
				label: { es: 'Área' },
				isAnchor: true,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.canNotify).toBe(true);
	});

	it('sets canNotify=false when the only anchor is a course (no higher level)', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 0,
				tagCode: 'TG903-T002',
				tagName: { es: 'Escuela' },
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 9,
				parentId: 1,
				levelNum: 1,
				tagCode: 'TG903-T006',
				tagName: { es: 'Curso' },
				label: { es: 'Curso' },
				isAnchor: true,
			},
		]);

		const result = await service.getScope(1, 11, 5);

		expect(result.canNotify).toBe(false);
	});

	it('sets canNotify=true for an admin even when the only anchor is a course', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([
			{
				id: 1,
				parentId: null,
				levelNum: 0,
				tagCode: 'TG903-T002',
				tagName: { es: 'Escuela' },
				label: { es: 'Escuela' },
				isAnchor: false,
			},
			{
				id: 9,
				parentId: 1,
				levelNum: 1,
				tagCode: 'TG903-T006',
				tagName: { es: 'Curso' },
				label: { es: 'Curso' },
				isAnchor: true,
			},
		]);

		const result = await service.getScope(1, 11, 5, true);

		expect(result.canNotify).toBe(true);
	});

	it('sets canNotify=true for an admin even with no scope rows', async () => {
		orgScopeRepository.findScope.mockResolvedValueOnce([]);

		const result = await service.getScope(1, 7, 5, true);

		expect(result).toEqual({ highestLevel: null, levels: [], canNotify: true });
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
		expect(userSchoolsRepository.findUserSchools).toHaveBeenCalledWith(
			3,
			{ modalityCode: 'TG102-T001' },
			false,
		);
	});
});
