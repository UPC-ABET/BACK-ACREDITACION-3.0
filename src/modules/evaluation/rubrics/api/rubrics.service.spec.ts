jest.mock('p-limit', () => ({
	__esModule: true,
	default: () => (fn: () => any) => fn(),
}));

import { RubricService } from './rubrics.service';

describe('RubricService.getAllWithFilters', () => {
	const rubric = {
		id: 1,
		studyPlanCourse: {
			studyPlanAcademicPeriod: {
				studyPlan: {
					program: { name: 'Ingeniería de Sistemas' },
				},
			},
		},
	};

	function buildService(total = 1) {
		const repository = {
			findManyWithContext: jest.fn().mockResolvedValue([[rubric], total]),
			isUsed: jest.fn().mockResolvedValue(false),
		};
		const rubricConfigService = {} as any;
		const service = new RubricService(repository as any, rubricConfigService);
		return { service, repository };
	}

	it('returns a paginated result with items, total, page, pageSize and totalPages', async () => {
		const { service } = buildService(1);

		const result = await service.getAllWithFilters({}, { page: 1, pageSize: 20 });

		expect(result).toEqual({
			items: [
				{
					...rubric,
					programName: 'Ingeniería de Sistemas',
					isUsed: false,
				},
			],
			total: 1,
			page: 1,
			pageSize: 20,
			totalPages: 1,
		});
	});

	it('forwards filters and resolved skip/take to the repository', async () => {
		const { service, repository } = buildService(0);

		await service.getAllWithFilters(
			{ schoolId: 5, programId: 2, academicPeriodId: 3, courseId: 4 },
			{ page: 2, pageSize: 10 },
		);

		expect(repository.findManyWithContext).toHaveBeenCalledWith({
			schoolId: 5,
			programId: 2,
			academicPeriodId: 3,
			courseId: 4,
			skip: 10,
			take: 10,
		});
	});

	it('defaults to page 1 / pageSize 20 when no query is provided', async () => {
		const { service, repository } = buildService(0);

		const result = await service.getAllWithFilters();

		expect(repository.findManyWithContext).toHaveBeenCalledWith({ skip: 0, take: 20 });
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(20);
		expect(result.totalPages).toBe(0);
	});
});
